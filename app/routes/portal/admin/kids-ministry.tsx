import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";
import { PendingButton } from "~/components/ui/PendingButton";
import { useToast } from "~/components/ui/ToastProvider";
import { useEffect, useRef } from "react";

export const meta: MetaFunction = () => [{ title: "Kids Ministry — Admin" }];

const PER_PAGE = 20;
const GUARDIAN_SLOTS = [0, 1, 2] as const;
const SERVICE_TYPES = ["KIDS_CHURCH", "NURSERY", "SPECIAL_EVENT"] as const;
const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT"] as const;

type AttendanceDetail = {
  status: "PRESENT" | "ABSENT";
  checkedInAt: string | null;
  checkedOutAt: string | null;
  pickupGuardianName: string | null;
  pickupGuardianRelationship: string | null;
  pickupNotes: string | null;
};

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeOptional(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function formatTimeLabel(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getClassroomLabel(classroom: string | null) {
  return classroom || "Unassigned";
}

function parseChildFilters(search: string, classroom: string, activeStatus: string) {
  return {
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { preferredName: { contains: search, mode: "insensitive" as const } },
            {
              guardians: {
                some: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" as const } },
                    { lastName: { contains: search, mode: "insensitive" as const } },
                    { phone: { contains: search, mode: "insensitive" as const } },
                    { email: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
    ...(classroom ? { classroom } : {}),
    ...(activeStatus === "active"
      ? { isActive: true }
      : activeStatus === "inactive"
        ? { isActive: false }
        : {}),
  };
}

async function buildGuardians(formData: FormData) {
  const raw = GUARDIAN_SLOTS.map((slot) => ({
    userId: normalizeText(formData.get(`guardianUserId-${slot}`)),
    firstName: normalizeText(formData.get(`guardianFirstName-${slot}`)),
    lastName: normalizeText(formData.get(`guardianLastName-${slot}`)),
    relationship: normalizeText(formData.get(`guardianRelationship-${slot}`)),
    phone: normalizeOptional(formData.get(`guardianPhone-${slot}`)),
    email: normalizeOptional(formData.get(`guardianEmail-${slot}`)),
    isPrimaryContact: formData.get(`guardianPrimary-${slot}`) === "on",
    canPickup: formData.get(`guardianCanPickup-${slot}`) !== null,
    notes: normalizeOptional(formData.get(`guardianNotes-${slot}`)),
  })).filter((guardian) =>
    guardian.userId ||
    guardian.firstName ||
    guardian.lastName ||
    guardian.relationship ||
    guardian.phone ||
    guardian.email ||
    guardian.notes,
  );

  if (raw.length === 0) {
    return { error: "Add at least one guardian or parent contact." as const };
  }

  const userIds = raw.map((guardian) => guardian.userId).filter(Boolean);
  const linkedUsers = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      })
    : [];
  const linkedUserMap = new Map(linkedUsers.map((linkedUser) => [linkedUser.id, linkedUser]));

  const guardians = raw.map((guardian, index) => {
    const linkedUser = guardian.userId ? linkedUserMap.get(guardian.userId) : null;
    const firstName = guardian.firstName || linkedUser?.firstName || "";
    const lastName = guardian.lastName || linkedUser?.lastName || "";
    const relationship = guardian.relationship || (linkedUser ? "Parent" : "");

    return {
      userId: guardian.userId || null,
      relationship,
      firstName,
      lastName,
      phone: guardian.phone ?? linkedUser?.phone ?? null,
      email: guardian.email ?? linkedUser?.email ?? null,
      isPrimaryContact: guardian.isPrimaryContact,
      canPickup: guardian.canPickup,
      notes: guardian.notes,
      sortOrder: index,
    };
  });

  const invalidGuardian = guardians.find(
    (guardian) => !guardian.firstName || !guardian.lastName || !guardian.relationship,
  );

  if (invalidGuardian) {
    return {
      error:
        "Each guardian needs a relationship plus a first and last name. Linked parent accounts can fill this automatically." as const,
    };
  }

  if (!guardians.some((guardian) => guardian.isPrimaryContact)) {
    guardians[0]!.isPrimaryContact = true;
  }

  return { guardians };
}

function ChildAttendanceRow({
  childId,
  displayName,
  preferredName,
  classroom,
  allergies,
  medicalNotes,
  notes,
  guardians,
  attendance,
  date,
  serviceType,
  disabled,
}: {
  childId: string;
  displayName: string;
  preferredName: string | null;
  classroom: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  notes: string | null;
  guardians: Array<{
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string | null;
    isPrimaryContact: boolean;
    canPickup: boolean;
  }>;
  attendance: AttendanceDetail | null;
  date: string;
  serviceType: string;
  disabled: boolean;
}) {
  const fetcher = useFetcher();
  const { showToast } = useToast();
  const primaryGuardian = guardians.find((guardian) => guardian.isPrimaryContact) ?? guardians[0] ?? null;
  const approvedGuardians = guardians.filter((guardian) => guardian.canPickup);
  const initials = displayName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hasAllergyFlag = Boolean(allergies);
  const hasMedicalFlag = Boolean(medicalNotes);
  const isPresent = attendance?.status === "PRESENT";
  const isCheckedOut = Boolean(attendance?.checkedOutAt);
  const awaitingPickup = isPresent && !isCheckedOut;
  const stateLabel = isCheckedOut
    ? `Checked out${attendance?.pickupGuardianName ? ` to ${attendance.pickupGuardianName}` : ""}${attendance?.checkedOutAt ? ` at ${formatTimeLabel(attendance.checkedOutAt)}` : ""}`
    : awaitingPickup
      ? `Checked in${attendance?.checkedInAt ? ` at ${formatTimeLabel(attendance.checkedInAt)}` : ""}`
      : attendance?.status === "ABSENT"
        ? "Marked absent"
        : "Ready for check-in";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || typeof fetcher.data !== "object") {
      return;
    }

    const message =
      "error" in fetcher.data && fetcher.data.error
        ? fetcher.data.error
        : "success" in fetcher.data && fetcher.data.success
        ? fetcher.data.success
        : null;

    if (!message) {
      return;
    }

    showToast({
      tone: "error" in fetcher.data && fetcher.data.error ? "error" : "success",
      message,
    });
  }, [fetcher.data, fetcher.state, showToast]);

  return (
    <li className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 font-sans text-sm font-bold text-sky-700"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-gray-800">
                {displayName}
                {preferredName ? ` (${preferredName})` : ""}
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isCheckedOut
                    ? "bg-slate-100 text-slate-700"
                    : awaitingPickup
                      ? "bg-green-100 text-green-700"
                      : attendance?.status === "ABSENT"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                }`}
              >
                {stateLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {classroom ?? "No classroom assigned"}
              {primaryGuardian && ` · ${primaryGuardian.firstName} ${primaryGuardian.lastName}`}
              {primaryGuardian?.phone ? ` · ${primaryGuardian.phone}` : ""}
            </p>
            {(hasAllergyFlag || hasMedicalFlag || notes) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {hasAllergyFlag && (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                    Allergy alert
                  </span>
                )}
                {hasMedicalFlag && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    Medical note
                  </span>
                )}
                {notes && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    Has internal notes
                  </span>
                )}
              </div>
            )}
            {(allergies || medicalNotes) && (
              <p className="mt-2 text-xs text-gray-500">
                {allergies ? `Allergies: ${allergies}` : ""}
                {allergies && medicalNotes ? " · " : ""}
                {medicalNotes ? `Medical: ${medicalNotes}` : ""}
              </p>
            )}
            {attendance?.pickupNotes && (
              <p className="mt-2 text-xs text-gray-500">Pickup note: {attendance.pickupNotes}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[320px]">
          <fetcher.Form method="post" className="flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="markAttendance" />
            <input type="hidden" name="childId" value={childId} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="serviceType" value={serviceType} />
            <PendingButton
              type="submit"
              name="status"
              value="PRESENT"
              disabled={disabled}
              isPending={fetcher.state !== "idle" && fetcher.formData?.get("status") === "PRESENT"}
              pendingText="Saving..."
              className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-40 ${
                isPresent && !isCheckedOut
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-green-400 hover:text-green-700"
              }`}
            >
              {isCheckedOut ? "Re-open check-in" : isPresent ? "Checked in" : "Check in"}
            </PendingButton>
            <PendingButton
              type="submit"
              name="status"
              value="ABSENT"
              disabled={disabled}
              isPending={fetcher.state !== "idle" && fetcher.formData?.get("status") === "ABSENT"}
              pendingText="Saving..."
              className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-40 ${
                attendance?.status === "ABSENT"
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-red-400 hover:text-red-700"
              }`}
            >
              Mark absent
            </PendingButton>
          </fetcher.Form>

          {awaitingPickup && (
            approvedGuardians.length > 0 ? (
              <fetcher.Form method="post" className="rounded-xl border border-green-100 bg-green-50 p-3">
                <input type="hidden" name="intent" value="checkOutChild" />
                <input type="hidden" name="childId" value={childId} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="serviceType" value={serviceType} />
                <div className="grid gap-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-green-700">
                    Approved pickup guardian
                    <select
                      name="guardianId"
                      className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                      defaultValue={approvedGuardians[0]?.id ?? ""}
                    >
                      {approvedGuardians.map((guardian) => (
                        <option key={guardian.id} value={guardian.id}>
                          {guardian.firstName} {guardian.lastName} · {guardian.relationship}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-widest text-green-700">
                    Pickup note
                    <input
                      type="text"
                      name="pickupNotes"
                      placeholder="ID checked, auntie picked up, sent by parent..."
                      className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </label>
                  <PendingButton
                    type="submit"
                    disabled={disabled}
                    isPending={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "checkOutChild"}
                    pendingText="Saving..."
                    className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-40"
                  >
                    Verify pickup and check out
                  </PendingButton>
                </div>
              </fetcher.Form>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                No guardian is approved for pickup yet. Update the child profile before check-out.
              </div>
            )
          )}
        </div>
      </div>
    </li>
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const classroom = url.searchParams.get("classroom") ?? "";
  const activeStatus = url.searchParams.get("activeStatus") ?? "active";
  const serviceType = url.searchParams.get("serviceType") ?? "KIDS_CHURCH";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const editId = url.searchParams.get("edit") ?? "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultDate = today.toISOString().slice(0, 10);
  const date = url.searchParams.get("date") ?? defaultDate;
  const selectedDate = new Date(`${date}T00:00:00`);
  const normalizedDate = Number.isNaN(selectedDate.getTime()) ? defaultDate : date;
  const attendanceDate = Number.isNaN(selectedDate.getTime()) ? today : selectedDate;
  const isFuture = attendanceDate > today;
  const where = parseChildFilters(search, classroom, activeStatus);

  const [
    children,
    total,
    classrooms,
    attendanceRecords,
    parents,
    editingChild,
    activeChildren,
    rosterChildren,
  ] = await Promise.all([
    db.childProfile.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        guardians: {
          orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            relationship: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isPrimaryContact: true,
            canPickup: true,
            notes: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
    db.childProfile.count({ where }),
    db.childProfile.findMany({
      where: { classroom: { not: null } },
      distinct: ["classroom"],
      select: { classroom: true },
      orderBy: { classroom: "asc" },
    }),
    db.childAttendance.findMany({
      where: {
        date: attendanceDate,
        serviceType,
      },
      select: {
        childId: true,
        status: true,
        checkedInAt: true,
        checkedOutAt: true,
        pickupGuardianName: true,
        pickupGuardianRelationship: true,
        pickupNotes: true,
      },
    }),
    db.user.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    }),
    editId
      ? db.childProfile.findUnique({
          where: { id: editId },
          include: {
            guardians: {
              orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
            },
          },
        })
      : null,
    db.childProfile.count({ where: { isActive: true } }),
    db.childProfile.findMany({
      where,
      orderBy: [{ classroom: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        classroom: true,
        isActive: true,
        allergies: true,
        medicalNotes: true,
      },
    }),
  ]);

  const attendanceDetails = Object.fromEntries(
    attendanceRecords.map((record) => [
      record.childId,
      {
        status: record.status as "PRESENT" | "ABSENT",
        checkedInAt: record.checkedInAt?.toISOString() ?? null,
        checkedOutAt: record.checkedOutAt?.toISOString() ?? null,
        pickupGuardianName: record.pickupGuardianName,
        pickupGuardianRelationship: record.pickupGuardianRelationship,
        pickupNotes: record.pickupNotes,
      } satisfies AttendanceDetail,
    ]),
  ) as Record<string, AttendanceDetail>;

  const filteredActiveChildren = rosterChildren.filter((child) => child.isActive);
  const checkedInCount = filteredActiveChildren.filter(
    (child) => attendanceDetails[child.id]?.status === "PRESENT",
  ).length;
  const checkedOutCount = filteredActiveChildren.filter(
    (child) => Boolean(attendanceDetails[child.id]?.checkedOutAt),
  ).length;
  const awaitingPickupCount = filteredActiveChildren.filter((child) => {
    const attendance = attendanceDetails[child.id];
    return attendance?.status === "PRESENT" && !attendance.checkedOutAt;
  }).length;
  const flaggedChildrenCount = filteredActiveChildren.filter(
    (child) => child.allergies || child.medicalNotes,
  ).length;

  const classroomRosters = Array.from(
    rosterChildren.reduce((map, child) => {
      const key = getClassroomLabel(child.classroom);
      const record = attendanceDetails[child.id] ?? null;
      const existing = map.get(key) ?? {
        classroom: key,
        total: 0,
        checkedIn: 0,
        checkedOut: 0,
        awaitingPickup: 0,
        flagged: 0,
        children: [] as Array<{
          id: string;
          label: string;
          isActive: boolean;
          status: "PRESENT" | "ABSENT" | null;
          checkedOut: boolean;
          hasEmergencyInfo: boolean;
        }>,
      };

      existing.total += 1;
      if (record?.status === "PRESENT") {
        existing.checkedIn += 1;
      }
      if (record?.checkedOutAt) {
        existing.checkedOut += 1;
      }
      if (record?.status === "PRESENT" && !record.checkedOutAt) {
        existing.awaitingPickup += 1;
      }
      if (child.allergies || child.medicalNotes) {
        existing.flagged += 1;
      }
      existing.children.push({
        id: child.id,
        label: `${child.firstName} ${child.lastName}${child.preferredName ? ` (${child.preferredName})` : ""}`,
        isActive: child.isActive,
        status: record?.status ?? null,
        checkedOut: Boolean(record?.checkedOutAt),
        hasEmergencyInfo: Boolean(child.allergies || child.medicalNotes),
      });
      map.set(key, existing);
      return map;
    }, new Map<string, {
      classroom: string;
      total: number;
      checkedIn: number;
      checkedOut: number;
      awaitingPickup: number;
      flagged: number;
      children: Array<{
        id: string;
        label: string;
        isActive: boolean;
        status: "PRESENT" | "ABSENT" | null;
        checkedOut: boolean;
        hasEmergencyInfo: boolean;
      }>;
    }>()),
  ).map(([, roster]) => roster);

  return {
    children: children.map((child) => ({
      ...child,
      birthday: child.birthday.toISOString().slice(0, 10),
    })),
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    classrooms: classrooms
      .map((item) => item.classroom)
      .filter((room): room is string => Boolean(room)),
    attendanceDetails,
    classroomRosters,
    parents,
    editingChild: editingChild
      ? {
          ...editingChild,
          birthday: editingChild.birthday.toISOString().slice(0, 10),
        }
      : null,
    filters: {
      search,
      classroom,
      activeStatus,
      date: normalizedDate,
      serviceType,
    },
    stats: {
      activeChildren,
      checkedInCount,
      checkedOutCount,
      awaitingPickupCount,
      flaggedChildrenCount,
      unmarkedToday: Math.max(filteredActiveChildren.length - checkedInCount - filteredActiveChildren.filter((child) => attendanceDetails[child.id]?.status === "ABSENT").length, 0),
    },
    isFuture,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = normalizeText(formData.get("intent"));

  if (intent === "saveChild") {
    const childId = normalizeText(formData.get("childId"));
    const firstName = normalizeText(formData.get("firstName"));
    const lastName = normalizeText(formData.get("lastName"));
    const preferredName = normalizeOptional(formData.get("preferredName"));
    const gender = normalizeOptional(formData.get("gender"));
    const birthday = normalizeText(formData.get("birthday"));
    const classroom = normalizeOptional(formData.get("classroom"));
    const allergies = normalizeOptional(formData.get("allergies"));
    const medicalNotes = normalizeOptional(formData.get("medicalNotes"));
    const notes = normalizeOptional(formData.get("notes"));
    const isActive = formData.get("isActive") !== null;

    if (!firstName || !lastName || !birthday) {
      return { error: "First name, last name, and birth date are required." };
    }

    const parsedBirthday = new Date(`${birthday}T00:00:00`);
    if (Number.isNaN(parsedBirthday.getTime())) {
      return { error: "Enter a valid birth date." };
    }

    const guardianResult = await buildGuardians(formData);
    if ("error" in guardianResult) {
      return { error: guardianResult.error };
    }

    const childData = {
      firstName,
      lastName,
      preferredName,
      gender,
      birthday: parsedBirthday,
      classroom,
      allergies,
      medicalNotes,
      notes,
      isActive,
    };

    if (childId) {
      await db.$transaction(async (tx) => {
        await tx.childProfile.update({
          where: { id: childId },
          data: childData,
        });
        await tx.childGuardian.deleteMany({ where: { childId } });
        await tx.childGuardian.createMany({
          data: guardianResult.guardians.map((guardian) => ({
            childId,
            userId: guardian.userId,
            relationship: guardian.relationship,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            phone: guardian.phone,
            email: guardian.email,
            isPrimaryContact: guardian.isPrimaryContact,
            canPickup: guardian.canPickup,
            notes: guardian.notes,
          })),
        });
      });

      return { success: "Child profile updated." };
    }

    await db.childProfile.create({
      data: {
        ...childData,
        guardians: {
          create: guardianResult.guardians.map((guardian) => ({
            userId: guardian.userId,
            relationship: guardian.relationship,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            phone: guardian.phone,
            email: guardian.email,
            isPrimaryContact: guardian.isPrimaryContact,
            canPickup: guardian.canPickup,
            notes: guardian.notes,
          })),
        },
      },
    });

    return { success: "Child profile created." };
  }

  if (intent === "toggleActive") {
    const childId = normalizeText(formData.get("childId"));
    const child = await db.childProfile.findUnique({
      where: { id: childId },
      select: { isActive: true },
    });

    if (!child) {
      return { error: "Child profile not found." };
    }

    await db.childProfile.update({
      where: { id: childId },
      data: { isActive: !child.isActive },
    });

    return { success: "Child status updated." };
  }

  if (intent === "markAttendance") {
    const childId = normalizeText(formData.get("childId"));
    const date = normalizeText(formData.get("date"));
    const serviceType = normalizeText(formData.get("serviceType")) || "KIDS_CHURCH";
    const status = normalizeText(formData.get("status"));

    if (!SERVICE_TYPES.includes(serviceType as (typeof SERVICE_TYPES)[number])) {
      return { error: "Invalid kids service type." };
    }

    if (!ATTENDANCE_STATUSES.includes(status as (typeof ATTENDANCE_STATUSES)[number])) {
      return { error: "Invalid attendance status." };
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return { error: "Choose a valid attendance date." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      return { error: "Cannot mark attendance for a future date." };
    }

    const existingRecord = await db.childAttendance.findUnique({
      where: {
        childId_serviceType_date: {
          childId,
          serviceType,
          date: selectedDate,
        },
      },
      select: {
        id: true,
        checkedInAt: true,
      },
    });

    if (status === "PRESENT") {
      const checkedInAt = existingRecord?.checkedInAt ?? new Date();

      if (existingRecord) {
        await db.childAttendance.update({
          where: { id: existingRecord.id },
          data: {
            status,
            markedById: user.id,
            checkedInAt,
            checkedOutAt: null,
            checkedOutById: null,
            pickupGuardianName: null,
            pickupGuardianRelationship: null,
            pickupNotes: null,
          },
        });
      } else {
        await db.childAttendance.create({
          data: {
            childId,
            serviceType,
            status,
            date: selectedDate,
            markedById: user.id,
            checkedInAt,
          },
        });
      }

      return { success: "Child checked in." };
    }

    await db.childAttendance.upsert({
      where: {
        childId_serviceType_date: {
          childId,
          serviceType,
          date: selectedDate,
        },
      },
      update: {
        status,
        markedById: user.id,
        checkedInAt: null,
        checkedOutAt: null,
        checkedOutById: null,
        pickupGuardianName: null,
        pickupGuardianRelationship: null,
        pickupNotes: null,
      },
      create: {
        childId,
        serviceType,
        status,
        date: selectedDate,
        markedById: user.id,
      },
    });

    return { success: "Attendance saved." };
  }

  if (intent === "checkOutChild") {
    const childId = normalizeText(formData.get("childId"));
    const guardianId = normalizeText(formData.get("guardianId"));
    const date = normalizeText(formData.get("date"));
    const serviceType = normalizeText(formData.get("serviceType")) || "KIDS_CHURCH";
    const pickupNotes = normalizeOptional(formData.get("pickupNotes"));

    if (!childId || !guardianId) {
      return { error: "Choose an approved guardian before check-out." };
    }

    if (!SERVICE_TYPES.includes(serviceType as (typeof SERVICE_TYPES)[number])) {
      return { error: "Invalid kids service type." };
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return { error: "Choose a valid attendance date." };
    }

    const attendance = await db.childAttendance.findUnique({
      where: {
        childId_serviceType_date: {
          childId,
          serviceType,
          date: selectedDate,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!attendance || attendance.status !== "PRESENT") {
      return { error: "Check the child in before verifying pickup." };
    }

    const child = await db.childProfile.findUnique({
      where: { id: childId },
      select: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            relationship: true,
            canPickup: true,
          },
        },
      },
    });

    const approvedGuardian = child?.guardians.find(
      (guardian) => guardian.id === guardianId && guardian.canPickup,
    );

    if (!approvedGuardian) {
      return { error: "That guardian is not approved for pickup." };
    }

    await db.childAttendance.update({
      where: { id: attendance.id },
      data: {
        checkedOutAt: new Date(),
        checkedOutById: user.id,
        pickupGuardianName: `${approvedGuardian.firstName} ${approvedGuardian.lastName}`,
        pickupGuardianRelationship: approvedGuardian.relationship,
        pickupNotes,
      },
    });

    return { success: "Pickup verified and child checked out." };
  }

  if (intent === "exportChildren") {
    const search = normalizeText(formData.get("search"));
    const classroom = normalizeText(formData.get("classroom"));
    const activeStatus = normalizeText(formData.get("activeStatus")) || "active";
    const children = await db.childProfile.findMany({
      where: parseChildFilters(search, classroom, activeStatus),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        guardians: {
          orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    const csv = [
      "Last Name,First Name,Preferred Name,Birthday,Classroom,Status,Primary Guardian,Relationship,Phone,Email,Allergies,Medical Notes",
      ...children.map((child) => {
        const guardian =
          child.guardians.find((entry) => entry.isPrimaryContact) ?? child.guardians[0] ?? null;
        return [
          child.lastName,
          child.firstName,
          child.preferredName ?? "",
          child.birthday.toISOString().slice(0, 10),
          child.classroom ?? "",
          child.isActive ? "Active" : "Inactive",
          guardian ? `${guardian.firstName} ${guardian.lastName}` : "",
          guardian?.relationship ?? "",
          guardian?.phone ?? "",
          guardian?.email ?? "",
          child.allergies ?? "",
          child.medicalNotes ?? "",
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",");
      }),
    ].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kids-ministry-children.csv"',
      },
    });
  }

  return { error: "Unknown intent." };
}

export default function KidsMinistryPage() {
  const {
    children,
    total,
    page,
    totalPages,
    classrooms,
    parents,
    editingChild,
    filters,
    attendanceDetails,
    classroomRosters,
    stats,
    isFuture,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const feedback =
    actionData && typeof actionData === "object" && ("error" in actionData || "success" in actionData)
      ? actionData
      : null;
  const today = new Date().toISOString().slice(0, 10);
  const guardianDefaults = editingChild?.guardians ?? [];

  useEffect(() => {
    const message =
      feedback && typeof feedback === "object"
        ? ("error" in feedback && feedback.error
            ? feedback.error
            : "success" in feedback && feedback.success
            ? feedback.success
            : null)
        : null;

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: feedback && "error" in feedback && feedback.error ? "error" : "success",
      message,
    });
  }, [feedback, showToast]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">Kids Ministry</h1>
          <p className="text-sm text-gray-400">
            Sunday check-in, pickup verification, and classroom visibility in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Active Kids", value: stats.activeChildren },
            { label: "Checked In", value: stats.checkedInCount },
            { label: "Awaiting Pickup", value: stats.awaitingPickupCount },
            { label: "Emergency Flags", value: stats.flaggedChildrenCount },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {item.label}
              </p>
              <p className="mt-1 font-serif text-2xl font-bold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-8 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-gray-900">
                {editingChild ? "Edit Child Profile" : "Add Child Profile"}
              </h2>
              <p className="text-sm text-gray-400">
                Link children to parent accounts and keep pickup contacts in one place.
              </p>
            </div>
            {editingChild && (
              <Link
                to="/portal/admin/kids-ministry"
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Clear form
              </Link>
            )}
          </div>

          <Form method="post" className="space-y-6">
            <input type="hidden" name="intent" value="saveChild" />
            <input type="hidden" name="childId" value={editingChild?.id ?? ""} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">First Name</span>
                <input
                  type="text"
                  name="firstName"
                  defaultValue={editingChild?.firstName ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Last Name</span>
                <input
                  type="text"
                  name="lastName"
                  defaultValue={editingChild?.lastName ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Preferred Name</span>
                <input
                  type="text"
                  name="preferredName"
                  defaultValue={editingChild?.preferredName ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Birth Date</span>
                <input
                  type="date"
                  name="birthday"
                  defaultValue={editingChild?.birthday ?? ""}
                  max={today}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Gender</span>
                <select
                  name="gender"
                  defaultValue={editingChild?.gender ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Classroom / Age Group</span>
                <input
                  type="text"
                  name="classroom"
                  defaultValue={editingChild?.classroom ?? ""}
                  placeholder="Explorers, Nursery, Grade 1-3..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Allergies</span>
                <textarea
                  name="allergies"
                  rows={3}
                  defaultValue={editingChild?.allergies ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Medical Notes</span>
                <textarea
                  name="medicalNotes"
                  rows={3}
                  defaultValue={editingChild?.medicalNotes ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-bold text-gray-700">Internal Notes</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={editingChild?.notes ?? ""}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </label>

            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-gray-900">Guardian Contacts</h3>
                <p className="text-sm text-gray-400">
                  Link an existing parent account or enter a stand-alone guardian contact.
                </p>
              </div>
              {GUARDIAN_SLOTS.map((slot) => {
                const guardian = guardianDefaults[slot];
                return (
                  <div key={slot} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Guardian {slot + 1}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            name={`guardianPrimary-${slot}`}
                            defaultChecked={guardian?.isPrimaryContact ?? slot === 0}
                            className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
                          />
                          Primary
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            name={`guardianCanPickup-${slot}`}
                            defaultChecked={guardian?.canPickup ?? true}
                            className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
                          />
                          Approved pickup
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-bold text-gray-700">Linked Parent Account</span>
                        <select
                          name={`guardianUserId-${slot}`}
                          defaultValue={guardian?.userId ?? ""}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        >
                          <option value="">No linked account</option>
                          {parents.map((parent) => (
                            <option key={parent.id} value={parent.id}>
                              {parent.lastName}, {parent.firstName}
                              {parent.email ? ` · ${parent.email}` : parent.phone ? ` · ${parent.phone}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold text-gray-700">Relationship</span>
                        <input
                          type="text"
                          name={`guardianRelationship-${slot}`}
                          defaultValue={guardian?.relationship ?? ""}
                          placeholder="Mother, Father, Auntie..."
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold text-gray-700">Phone</span>
                        <input
                          type="text"
                          name={`guardianPhone-${slot}`}
                          defaultValue={guardian?.phone ?? ""}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold text-gray-700">First Name</span>
                        <input
                          type="text"
                          name={`guardianFirstName-${slot}`}
                          defaultValue={guardian?.firstName ?? ""}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold text-gray-700">Last Name</span>
                        <input
                          type="text"
                          name={`guardianLastName-${slot}`}
                          defaultValue={guardian?.lastName ?? ""}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                      <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-bold text-gray-700">Email</span>
                        <input
                          type="email"
                          name={`guardianEmail-${slot}`}
                          defaultValue={guardian?.email ?? ""}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                      <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-bold text-gray-700">Notes</span>
                        <input
                          type="text"
                          name={`guardianNotes-${slot}`}
                          defaultValue={guardian?.notes ?? ""}
                          placeholder="Emergency pickup only, prefers SMS..."
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-700">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editingChild?.isActive ?? true}
                className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
              />
              Active child record
            </label>

            <PendingButton
              type="submit"
              isPending={isSubmitting}
              pendingText="Saving..."
              className="rounded-lg bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {editingChild ? "Update Child Profile" : "Create Child Profile"}
            </PendingButton>
          </Form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-4 font-serif text-lg font-bold text-gray-900">Sunday Flow</h2>
            <Form method="get" className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="search" value={filters.search} />
              <input type="hidden" name="classroom" value={filters.classroom} />
              <input type="hidden" name="activeStatus" value={filters.activeStatus} />
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Service Date</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={filters.date}
                  max={today}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-gray-700">Service Type</span>
                <select
                  name="serviceType"
                  defaultValue={filters.serviceType}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="KIDS_CHURCH">Kids Church</option>
                  <option value="NURSERY">Nursery</option>
                  <option value="SPECIAL_EVENT">Special Event</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 md:col-span-2"
              >
                Load Sunday roster
              </button>
            </Form>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-800">Recommended order</p>
              <p className="mt-1">1. Load the service roster. 2. Check children in as they arrive. 3. Verify pickup with an approved guardian before check-out.</p>
            </div>
            {isFuture && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Future dates can be viewed, but they cannot be marked yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-2 font-serif text-lg font-bold text-gray-900">Operations Snapshot</h2>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>{stats.checkedOutCount} child{stats.checkedOutCount === 1 ? "" : "ren"} already checked out for this service.</li>
              <li>{stats.unmarkedToday} active child{stats.unmarkedToday === 1 ? "" : "ren"} still need a Sunday status.</li>
              <li>Emergency and allergy flags stay visible in both the classroom roster and the live check-in list.</li>
            </ul>
          </div>
        </div>
      </div>

      <Form method="get" className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
        <input type="hidden" name="date" value={filters.date} />
        <input type="hidden" name="serviceType" value={filters.serviceType} />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="Search child or guardian..."
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <select
            name="classroom"
            defaultValue={filters.classroom}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option value="">All classrooms</option>
            {classrooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
          <select
            name="activeStatus"
            defaultValue={filters.activeStatus}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">Active and inactive</option>
          </select>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800"
            >
              Filter
            </button>
            {(filters.search || filters.classroom || filters.activeStatus !== "active") && (
              <Link
                to={`/portal/admin/kids-ministry?date=${filters.date}&serviceType=${filters.serviceType}`}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700"
              >
                Clear
              </Link>
            )}
          </div>
        </div>
      </Form>

      <div className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-gray-900">Classroom Rosters</h2>
            <p className="text-sm text-gray-400">
              Grouped view for the currently filtered children and selected Sunday service.
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {classroomRosters.map((roster) => (
            <section key={roster.classroom} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-gray-900">{roster.classroom}</h3>
                  <p className="text-xs uppercase tracking-widest text-gray-400">
                    {roster.total} child{roster.total === 1 ? "" : "ren"} · {roster.checkedIn} checked in · {roster.awaitingPickup} awaiting pickup
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                    Checked out {roster.checkedOut}
                  </span>
                  {roster.flagged > 0 && (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                      Flags {roster.flagged}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {roster.children.map((child) => (
                  <span
                    key={child.id}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      child.checkedOut
                        ? "border-slate-200 bg-slate-50 text-slate-700"
                        : child.status === "PRESENT"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : child.status === "ABSENT"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                    } ${!child.isActive ? "opacity-60" : ""}`}
                  >
                    {child.label}
                    {child.hasEmergencyInfo ? " · Flagged" : ""}
                    {child.checkedOut ? " · Checked out" : child.status === "PRESENT" ? " · Checked in" : child.status === "ABSENT" ? " · Absent" : " · Unmarked"}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-gray-900">Children Roster</h2>
          <p className="text-sm text-gray-400">
            {total} matching child record{total === 1 ? "" : "s"}.
          </p>
        </div>
        <Form method="post">
          <input type="hidden" name="intent" value="exportChildren" />
          <input type="hidden" name="search" value={filters.search} />
          <input type="hidden" name="classroom" value={filters.classroom} />
          <input type="hidden" name="activeStatus" value={filters.activeStatus} />
          <button
            type="submit"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:border-red-300 hover:text-red-700"
          >
            Export Children CSV
          </button>
        </Form>
      </div>

      {children.length > 0 ? (
        <div className="space-y-4">
          {children.map((child) => (
            <div
              key={child.id}
              className={`overflow-hidden rounded-2xl border bg-white ${
                child.isActive ? "border-gray-100" : "border-gray-200 opacity-70"
              }`}
            >
              <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg font-bold text-gray-900">
                      {child.firstName} {child.lastName}
                      {child.preferredName ? ` (${child.preferredName})` : ""}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        child.isActive
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {child.isActive ? "Active" : "Inactive"}
                    </span>
                    {child.classroom && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                        {child.classroom}
                      </span>
                    )}
                    {child.allergies && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                        Allergy Alert
                      </span>
                    )}
                    {child.medicalNotes && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        Medical Note
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    Born{" "}
                    {new Date(child.birthday).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {child.guardians.map((guardian) => (
                      <span
                        key={guardian.id}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          guardian.canPickup
                            ? "border-gray-200 bg-gray-50 text-gray-600"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {guardian.firstName} {guardian.lastName} · {guardian.relationship}
                        {guardian.isPrimaryContact ? " · Primary" : ""}
                        {guardian.canPickup ? " · Pickup approved" : " · No pickup"}
                        {guardian.user ? ` · linked to ${guardian.user.firstName} ${guardian.user.lastName}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/portal/admin/kids-ministry?search=${encodeURIComponent(filters.search)}&classroom=${encodeURIComponent(filters.classroom)}&activeStatus=${encodeURIComponent(filters.activeStatus)}&date=${filters.date}&serviceType=${filters.serviceType}&page=${page}&edit=${child.id}`}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:border-red-300 hover:text-red-700"
                  >
                    Edit
                  </Link>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggleActive" />
                    <input type="hidden" name="childId" value={child.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:border-red-300 hover:text-red-700"
                    >
                      {child.isActive ? "Archive" : "Reactivate"}
                    </button>
                  </Form>
                </div>
              </div>

              <ul>
                <ChildAttendanceRow
                  childId={child.id}
                  displayName={`${child.firstName} ${child.lastName}`}
                  preferredName={child.preferredName}
                  classroom={child.classroom}
                  allergies={child.allergies}
                  medicalNotes={child.medicalNotes}
                  notes={child.notes}
                  guardians={child.guardians}
                  attendance={attendanceDetails[child.id] ?? null}
                  date={filters.date}
                  serviceType={filters.serviceType}
                  disabled={isFuture}
                />
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="members"
          title="No child records found"
          message="Try widening your filters or create the first Kids Ministry profile above."
        />
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Kids Ministry pagination">
          {page > 1 && (
            <Link
              to={`/portal/admin/kids-ministry?search=${encodeURIComponent(filters.search)}&classroom=${encodeURIComponent(filters.classroom)}&activeStatus=${encodeURIComponent(filters.activeStatus)}&date=${filters.date}&serviceType=${filters.serviceType}&page=${page - 1}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:border-red-300 hover:text-red-700"
            >
              ← Prev
            </Link>
          )}
          <span className="px-3 text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              to={`/portal/admin/kids-ministry?search=${encodeURIComponent(filters.search)}&classroom=${encodeURIComponent(filters.classroom)}&activeStatus=${encodeURIComponent(filters.activeStatus)}&date=${filters.date}&serviceType=${filters.serviceType}&page=${page + 1}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:border-red-300 hover:text-red-700"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="members"
      title="Kids Ministry unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
    />
  );
}
