// app/routes/contact.tsx
import {
  Form,
  data,
  useActionData,
  useNavigation,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { getSettings } from "~/lib/settings.server";
import { PageHero } from "~/components/ui/PageHero";
import { DEFAULT_CONTACT_FORM_VALUES } from "~/lib/public-submissions";
import {
  handleContactSubmission,
} from "~/lib/public-submissions.server";
import {
  getClientIpAddress,
  publicSubmissionRateLimiter,
} from "~/lib/rate-limit.server";

export const meta: MetaFunction = () => [
  { title: "Contact — Powerhouse Church" },
  {
    name: "description",
    content: "Get in touch with Powerhouse Church. Find our address, service times, and contact form.",
  },
];

export async function loader() {
  return { settings: await getSettings() };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const raw = {
    name:     formData.get("name") as string,
    email:    formData.get("email") as string,
    subject:  formData.get("subject") as string,
    message:  formData.get("message") as string,
    honeypot: (formData.get("honeypot") as string) ?? "",
  };

  const limit = publicSubmissionRateLimiter.consume({
    bucket: "public:contact",
    key: getClientIpAddress(request),
    limit: 4,
    windowMs: 15 * 60 * 1000,
  });

  if (!limit.ok) {
    return data({
      success: false,
      values: raw,
      globalError: `Too many messages have been sent from this connection. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
    }, { status: 429 });
  }

  return handleContactSubmission(raw, {
    resendApiKey: process.env.RESEND_API_KEY,
    sendContactEmail: async ({ name, email, subject, message }) => {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@powerhousechurch.ph",
        to: process.env.CHURCH_EMAIL ?? "info@powerhousechurch.ph",
        subject: `Contact Form: ${subject}`,
        html: `
          <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr/>
          <p>${message.replace(/\n/g, "<br/>")}</p>
        `,
      });
    },
  });
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-600 font-sans">
      {errors[0]}
    </p>
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

const labelClass = "block text-sm font-sans font-bold text-gray-700 mb-1.5";

export default function ContactPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigation   = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors =
    actionData?.success === false && "errors" in actionData
      ? actionData.errors
      : {};
  const globalError =
    actionData?.success === false && "globalError" in actionData
      ? actionData.globalError
      : null;
  const values =
    actionData?.success === false && "values" in actionData
      ? { ...DEFAULT_CONTACT_FORM_VALUES, ...actionData.values }
      : DEFAULT_CONTACT_FORM_VALUES;

  return (
    <>
      <PageHero
        title="Get in Touch"
        subtitle="We'd love to hear from you. Our team aims to respond within one business day."
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Info column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Address */}
            <div>
              <p className="text-xs font-sans font-bold tracking-widest uppercase
                            text-red-600 mb-3">
                Find Us
              </p>
              <address className="not-italic text-sm font-sans text-gray-600 leading-relaxed">
                {settings["church.address"] ?? "Masbate City, Masbate, Philippines"}
              </address>
            </div>

            {/* Service Times */}
            <div>
              <p className="text-xs font-sans font-bold tracking-widest uppercase
                            text-red-600 mb-3">
                Service Times
              </p>
              <table className="text-sm font-sans w-full">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-500">Sunday</td>
                    <td className="py-2 font-bold text-gray-800 text-right">
                      {settings["service.sunday1"]} &amp; {settings["service.sunday2"]}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500">Cell Groups</td>
                    <td className="py-2 font-bold text-gray-800 text-right">
                      {settings["service.cellGroupDays"]}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Contact details */}
            <div>
              <p className="text-xs font-sans font-bold tracking-widest uppercase
                            text-red-600 mb-3">
                Contact
              </p>
              <div className="space-y-2 text-sm font-sans text-gray-600">
                {settings["church.phone"] && (
                  <p>
                    <a
                      href={`tel:${settings["church.phone"]}`}
                      className="hover:text-red-700 transition-colors"
                    >
                      {settings["church.phone"]}
                    </a>
                  </p>
                )}
                {settings["church.email"] && (
                  <p>
                    <a
                      href={`mailto:${settings["church.email"]}`}
                      className="hover:text-red-700 transition-colors"
                    >
                      {settings["church.email"]}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Social */}
            <div>
              <p className="text-xs font-sans font-bold tracking-widest uppercase
                            text-red-600 mb-3">
                Follow Along
              </p>
              <div className="flex gap-3" aria-label="Social media links">
                {[
                  { key: "social.facebook",  label: "Facebook"  },
                  { key: "social.youtube",   label: "YouTube"   },
                  { key: "social.instagram", label: "Instagram" },
                ].map(({ key, label }) =>
                  settings[key] ? (
                    <a
                      key={key}
                      href={settings[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-gray-200 rounded-lg text-xs
                                 font-sans font-bold text-gray-500 hover:border-red-300
                                 hover:text-red-700 transition-all focus:outline-none
                                 focus:ring-2 focus:ring-red-300"
                      aria-label={`Visit our ${label} page`}
                    >
                      {label}
                    </a>
                  ) : null
                )}
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="lg:col-span-3">
            {actionData?.success ? (
              <div
                className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center"
                aria-live="polite"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200
                                flex items-center justify-center mx-auto mb-4"
                     aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                       stroke="#16a34a" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 className="font-serif text-xl font-bold text-gray-900 mb-2">
                  Message Sent
                </h2>
                <p className="text-sm text-gray-500 font-sans">
                  Thank you for reaching out. We'll get back to you within one business day.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                {globalError && (
                  <div
                    role="alert"
                    className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-sans text-amber-800"
                  >
                    {globalError}
                  </div>
                )}
                <Form method="post" noValidate aria-label="Contact form">
                  {/* Honeypot */}
                  <div className="hidden" aria-hidden="true">
                    <input type="text" name="honeypot" tabIndex={-1} autoComplete="off" />
                  </div>

                  <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="name" className={labelClass}>
                        Name <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="name" type="text" name="name" required
                        defaultValue={values.name}
                        aria-required="true" aria-invalid={!!errors.name}
                        className={`${inputClass} ${errors.name ? "border-red-300" : ""}`}
                        placeholder="Your name"
                      />
                      <FieldError errors={errors.name} />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className={labelClass}>
                        Email <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="contact-email" type="email" name="email" required
                        defaultValue={values.email}
                        aria-required="true" aria-invalid={!!errors.email}
                        className={`${inputClass} ${errors.email ? "border-red-300" : ""}`}
                        placeholder="your@email.com"
                      />
                      <FieldError errors={errors.email} />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label htmlFor="subject" className={labelClass}>
                      Subject <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="subject" type="text" name="subject" required
                      defaultValue={values.subject}
                      aria-required="true" aria-invalid={!!errors.subject}
                      className={`${inputClass} ${errors.subject ? "border-red-300" : ""}`}
                      placeholder="What's this about?"
                    />
                    <FieldError errors={errors.subject} />
                  </div>

                  <div className="mb-7">
                    <label htmlFor="message" className={labelClass}>
                      Message <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="message" name="message" rows={6} required
                      defaultValue={values.message}
                      aria-required="true" aria-invalid={!!errors.message}
                      maxLength={3000}
                      className={`${inputClass} resize-y min-h-[140px] ${errors.message ? "border-red-300" : ""}`}
                      placeholder="How can we help?"
                    />
                    <FieldError errors={errors.message} />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="w-full py-4 bg-red-700 text-white font-sans font-bold
                               text-sm tracking-wide rounded-lg hover:bg-red-800
                               disabled:opacity-60 disabled:cursor-not-allowed
                               transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    {isSubmitting ? "Sending…" : "Send Message"}
                  </button>
                </Form>
              </div>
            )}
          </div>
        </div>

        {/* Map embed */}
        <div className="mt-16 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3920.0!2d123.6184!3d12.3686!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTLCsDIyJzA3LjAiTiAxMjPCsDM3JzA2LjMiRQ!5e0!3m2!1sen!2sph!4v1234567890"
            width="100%"
            height="360"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Powerhouse Church location map"
            aria-label="Map showing Powerhouse Church location in Masbate City"
          />
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
          Contact page unavailable
        </h1>
        <p className="text-gray-500 text-sm">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
      </div>
    </div>
  );
}
