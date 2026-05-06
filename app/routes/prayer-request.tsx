// app/routes/prayer-request.tsx
import { useRef } from "react";
import {
  Form,
  useActionData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { useFocusFirstInvalidField, ValidationSummary } from "~/components/ui/FormAccessibility";
import { db } from "~/lib/db.server";
import { sendPrayerRequestConfirmation, notifyAdminOfPrayerRequest } from "~/lib/email.server";
import { PageHero } from "~/components/ui/PageHero";
import { PendingButton } from "~/components/ui/PendingButton";
import { getSession } from "~/lib/auth.server";
import { handlePrayerRequestSubmission } from "~/lib/public-submissions.server";
import {
  getClientIpAddress,
  publicSubmissionRateLimiter,
} from "~/lib/rate-limit.server";

export const meta: MetaFunction = () => [
  { title: "Prayer Request — Powerhouse Church" },
  { name: "description", content: "Submit a prayer request to the Powerhouse Church pastoral team." },
];

type ActionData =
  | { success: true }
  | { success: false; errors: Record<string, string[]> };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { user } = await getSession(request);

  const raw = {
    name:      formData.get("name") as string,
    email:     (formData.get("email") as string) ?? "",
    request:   formData.get("request") as string,
    isPrivate: formData.get("isPrivate") === "on",
    honeypot:  (formData.get("honeypot") as string) ?? "",
  };
  const limit = publicSubmissionRateLimiter.consume({
    bucket: "public:prayer-request",
    key: getClientIpAddress(request),
    limit: 4,
    windowMs: 30 * 60 * 1000,
  });

  if (!limit.ok) {
    return {
      success: false,
      errors: {
        request: [
          `Too many prayer requests were submitted from this connection. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
        ],
      },
    } satisfies ActionData;
  }

  return handlePrayerRequestSubmission(raw, {
    userId: user?.id,
    db,
    notifyAdminOfPrayerRequest,
    sendPrayerRequestConfirmation,
  });
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-600 font-sans flex items-center gap-1">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="6" r="6" opacity="0.2"/>
        <text x="6" y="9" textAnchor="middle" fontSize="8" fill="currentColor">!</text>
      </svg>
      {errors[0]}
    </p>
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent " +
  "transition-all";

const labelClass = "block text-sm font-sans font-bold text-gray-700 mb-1.5";

export default function PrayerRequestPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = actionData?.success === false ? actionData.errors : {};

  useFocusFirstInvalidField({
    formRef,
    errors,
    fieldOrder: ["name", "email", "request"],
  });

  if (actionData?.success) {
    return (
      <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200
                          flex items-center justify-center mx-auto mb-6"
               aria-live="polite">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="#be123c" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mb-3">
            We Received Your Request
          </h1>
          <p className="text-gray-500 font-sans text-base leading-relaxed mb-8">
            Your prayer request has been received and will be lifted up by our
            pastoral team. You are seen. You are prayed for. You are not alone.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-red-700 text-white font-sans
                       font-bold text-sm rounded-lg hover:bg-red-800 transition-colors"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHero
        title="Prayer Request"
        subtitle="Bring your burdens to the altar. Our pastoral team prays for every request submitted."
        scripture="Cast all your anxiety on him because he cares for you. — 1 Peter 5:7"
      />

      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <Form ref={formRef} method="post" noValidate aria-label="Prayer request form">
            <ValidationSummary errors={errors} className="mb-5" />
            {/* Honeypot — hidden from real users, bots fill it in */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="honeypot">Leave this blank</label>
              <input type="text" id="honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
            </div>

            {/* Name */}
            <div className="mb-5">
              <label htmlFor="name" className={labelClass}>
                Your Name <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                required
                aria-required="true"
                aria-describedby={errors.name ? "name-error" : undefined}
                aria-invalid={!!errors.name}
                className={`${inputClass} ${errors.name ? "border-red-300 focus:ring-red-400" : ""}`}
                placeholder="Your full name"
              />
              <span id="name-error"><FieldError errors={errors.name} /></span>
            </div>

            {/* Email */}
            <div className="mb-5">
              <label htmlFor="email" className={labelClass}>
                Email Address
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                name="email"
                aria-describedby={errors.email ? "email-error" : "email-hint"}
                aria-invalid={!!errors.email}
                className={`${inputClass} ${errors.email ? "border-red-300" : ""}`}
                placeholder="your@email.com"
              />
              <p id="email-hint" className="mt-1.5 text-xs text-gray-400 font-sans">
                We'll send you a confirmation if provided.
              </p>
              <span id="email-error"><FieldError errors={errors.email} /></span>
            </div>

            {/* Prayer Request */}
            <div className="mb-5">
              <label htmlFor="request" className={labelClass}>
                Your Prayer Request <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <textarea
                id="request"
                name="request"
                required
                aria-required="true"
                aria-describedby={errors.request ? "request-error" : undefined}
                aria-invalid={!!errors.request}
                rows={6}
                maxLength={2000}
                className={`${inputClass} resize-y min-h-[120px] ${errors.request ? "border-red-300" : ""}`}
                placeholder="Share your prayer request here. Be as detailed as you'd like…"
              />
              <span id="request-error"><FieldError errors={errors.request} /></span>
            </div>

            {/* Private toggle */}
            <div className="mb-8">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPrivate"
                  className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded
                             focus:ring-red-400 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-sans font-bold text-gray-700 block">
                    Keep this request private
                  </span>
                  <span className="text-xs text-gray-400 font-sans">
                    Only the pastoral team will see your request.
                  </span>
                </div>
              </label>
            </div>

            <PendingButton
              type="submit"
              isPending={isSubmitting}
              pendingText="Submitting..."
              className="w-full py-4 bg-red-700 text-white font-sans font-bold
                         text-sm tracking-wide rounded-lg hover:bg-red-800
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Submit Prayer Request
            </PendingButton>
          </Form>
        </div>

        {/* Assurance */}
        <div className="mt-8 text-center">
          <p className="font-serif italic text-gray-400 text-sm">
            "The prayer of a righteous person is powerful and effective."
            <span className="block not-italic font-sans text-xs mt-1">
              James 5:16
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          Unable to submit request
        </h1>
        <p className="text-gray-500 text-sm">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
      </div>
    </div>
  );
}
