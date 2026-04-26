import {
  Form,
  Link,
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { buttonVariants } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/card";
import { db } from "~/lib/db.server";
import { notifyAdminOfVisitPlan, sendVisitPlanConfirmation } from "~/lib/email.server";
import {
  DEFAULT_VISIT_FORM_VALUES,
  getServiceOptions,
  handleVisitPlanSubmission,
  type VisitFormValues as FormValues,
} from "~/lib/public-submissions.server";
import { getSettings } from "~/lib/settings.server";
import {
  getClientIpAddress,
  publicSubmissionRateLimiter,
} from "~/lib/rate-limit.server";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "Plan Your Visit — Powerhouse Church" },
  {
    name: "description",
    content:
      "Plan your first visit to Powerhouse Church, choose a service, share kids info, and request follow-up from our ushers or pastors.",
  },
];

type ActionData =
  | {
      success: true;
      name: string;
      preferredService: string;
      visitDate: string | null;
      bringingKids: boolean;
      wantsUsherFollowUp: boolean;
      wantsPastorFollowUp: boolean;
    }
  | {
      success: false;
      values: FormValues;
      errors?: Record<string, string[]>;
      globalError?: string;
    };

export async function loader() {
  const settings = await getSettings();

  return {
    address: settings["church.address"] ?? "Masbate City, Masbate, Philippines",
    phone: settings["church.phone"] ?? "",
    email: settings["church.email"] ?? "",
    serviceOptions: getServiceOptions(settings),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rawValues: FormValues = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
    preferredService: String(formData.get("preferredService") ?? ""),
    visitDate: String(formData.get("visitDate") ?? ""),
    adultCount: String(formData.get("adultCount") ?? "1"),
    isFirstTimeGuest: String(formData.get("isFirstTimeGuest") ?? "yes"),
    bringingKids: formData.get("bringingKids") === "on",
    kidsCount: String(formData.get("kidsCount") ?? ""),
    kidsDetails: String(formData.get("kidsDetails") ?? ""),
    wantsUsherFollowUp: formData.get("wantsUsherFollowUp") === "on",
    wantsPastorFollowUp: formData.get("wantsPastorFollowUp") === "on",
    notes: String(formData.get("notes") ?? ""),
    honeypot: String(formData.get("honeypot") ?? ""),
  };

  const settings = await getSettings();
  const limit = publicSubmissionRateLimiter.consume({
    bucket: "public:visit-plan",
    key: getClientIpAddress(request),
    limit: 4,
    windowMs: 30 * 60 * 1000,
  });

  if (!limit.ok) {
    return data({
      success: false,
      values: rawValues,
      globalError:
        `Too many visit plans were submitted from this connection. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
    } satisfies ActionData, { status: 429 });
  }

  return handleVisitPlanSubmission(rawValues, {
    settings,
    db,
    resendApiKey: process.env.RESEND_API_KEY,
    notifyAdminOfVisitPlan,
    sendVisitPlanConfirmation,
  });
}

const STEPS = [
  {
    num: 1,
    title: "Arrive & Get Oriented",
    body: "Our welcome team will help with parking, directions, and the fastest route into the sanctuary so your first few minutes feel easy.",
  },
  {
    num: 2,
    title: "Check In If Needed",
    body: "If you submitted this form, our team will already have a heads-up. Bringing kids? We'll point you straight to the right check-in area.",
  },
  {
    num: 3,
    title: "Worship Together",
    body: "We open with Spirit-filled praise and worship. Sing, observe, pray, or take a moment to breathe. There is room for you here.",
  },
  {
    num: 4,
    title: "Hear the Word",
    body: "Expect biblical preaching that is practical, direct, and centered on Jesus. We want people to leave grounded, not just inspired.",
  },
  {
    num: 5,
    title: "Meet Real People",
    body: "After service, you can take your time, meet leaders, ask questions, and find next steps without pressure.",
  },
  {
    num: 6,
    title: "Take Your Next Step",
    body: "If you'd like, we can connect you with an usher, a pastor, or the right ministry area after your first visit.",
  },
];

const FAQS = [
  {
    q: "Is this a charismatic church?",
    a: "Yes — we are a Spirit-filled, charismatic evangelical church. We believe in the gifts of the Holy Spirit, expressive worship, and the full authority of Scripture. You're welcome here regardless of your background.",
  },
  {
    q: "Do I need to dress formally?",
    a: "Not at all. Come as you are — casual, smart-casual, whatever feels comfortable. We care far more about your heart than your outfit.",
  },
  {
    q: "What about my kids?",
    a: "We have a fully staffed Kids' Ministry for ages 3–12, running at the same time as the main service. All our children's workers are trained and background-checked. Your kids will love it.",
  },
  {
    q: "I'm not a Christian — can I still attend?",
    a: "Absolutely. Many of our most faithful members came as curious seekers first. There is zero pressure. Come, observe, ask questions, and feel the welcome.",
  },
  {
    q: "How long is the service?",
    a: "Typically 90 minutes — 30 minutes of worship, a 40-minute message, and some time for response and connection. You're free to leave at any point.",
  },
  {
    q: "Will anyone pressure me to give money?",
    a: "Never. Offering is a part of our worship, but it's always voluntary. As a first-time guest, you are our guest — giving is for our members.",
  },
];

const VISIT_BENEFITS = [
  "We can welcome you by name instead of leaving you to figure things out alone.",
  "Your preferred service helps our team prepare for seating, kids check-in, and follow-up.",
  "Optional usher or pastoral follow-up only happens if you ask for it.",
];

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-red-200">
      {errors[0]}
    </p>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white " +
  "placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-[#f3cf8e] focus:border-transparent";

export default function NewHerePage() {
  const { address, phone, email, serviceOptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const failureData = actionData?.success === false ? actionData : null;
  const values =
    failureData
      ? { ...DEFAULT_VISIT_FORM_VALUES, ...failureData.values }
      : DEFAULT_VISIT_FORM_VALUES;
  const errors =
    failureData && "errors" in failureData && failureData.errors
      ? failureData.errors
      : {};
  const globalError =
    failureData && "globalError" in failureData
      ? failureData.globalError ?? null
      : null;

  return (
    <>
      <PageHero
        title="Plan Your Visit"
        subtitle="Tell us a little about your first Sunday and we’ll make the welcome feel simple, warm, and clear."
        scripture="Come to me, all you who are weary and burdened, and I will give you rest. — Matthew 11:28"
      >
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:text-left">
          <Card className="border-white/10 bg-white/8 text-white">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f1d2a4]">
                Why Fill This Out
              </p>
              <div className="mt-5 space-y-3">
                {VISIT_BENEFITS.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left">
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#f1d2a4]" />
                    <p className="text-sm leading-6 text-[#f7ebe4]">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {serviceOptions.map((option) => (
              <div key={option.value} className="rounded-[1.6rem] border border-white/12 bg-white/10 px-5 py-4 text-left">
                <p className="text-xs uppercase tracking-[0.24em] text-[#f1d2a4]">{option.detail}</p>
                <p className="mt-2 font-serif text-2xl font-semibold text-white">{option.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
          <a href="#visit-form" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            Start My Visit Plan
          </a>
          <Link
            to="/contact"
            className={buttonVariants({
              size: "lg",
              variant: "outline",
              className: "border-white/20 bg-white/10 text-white hover:bg-white/15",
            })}
          >
            Ask a Question
          </Link>
        </div>
      </PageHero>

      <section className="shell section-gap">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <Card className="overflow-hidden bg-[linear-gradient(155deg,#fdf7f1_0%,#fff3e3_100%)]">
            <CardContent className="p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                What Happens Next
              </p>
              <h2 className="mt-4 font-serif text-4xl font-semibold text-[var(--foreground)]">
                We prepare a smoother first Sunday.
              </h2>
              <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
                This form helps us anticipate your arrival, point your family in the right direction, and only arrange follow-up if you want it.
              </p>
              <div className="mt-8 space-y-4">
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/85 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                    Address
                  </p>
                  <p className="mt-2 text-base leading-7 text-[var(--foreground)]">{address}</p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/85 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                    Need help before Sunday?
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                    {phone ? <p>{phone}</p> : null}
                    {email ? <p>{email}</p> : null}
                    {!phone && !email ? <p>Use the contact page and our team will reply.</p> : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            id="visit-form"
            className="overflow-hidden border-transparent bg-[linear-gradient(145deg,#2a1714_0%,#5b2627_56%,#7e342f_100%)] text-white shadow-[0_34px_80px_-38px_rgba(56,21,19,0.9)]"
          >
            <CardContent className="p-8">
              {actionData?.success ? (
                <div className="text-center" aria-live="polite">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#f3cf8e]/35 bg-[#f3cf8e]/18">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f3cf8e" strokeWidth="2.2" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className="mt-6 font-serif text-4xl font-semibold text-white">
                    You’re on our radar
                  </h2>
                  <p className="mt-4 text-base leading-7 text-[#f7e6df]">
                    We saved your visit details for <strong>{actionData.preferredService}</strong>
                    {actionData.visitDate ? ` on ${actionData.visitDate}` : ""}.
                  </p>
                  <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#f3cf8e]">Kids</p>
                      <p className="mt-2 text-sm leading-6 text-[#f7ebe4]">
                        {actionData.bringingKids
                          ? "We noted that you’re bringing kids and can help with check-in."
                          : "No kids details were added for this visit."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#f3cf8e]">Follow-Up</p>
                      <p className="mt-2 text-sm leading-6 text-[#f7ebe4]">
                        {actionData.wantsUsherFollowUp || actionData.wantsPastorFollowUp
                          ? "Your requested usher and/or pastoral follow-up has been noted."
                          : "No follow-up was requested, so we’ll simply be ready to welcome you."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link to="/contact" className={buttonVariants({ variant: "secondary" })}>
                      Get Directions
                    </Link>
                    <Link
                      to="/"
                      className={buttonVariants({
                        variant: "outline",
                        className: "border-white/20 bg-white/10 text-white hover:bg-white/15",
                      })}
                    >
                      Back Home
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f3cf8e]">
                      First-Time Guest Form
                    </p>
                    <h2 className="mt-4 font-serif text-4xl font-semibold text-white">
                      Tell us about your visit
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#f7e6df]">
                      Share the basics, choose a service, add kids information if needed, and opt into follow-up only if you want it.
                    </p>
                  </div>

                  {globalError ? (
                    <div
                      role="alert"
                      className="mb-6 rounded-2xl border border-[#f3cf8e]/30 bg-[#f3cf8e]/14 px-4 py-3 text-sm text-[#fff4d8]"
                    >
                      {globalError}
                    </div>
                  ) : null}

                  <Form method="post" noValidate className="space-y-6" aria-label="Plan your visit form">
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="honeypot">Leave this blank</label>
                      <input id="honeypot" name="honeypot" type="text" tabIndex={-1} autoComplete="off" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="mb-2 block text-sm font-semibold text-white">
                          Full name <span className="text-[#f3cf8e]">*</span>
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          defaultValue={values.name}
                          aria-invalid={!!errors.name}
                          className={cn(fieldClass, errors.name ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                          placeholder="Your full name"
                        />
                        <FieldError errors={errors.name} />
                      </div>
                      <div>
                        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-white">
                          Email address <span className="text-[#f3cf8e]">*</span>
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          defaultValue={values.email}
                          aria-invalid={!!errors.email}
                          className={cn(fieldClass, errors.email ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                          placeholder="you@example.com"
                        />
                        <FieldError errors={errors.email} />
                      </div>
                      <div>
                        <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-white">
                          Mobile number
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          defaultValue={values.phone}
                          aria-invalid={!!errors.phone}
                          className={cn(fieldClass, errors.phone ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                          placeholder="09xx xxx xxxx"
                        />
                        <FieldError errors={errors.phone} />
                      </div>
                      <div>
                        <label htmlFor="city" className="mb-2 block text-sm font-semibold text-white">
                          City or barangay
                        </label>
                        <input
                          id="city"
                          name="city"
                          type="text"
                          defaultValue={values.city}
                          aria-invalid={!!errors.city}
                          className={cn(fieldClass, errors.city ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                          placeholder="Where you're coming from"
                        />
                        <FieldError errors={errors.city} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                      <div>
                        <label htmlFor="preferredService" className="mb-2 block text-sm font-semibold text-white">
                          Preferred service <span className="text-[#f3cf8e]">*</span>
                        </label>
                        <select
                          id="preferredService"
                          name="preferredService"
                          required
                          defaultValue={values.preferredService}
                          aria-invalid={!!errors.preferredService}
                          className={cn(fieldClass, "appearance-none", errors.preferredService ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                        >
                          <option value="" className="text-gray-900">
                            Select a service
                          </option>
                          {serviceOptions.map((option) => (
                            <option key={option.value} value={option.value} className="text-gray-900">
                              {option.label} · {option.detail}
                            </option>
                          ))}
                        </select>
                        <FieldError errors={errors.preferredService} />
                      </div>
                      <div>
                        <label htmlFor="visitDate" className="mb-2 block text-sm font-semibold text-white">
                          Target date
                        </label>
                        <input
                          id="visitDate"
                          name="visitDate"
                          type="date"
                          defaultValue={values.visitDate}
                          aria-invalid={!!errors.visitDate}
                          className={cn(fieldClass, errors.visitDate ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                        />
                        <FieldError errors={errors.visitDate} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[0.72fr_1.28fr]">
                      <div>
                        <label htmlFor="adultCount" className="mb-2 block text-sm font-semibold text-white">
                          Adults coming <span className="text-[#f3cf8e]">*</span>
                        </label>
                        <input
                          id="adultCount"
                          name="adultCount"
                          type="number"
                          min={1}
                          max={12}
                          defaultValue={values.adultCount}
                          aria-invalid={!!errors.adultCount}
                          className={cn(fieldClass, errors.adultCount ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                        />
                        <FieldError errors={errors.adultCount} />
                      </div>
                      <fieldset className="rounded-[1.6rem] border border-white/10 bg-white/6 px-5 py-4">
                        <legend className="px-2 text-sm font-semibold text-white">
                          Is this your first time at Powerhouse?
                        </legend>
                        <div className="mt-3 flex flex-wrap gap-5">
                          {[
                            { value: "yes", label: "Yes, first time" },
                            { value: "no", label: "No, I’ve attended before" },
                          ].map((option) => (
                            <label key={option.value} className="flex items-center gap-2 text-sm text-[#f7ebe4]">
                              <input
                                type="radio"
                                name="isFirstTimeGuest"
                                value={option.value}
                                defaultChecked={values.isFirstTimeGuest === option.value}
                                className="h-4 w-4 border-white/30 text-[#f3cf8e] focus:ring-[#f3cf8e]"
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>

                    <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5">
                      <div className="flex items-start gap-3">
                        <input
                          id="bringingKids"
                          name="bringingKids"
                          type="checkbox"
                          defaultChecked={values.bringingKids}
                          className="mt-1 h-4 w-4 rounded border-white/30 text-[#f3cf8e] focus:ring-[#f3cf8e]"
                        />
                        <div>
                          <label htmlFor="bringingKids" className="text-sm font-semibold text-white">
                            We’re bringing kids
                          </label>
                          <p className="mt-1 text-sm leading-6 text-[#f7e6df]">
                            Add the headcount and any quick notes so our kids team can be ready.
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                        <div>
                          <label htmlFor="kidsCount" className="mb-2 block text-sm font-semibold text-white">
                            Number of kids
                          </label>
                          <input
                            id="kidsCount"
                            name="kidsCount"
                            type="number"
                            min={1}
                            max={12}
                            defaultValue={values.kidsCount}
                            aria-invalid={!!errors.kidsCount}
                            className={cn(fieldClass, errors.kidsCount ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                            placeholder="0"
                          />
                          <FieldError errors={errors.kidsCount} />
                        </div>
                        <div>
                          <label htmlFor="kidsDetails" className="mb-2 block text-sm font-semibold text-white">
                            Kids notes
                          </label>
                          <textarea
                            id="kidsDetails"
                            name="kidsDetails"
                            rows={3}
                            defaultValue={values.kidsDetails}
                            aria-invalid={!!errors.kidsDetails}
                            className={cn(fieldClass, "min-h-[110px] resize-y", errors.kidsDetails ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                            placeholder="Ages, allergies, or anything helpful for check-in"
                          />
                          <FieldError errors={errors.kidsDetails} />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="rounded-[1.5rem] border border-white/10 bg-white/6 px-5 py-4">
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            name="wantsUsherFollowUp"
                            defaultChecked={values.wantsUsherFollowUp}
                            className="mt-1 h-4 w-4 rounded border-white/30 text-[#f3cf8e] focus:ring-[#f3cf8e]"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-white">
                              Ask an usher to follow up
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-[#f7e6df]">
                              Helpful if you want someone ready to greet you and point you in the right direction.
                            </span>
                          </span>
                        </span>
                      </label>
                      <label className="rounded-[1.5rem] border border-white/10 bg-white/6 px-5 py-4">
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            name="wantsPastorFollowUp"
                            defaultChecked={values.wantsPastorFollowUp}
                            className="mt-1 h-4 w-4 rounded border-white/30 text-[#f3cf8e] focus:ring-[#f3cf8e]"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-white">
                              Ask a pastor to follow up
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-[#f7e6df]">
                              Choose this if you want prayer, a conversation, or extra help getting connected.
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>

                    <div>
                      <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-white">
                        Anything else we should know?
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        rows={4}
                        defaultValue={values.notes}
                        aria-invalid={!!errors.notes}
                        className={cn(fieldClass, "min-h-[120px] resize-y", errors.notes ? "border-red-300/70 ring-1 ring-red-300/60" : "")}
                        placeholder="Prayer needs, accessibility notes, or questions before you arrive"
                      />
                      <FieldError errors={errors.notes} />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="w-full rounded-full bg-[#f3cf8e] px-6 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-[#4a201d] transition hover:bg-[#f7daa3] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Saving your visit…" : "Save my visit plan"}
                    </button>
                  </Form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="shell pb-4">
        <SectionHeader
          eyebrow="Your First Sunday"
          title="What to Expect"
          subtitle="A step-by-step look at what a Sunday morning at Powerhouse Church is like."
        />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-[1.7rem] border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--ring)]"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] font-serif text-lg font-bold text-white"
                aria-hidden="true"
              >
                {step.num}
              </div>
              <h3 className="font-serif text-xl font-semibold text-[var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell section-gap" aria-labelledby="service-info-heading">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,#214437_0%,#2b1815_100%)] text-white">
          <CardContent className="grid gap-8 p-8 text-center md:grid-cols-3 md:text-left lg:p-10">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#d6a24c]">
              Service Times
            </p>
            {serviceOptions.slice(0, 2).map((option) => (
              <div key={option.value} className="mt-3">
                <p className="font-serif text-2xl font-semibold text-white">{option.label}</p>
                <p className="text-sm text-[#d8ded7]">{option.detail}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#d6a24c]">
              Location
            </p>
            <p className="font-serif text-2xl font-semibold text-white leading-snug">
              Powerhouse Church
            </p>
            <p className="mt-2 text-sm leading-7 text-[#d8ded7]">{address}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#d6a24c]">
              Questions?
            </p>
            <p className="text-sm leading-7 text-[#d8ded7]">
              Our team is happy to help before your visit.
            </p>
            <Link
              to="/contact"
              className={buttonVariants({
                variant: "secondary",
                className: "mt-4",
              })}
            >
              Contact Us
            </Link>
          </div>
          </CardContent>
        </Card>
      </section>

      <section className="shell pb-16">
        <SectionHeader
          eyebrow="Common Questions"
          title="You're Probably Wondering…"
        />
        <div className="mx-auto mt-8 max-w-3xl space-y-3">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--ring)]"
            >
              <summary
                className="flex list-none items-center justify-between px-6 py-5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--ring)] cursor-pointer"
              >
                <span className="pr-4 text-sm font-semibold text-[var(--foreground)]">
                  {faq.q}
                </span>
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-all group-open:border-[var(--ring)] group-open:text-[var(--primary)]"
                  aria-hidden="true"
                >
                  <svg
                    width="10" height="10" viewBox="0 0 10 10"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    className="transition-transform group-open:rotate-180"
                  >
                    <polyline points="2,3 5,7 8,3"/>
                  </svg>
                </span>
              </summary>
              <div className="px-6 pb-6">
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  {faq.a}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
