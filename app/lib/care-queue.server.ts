import { db } from "./db.server";
import { getMembersNeedingCare } from "./attendance.server";

export const CARE_CATEGORY_ATTENDANCE = "ATTENDANCE";
export const CARE_CATEGORY_PRAYER = "PRAYER";

export type CareOwner = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type CareQueueItem = {
  key: string;
  sourceType: "ATTENDANCE" | "PRAYER";
  sourceId: string;
  careCaseId: string | null;
  title: string;
  email: string | null;
  phone: string | null;
  ownerId: string | null;
  owner: CareOwner | null;
  lastContactedAt: string | null;
  notes: string | null;
  nextAction: string | null;
  reminderAt: string | null;
  openedAt: string;
  isReminderDue: boolean;
  memberId?: string;
  memberLink?: string;
  consecutiveMissed?: number;
  cellGroupName?: string | null;
  prayerStatus?: string;
  prayerRequest?: string;
  isPrivate?: boolean;
  answeredAt?: string | null;
};

function toIsoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function matchesOwnerFilter(ownerId: string | null, filterOwnerId: string) {
  if (!filterOwnerId) return true;
  if (filterOwnerId === "unassigned") {
    return ownerId === null;
  }
  return ownerId === filterOwnerId;
}

function matchesQuery(item: CareQueueItem, query: string) {
  if (!query) return true;

  const haystack = [
    item.title,
    item.email,
    item.phone,
    item.notes,
    item.nextAction,
    item.cellGroupName,
    item.prayerRequest,
    item.prayerStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export async function getCareOwners() {
  return db.user.findMany({
    where: {
      isActive: true,
      role: { in: ["ADMIN", "CELL_LEADER"] },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });
}

export async function getCareQueue({
  role,
  cellGroupId,
  bucket,
  source,
  ownerId,
  query,
  dueOnly,
  memberId,
}: {
  role: "ADMIN" | "CELL_LEADER";
  cellGroupId: string | null;
  bucket: "open" | "archive";
  source: "all" | "attendance" | "prayer";
  ownerId: string;
  query: string;
  dueOnly: boolean;
  memberId: string;
}) {
  const now = new Date();
  const includeAttendance = bucket === "open" && source !== "prayer";
  const includePrayer = role === "ADMIN" && source !== "attendance";

  const [owners, attendanceItems, prayerItems]: [
    CareOwner[],
    CareQueueItem[],
    CareQueueItem[],
  ] = await Promise.all([
    getCareOwners(),
    includeAttendance
      ? getAttendanceCareItems({ role, cellGroupId, now })
      : Promise.resolve([]),
    includePrayer ? getPrayerCareItems({ bucket, now }) : Promise.resolve([]),
  ]);

  const baseItems = [...attendanceItems, ...prayerItems];
  const filteredItems = baseItems
    .filter((item) => (memberId ? item.memberId === memberId : true))
    .filter((item) => matchesOwnerFilter(item.ownerId, ownerId))
    .filter((item) => matchesQuery(item, query))
    .filter((item) => (dueOnly ? item.isReminderDue : true))
    .sort((left, right) => {
      if (left.isReminderDue !== right.isReminderDue) {
        return left.isReminderDue ? -1 : 1;
      }

      const leftReminder = left.reminderAt ? new Date(left.reminderAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightReminder = right.reminderAt ? new Date(right.reminderAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftReminder !== rightReminder) {
        return leftReminder - rightReminder;
      }

      if ((right.consecutiveMissed ?? 0) !== (left.consecutiveMissed ?? 0)) {
        return (right.consecutiveMissed ?? 0) - (left.consecutiveMissed ?? 0);
      }

      return new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime();
    });

  return {
    owners,
    items: filteredItems,
    stats: {
      total: filteredItems.length,
      due: filteredItems.filter((item) => item.isReminderDue).length,
      attendance: filteredItems.filter((item) => item.sourceType === "ATTENDANCE").length,
      prayer: filteredItems.filter((item) => item.sourceType === "PRAYER").length,
      unassigned: filteredItems.filter((item) => !item.ownerId).length,
    },
  };
}

async function getAttendanceCareItems({
  role,
  cellGroupId,
  now,
}: {
  role: "ADMIN" | "CELL_LEADER";
  cellGroupId: string | null;
  now: Date;
}) {
  const members = await getMembersNeedingCare({
    cellGroupId: role === "CELL_LEADER" ? cellGroupId ?? undefined : undefined,
  });

  if (members.length === 0) {
    return [];
  }

  const careCases = await db.careCase.findMany({
    where: {
      category: CARE_CATEGORY_ATTENDANCE,
      memberId: { in: members.map((member) => member.id) },
    },
    include: {
      assignedOwner: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  const careCaseByMemberId = new Map(
    careCases
      .filter((careCase) => careCase.memberId)
      .map((careCase) => [careCase.memberId as string, careCase])
  );

  return members.map((member): CareQueueItem => {
    const careCase = careCaseByMemberId.get(member.id) ?? null;
    const reminderAt = toIsoOrNull(careCase?.reminderAt);

    return {
      key: `attendance:${member.id}`,
      sourceType: "ATTENDANCE",
      sourceId: member.id,
      careCaseId: careCase?.id ?? null,
      title: `${member.firstName} ${member.lastName}`,
      email: member.email,
      phone: member.phone,
      ownerId: careCase?.assignedOwnerId ?? null,
      owner: careCase?.assignedOwner ?? null,
      lastContactedAt: toIsoOrNull(careCase?.lastContactedAt),
      notes: careCase?.notes ?? null,
      nextAction: careCase?.nextAction ?? null,
      reminderAt,
      openedAt: careCase?.createdAt.toISOString() ?? now.toISOString(),
      isReminderDue: reminderAt ? new Date(reminderAt) <= now : false,
      memberId: member.id,
      memberLink: `/portal/directory?memberId=${member.id}`,
      consecutiveMissed: member.consecutiveMissed,
      cellGroupName: member.cellGroupName,
    };
  });
}

async function getPrayerCareItems({
  bucket,
  now,
}: {
  bucket: "open" | "archive";
  now: Date;
}) {
  const prayers = await db.prayerRequest.findMany({
    where: { isAnswered: bucket === "archive" },
    orderBy:
      bucket === "archive"
        ? [{ answeredAt: "desc" }, { submittedAt: "desc" }]
        : [{ submittedAt: "desc" }],
    take: 100,
    include: {
      followUpOwner: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      careCase: {
        include: {
          assignedOwner: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      },
    },
  });

  return prayers.map((prayer): CareQueueItem => {
    const reminderAt = toIsoOrNull(prayer.careCase?.reminderAt);
    const owner = prayer.careCase?.assignedOwner ?? prayer.followUpOwner ?? null;
    const ownerId = prayer.careCase?.assignedOwnerId ?? prayer.followUpOwnerId ?? null;

    return {
      key: `prayer:${prayer.id}`,
      sourceType: "PRAYER",
      sourceId: prayer.id,
      careCaseId: prayer.careCase?.id ?? null,
      title: prayer.name,
      email: prayer.email,
      phone: null,
      ownerId,
      owner,
      lastContactedAt: toIsoOrNull(prayer.careCase?.lastContactedAt),
      notes: prayer.careCase?.notes ?? null,
      nextAction: prayer.careCase?.nextAction ?? null,
      reminderAt,
      openedAt: prayer.submittedAt.toISOString(),
      isReminderDue: bucket === "open" && reminderAt ? new Date(reminderAt) <= now : false,
      prayerStatus: prayer.status,
      prayerRequest: prayer.request,
      isPrivate: prayer.isPrivate,
      answeredAt: toIsoOrNull(prayer.answeredAt),
    };
  });
}
