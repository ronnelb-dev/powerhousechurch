import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect, useRef } from "react";
import type { MetaFunction } from "react-router";
import { toast } from "react-toastify";
import { z } from "zod";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";
import { describedBy, ValidationSummary } from "~/components/ui/FormAccessibility";
import { PendingButton } from "~/components/ui/PendingButton";
import { SectionHeader } from "~/components/ui/SectionHeader";

export const meta: MetaFunction = () => [
  { title: "Engagement Hub — Powerhouse Church Portal" },
];

const PrayerSchema = z.object({
  request: z.string().min(10, "Please share a little more detail.").max(2000),
  isPrivate: z.boolean().default(true),
});

const ServingInterestSchema = z.object({
  ministryId: z.string().optional().or(z.literal("")),
  areaOfInterest: z.string().min(2, "Tell us where you'd like to serve.").max(120),
  availability: z.string().max(300).optional().or(z.literal("")),
  experience: z.string().max(500).optional().or(z.literal("")),
  message: z.string().min(20, "Please share a few more details.").max(2000),
});

type ActionData =
  | { success: true; intent: string; message: string }
  | { success: false; intent: string; message?: string; errors?: Record<string, string[] | undefined> };

const DEFAULT_NOTIFICATION_PREFERENCES = {
  prayerUpdatesEmail: true,
  servingOpportunities: true,
  eventReminders: true,
  smsUrgentCare: false,
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);

  const [prayerRequests, ministries, servingInterests, notificationPreference] =
    await Promise.all([
      db.prayerRequest.findMany({
        where: { memberId: user.id },
        orderBy: { submittedAt: "desc" },
        take: 8,
        select: {
          id: true,
          request: true,
          status: true,
          isPrivate: true,
          isAnswered: true,
          answeredAt: true,
          submittedAt: true,
        },
      }),
      db.ministry.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, leader: true },
      }),
      db.servingInterest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          areaOfInterest: true,
          availability: true,
          status: true,
          createdAt: true,
          ministry: { select: { name: true } },
        },
      }),
      db.notificationPreference.findUnique({
        where: { userId: user.id },
        select: {
          prayerUpdatesEmail: true,
          servingOpportunities: true,
          eventReminders: true,
          smsUrgentCare: true,
        },
      }),
    ]);

  return {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    prayerRequests: prayerRequests.map((item) => ({
      ...item,
      submittedAt: item.submittedAt.toISOString(),
      answeredAt: item.answeredAt ? item.answeredAt.toISOString() : null,
    })),
    ministries,
    servingInterests: servingInterests.map((interest) => ({
      ...interest,
      createdAt: interest.createdAt.toISOString(),
    })),
    notificationPreference:
      notificationPreference ?? DEFAULT_NOTIFICATION_PREFERENCES,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "submitPrayerRequest") {
    const result = PrayerSchema.safeParse({
      request: String(formData.get("request") ?? "").trim(),
      isPrivate: formData.get("isPrivate") === "on",
    });

    if (!result.success) {
      return {
        success: false,
        intent,
        errors: result.error.flatten().fieldErrors,
      } satisfies ActionData;
    }

    await db.prayerRequest.create({
      data: {
        memberId: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        request: result.data.request,
        isPrivate: result.data.isPrivate,
      },
    });

    return {
      success: true,
      intent,
      message: "Your prayer request has been added to your history.",
    } satisfies ActionData;
  }

  if (intent === "submitServingInterest") {
    const result = ServingInterestSchema.safeParse({
      ministryId: String(formData.get("ministryId") ?? ""),
      areaOfInterest: String(formData.get("areaOfInterest") ?? "").trim(),
      availability: String(formData.get("availability") ?? "").trim(),
      experience: String(formData.get("experience") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
    });

    if (!result.success) {
      return {
        success: false,
        intent,
        errors: result.error.flatten().fieldErrors,
      } satisfies ActionData;
    }

    await db.servingInterest.create({
      data: {
        userId: user.id,
        ministryId: result.data.ministryId || null,
        areaOfInterest: result.data.areaOfInterest,
        availability: result.data.availability || null,
        experience: result.data.experience || null,
        message: result.data.message,
      },
    });

    return {
      success: true,
      intent,
      message: "Your serving interest was shared with the team.",
    } satisfies ActionData;
  }

  if (intent === "saveNotificationPreferences") {
    await db.notificationPreference.upsert({
      where: { userId: user.id },
      update: {
        prayerUpdatesEmail: formData.get("prayerUpdatesEmail") === "on",
        servingOpportunities: formData.get("servingOpportunities") === "on",
        eventReminders: formData.get("eventReminders") === "on",
        smsUrgentCare: formData.get("smsUrgentCare") === "on",
      },
      create: {
        userId: user.id,
        prayerUpdatesEmail: formData.get("prayerUpdatesEmail") === "on",
        servingOpportunities: formData.get("servingOpportunities") === "on",
        eventReminders: formData.get("eventReminders") === "on",
        smsUrgentCare: formData.get("smsUrgentCare") === "on",
      },
    });

    return {
      success: true,
      intent,
      message: "Notification preferences updated.",
    } satisfies ActionData;
  }

  return {
    success: false,
    intent,
    message: "Unknown action.",
  } satisfies ActionData;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(status: string) {
  switch (status) {
    case "ANSWERED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ONGOING":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "FOLLOW_UP":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

function SectionMessage({
  actionData,
  intent,
}: {
  actionData: ActionData | undefined;
  intent: string;
}) {
  if (!actionData || actionData.intent !== intent) return null;
  if (actionData.success) return null;

  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-sans text-red-700">
      {actionData.message ?? "Please review the form and try again."}
    </div>
  );
}

function FieldError({
  errors,
  id,
}: {
  errors?: string[];
  id?: string;
}) {
  if (!errors?.length) return null;
  return <p id={id} className="mt-1.5 text-xs font-sans text-red-600">{errors[0]}</p>;
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300";

export default function EngagementPage() {
  const {
    user,
    prayerRequests,
    ministries,
    servingInterests,
    notificationPreference,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const lastSuccessRef = useRef<object | null>(null);

  useEffect(() => {
    if (navigation.state === "submitting") {
      lastSuccessRef.current = null;
    }
  }, [navigation.state]);

  useEffect(() => {
    if (
      navigation.state !== "idle" ||
      !actionData?.success ||
      lastSuccessRef.current === actionData
    ) {
      return;
    }

    lastSuccessRef.current = actionData;
    toast.success(actionData.message, { role: "status" });
  }, [actionData, navigation.state]);

  const prayerErrors: Record<string, string[] | undefined> =
    actionData?.success === false && actionData.intent === "submitPrayerRequest"
      ? actionData.errors ?? {}
      : {};
  const servingErrors: Record<string, string[] | undefined> =
    actionData?.success === false && actionData.intent === "submitServingInterest"
      ? actionData.errors ?? {}
      : {};

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <SectionHeader
        eyebrow="Members Portal"
        title="Engagement Hub"
        subtitle="Keep your prayers, serving interests, and communication preferences in one place."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
            Prayer History
          </p>
          <p className="mt-2 font-serif text-3xl font-bold text-gray-900">
            {prayerRequests.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
            Serving Forms
          </p>
          <p className="mt-2 font-serif text-3xl font-bold text-gray-900">
            {servingInterests.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
            Profile Email
          </p>
          <p className="mt-2 text-sm font-sans font-bold text-gray-800">
            {user.email ?? "Add one in your profile"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-3xl border border-gray-100 bg-white p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-gray-900">
                Prayer Requests
              </h2>
              <p className="mt-1 text-sm font-sans text-gray-500">
                Submit new requests here and keep a visible history of the ones you have shared.
              </p>
            </div>
            <Link
              to="/prayer-request"
              className="rounded-full border border-red-200 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-red-700 hover:bg-red-50"
            >
              Public form
            </Link>
          </div>

          <SectionMessage actionData={actionData} intent="submitPrayerRequest" />

          <Form method="post" className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
            <input type="hidden" name="intent" value="submitPrayerRequest" />
            <ValidationSummary errors={prayerErrors} />
            <label className="block text-xs font-bold uppercase tracking-[0.14em] text-red-700">
              New request
            </label>
            <textarea
              id="engagement-prayer-request"
              name="request"
              rows={4}
              maxLength={2000}
              placeholder="Share what you would like the pastoral team to pray for."
              aria-invalid={prayerErrors.request?.length ? true : undefined}
              aria-describedby={describedBy(prayerErrors.request?.length ? "engagement-prayer-request-error" : null)}
              className={`${inputClass} mt-2`}
            />
            <FieldError errors={prayerErrors.request} id="engagement-prayer-request-error" />

            <label className="mt-4 inline-flex items-start gap-3 text-sm text-gray-600">
              <input
                type="checkbox"
                name="isPrivate"
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
              />
              <span>Keep this request private to the pastoral team.</span>
            </label>

            <PendingButton
              type="submit"
              isPending={navigation.state === "submitting"}
              pendingText="Submitting..."
              className="mt-4 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"
            >
              Submit request
            </PendingButton>
          </Form>

          <div className="mt-5 space-y-3">
            {prayerRequests.length > 0 ? (
              prayerRequests.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${statusTone(item.status)}`}>
                      {item.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {item.isPrivate ? "Private" : "Shareable"}
                    </span>
                    <span className="text-xs text-gray-400">
                      Submitted {formatDate(item.submittedAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-gray-700">{item.request}</p>
                  {item.answeredAt ? (
                    <p className="mt-3 text-xs font-bold text-emerald-700">
                      Answered on {formatDate(item.answeredAt)}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                icon="generic"
                title="No prayer history yet"
                message="Your submitted prayer requests will appear here."
              />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6">
          <div className="mb-5">
            <h2 className="font-serif text-2xl font-bold text-gray-900">
              Notification Preferences
            </h2>
            <p className="mt-1 text-sm font-sans text-gray-500">
              Choose how the church stays in touch with you.
            </p>
          </div>

          <SectionMessage actionData={actionData} intent="saveNotificationPreferences" />

          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="saveNotificationPreferences" />

            {[
              ["prayerUpdatesEmail", "Email me about updates to my prayer requests."],
              ["servingOpportunities", "Notify me when serving opportunities open up."],
              ["eventReminders", "Keep me updated on church events and reminders."],
              ["smsUrgentCare", "Text me for urgent pastoral care follow-up."],
            ].map(([name, label]) => (
              <label key={name} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={notificationPreference[name as keyof typeof notificationPreference]}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
                />
                <span>{label}</span>
              </label>
            ))}

            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
            >
              Save preferences
            </button>
          </Form>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-6">
        <div className="mb-5">
          <h2 className="font-serif text-2xl font-bold text-gray-900">
            Serving Interest
          </h2>
          <p className="mt-1 text-sm font-sans text-gray-500">
            Let the team know where you feel called, how you can help, and when you are available.
          </p>
        </div>

        <SectionMessage actionData={actionData} intent="submitServingInterest" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <Form method="post" className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <input type="hidden" name="intent" value="submitServingInterest" />
            <ValidationSummary errors={servingErrors} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                  Ministry
                </label>
                <select id="serving-ministry" name="ministryId" className={inputClass}>
                  <option value="">I am still exploring</option>
                  {ministries.map((ministry) => (
                    <option key={ministry.id} value={ministry.id}>
                      {ministry.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                  Area of interest
                </label>
                <input
                  id="serving-areaOfInterest"
                  type="text"
                  name="areaOfInterest"
                  placeholder="Prayer, worship, ushering, media..."
                  aria-invalid={servingErrors.areaOfInterest?.length ? true : undefined}
                  aria-describedby={describedBy(servingErrors.areaOfInterest?.length ? "serving-areaOfInterest-error" : null)}
                  className={inputClass}
                />
                <FieldError errors={servingErrors.areaOfInterest} id="serving-areaOfInterest-error" />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                Availability
              </label>
              <input
                id="serving-availability"
                type="text"
                name="availability"
                placeholder="Sunday mornings, weekday evenings, twice a month..."
                aria-invalid={servingErrors.availability?.length ? true : undefined}
                aria-describedby={describedBy(servingErrors.availability?.length ? "serving-availability-error" : null)}
                className={inputClass}
              />
              <FieldError errors={servingErrors.availability} id="serving-availability-error" />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                Experience or strengths
              </label>
              <textarea
                id="serving-experience"
                name="experience"
                rows={3}
                placeholder="Share any past experience, training, or gifts you would like us to know about."
                aria-invalid={servingErrors.experience?.length ? true : undefined}
                aria-describedby={describedBy(servingErrors.experience?.length ? "serving-experience-error" : null)}
                className={inputClass}
              />
              <FieldError errors={servingErrors.experience} id="serving-experience-error" />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                Why you want to serve
              </label>
              <textarea
                id="serving-message"
                name="message"
                rows={4}
                placeholder="Tell us what is stirring in your heart and how we can help you take a next step."
                aria-invalid={servingErrors.message?.length ? true : undefined}
                aria-describedby={describedBy(servingErrors.message?.length ? "serving-message-error" : null)}
                className={inputClass}
              />
              <FieldError errors={servingErrors.message} id="serving-message-error" />
            </div>

            <PendingButton
              type="submit"
              isPending={navigation.state === "submitting"}
              pendingText="Sending..."
              className="mt-4 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800"
            >
              Send serving interest
            </PendingButton>
          </Form>

          <div className="space-y-3">
            {servingInterests.length > 0 ? (
              servingInterests.map((interest) => (
                <div key={interest.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${statusTone(interest.status)}`}>
                      {interest.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs text-gray-400">
                      Submitted {formatDate(interest.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-bold text-gray-900">
                    {interest.ministry?.name ?? interest.areaOfInterest}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{interest.areaOfInterest}</p>
                  {interest.availability ? (
                    <p className="mt-3 text-sm text-gray-700">
                      Availability: {interest.availability}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                icon="generic"
                title="No serving interest submitted yet"
                message="When you send a serving interest form, it will appear here for easy follow-up."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="generic"
        title="Engagement hub unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
      />
    </div>
  );
}
