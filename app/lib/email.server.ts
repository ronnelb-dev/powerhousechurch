import {
  enqueueOutboundEmail,
  processPendingOutboundEmails,
} from "~/lib/email-queue.server";

const ADMIN_EMAIL = process.env.CHURCH_EMAIL ?? "info@powerhousechurch.ph";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtmlParagraphs(value: string) {
  return escapeHtml(value)
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br/>")}</p>`)
    .join("");
}

async function queueEmail(args: {
  to: string;
  subject: string;
  html: string;
  recipientName?: string | null;
  tag?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const job = await enqueueOutboundEmail({
    toEmail: args.to,
    recipientName: args.recipientName,
    subject: args.subject,
    html: args.html,
    tag: args.tag,
    metadata: args.metadata ?? null,
  });

  await processPendingOutboundEmails({ limit: 10 });
  return job;
}

export async function sendPrayerRequestConfirmation(
  to: string,
  name: string,
) {
  return queueEmail({
    to,
    recipientName: name,
    subject: "We received your prayer request — Powerhouse Church",
    tag: "prayer-confirmation",
    metadata: { type: "prayer_confirmation" },
    html: `
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for sharing your heart with us. Your prayer request has been received and will be lifted up by our pastoral team.</p>
      <p>You are seen. You are prayed for. You are not alone.</p>
      <p>In His grace,<br/>Powerhouse Church</p>
    `,
  });
}

export async function notifyAdminOfPrayerRequest(
  name: string,
  requestText: string,
  isPrivate: boolean,
) {
  return queueEmail({
    to: ADMIN_EMAIL,
    subject: `New Prayer Request — ${name}`,
    tag: "prayer-admin-notify",
    metadata: { type: "prayer_admin_notification", isPrivate },
    html: `
      <p><strong>From:</strong> ${escapeHtml(name)}</p>
      <p><strong>Private:</strong> ${isPrivate ? "Yes" : "No"}</p>
      <p><strong>Request:</strong></p>
      <blockquote>${escapeHtml(requestText)}</blockquote>
    `,
  });
}

export async function sendVisitPlanConfirmation(args: {
  to: string;
  firstName: string;
  preferredService: string;
  visitDate?: string;
  bringingKids: boolean;
  wantsUsherFollowUp: boolean;
  wantsPastorFollowUp: boolean;
}) {
  const {
    to,
    firstName,
    preferredService,
    visitDate,
    bringingKids,
    wantsUsherFollowUp,
    wantsPastorFollowUp,
  } = args;

  return queueEmail({
    to,
    recipientName: firstName,
    subject: "Your visit is planned — Powerhouse Church",
    tag: "visit-confirmation",
    metadata: { type: "visit_plan_confirmation", preferredService },
    html: `
      <p>Dear ${escapeHtml(firstName)},</p>
      <p>Thank you for planning your visit with Powerhouse Church. We have your details and are looking forward to welcoming you.</p>
      <p><strong>Preferred service:</strong> ${escapeHtml(preferredService)}</p>
      ${visitDate ? `<p><strong>Target visit date:</strong> ${escapeHtml(visitDate)}</p>` : ""}
      ${bringingKids ? "<p>We noted that you're bringing kids, so our team can help point you to check-in.</p>" : ""}
      ${
        wantsUsherFollowUp || wantsPastorFollowUp
          ? `<p>We also noted your follow-up request${
              wantsUsherFollowUp && wantsPastorFollowUp
                ? "s for an usher and a pastor"
                : wantsUsherFollowUp
                  ? " for an usher"
                  : " for a pastor"
            }.</p>`
          : ""
      }
      <p>If your plans change, simply reply to this email and let us know.</p>
      <p>Grace and peace,<br/>Powerhouse Church</p>
    `,
  });
}

export async function notifyAdminOfVisitPlan(args: {
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  preferredService: string;
  visitDate?: string | null;
  adultCount: number;
  isFirstTimeGuest: boolean;
  bringingKids: boolean;
  kidsCount?: number | null;
  kidsDetails?: string | null;
  wantsUsherFollowUp: boolean;
  wantsPastorFollowUp: boolean;
  notes?: string | null;
}) {
  const {
    name,
    email,
    phone,
    city,
    preferredService,
    visitDate,
    adultCount,
    isFirstTimeGuest,
    bringingKids,
    kidsCount,
    kidsDetails,
    wantsUsherFollowUp,
    wantsPastorFollowUp,
    notes,
  } = args;

  return queueEmail({
    to: ADMIN_EMAIL,
    subject: `New Plan Your Visit submission — ${escapeHtml(name)}`,
    tag: "visit-admin-notify",
    metadata: { type: "visit_plan_admin_notification", preferredService },
    html: `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
      ${city ? `<p><strong>City / Barangay:</strong> ${escapeHtml(city)}</p>` : ""}
      <p><strong>Preferred service:</strong> ${escapeHtml(preferredService)}</p>
      ${visitDate ? `<p><strong>Target visit date:</strong> ${escapeHtml(visitDate)}</p>` : ""}
      <p><strong>Adults coming:</strong> ${adultCount}</p>
      <p><strong>First-time guest:</strong> ${isFirstTimeGuest ? "Yes" : "No"}</p>
      <p><strong>Bringing kids:</strong> ${bringingKids ? "Yes" : "No"}</p>
      ${
        bringingKids
          ? `<p><strong>Kids count:</strong> ${kidsCount ?? 0}</p>${
              kidsDetails
                ? `<p><strong>Kids notes:</strong><br/>${escapeHtml(kidsDetails).replaceAll("\n", "<br/>")}</p>`
                : ""
            }`
          : ""
      }
      <p><strong>Usher follow-up requested:</strong> ${wantsUsherFollowUp ? "Yes" : "No"}</p>
      <p><strong>Pastor follow-up requested:</strong> ${wantsPastorFollowUp ? "Yes" : "No"}</p>
      ${
        notes
          ? `<p><strong>Extra notes:</strong><br/>${escapeHtml(notes).replaceAll("\n", "<br/>")}</p>`
          : ""
      }
    `,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  return queueEmail({
    to,
    recipientName: firstName,
    subject: `Welcome to Powerhouse Church, ${firstName}!`,
    tag: "welcome-email",
    metadata: { type: "welcome_email" },
    html: `
      <p>Dear ${escapeHtml(firstName)},</p>
      <p>Your member account has been created. You can now log in to the Members Portal to connect with your cell group, track attendance, and participate in Community devotions.</p>
      <p>Welcome home.</p>
      <p>— The Powerhouse Church Team</p>
    `,
  });
}

export async function sendEmailVerificationEmail(
  to: string,
  firstName: string,
  verifyUrl: string,
) {
  return queueEmail({
    to,
    recipientName: firstName,
    subject: "Verify your email — Powerhouse Church",
    tag: "verify-email",
    metadata: { type: "verify_email", verifyUrl },
    html: `
      <p>Dear ${escapeHtml(firstName)},</p>
      <p>Thanks for registering for the Powerhouse Church Members Portal.</p>
      <p>Please verify your email address before accessing the portal.</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p>${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
      <p>— The Powerhouse Church Team</p>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetUrl: string,
) {
  return queueEmail({
    to,
    recipientName: firstName,
    subject: "Reset your password — Powerhouse Church",
    tag: "password-reset",
    metadata: { type: "password_reset", resetUrl },
    html: `
      <p>Dear ${escapeHtml(firstName)},</p>
      <p>We received a request to reset your Members Portal password.</p>
      <p><a href="${resetUrl}">Reset my password</a></p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      <p>— The Powerhouse Church Team</p>
    `,
  });
}

export async function sendEventRegistrationConfirmation(args: {
  to: string;
  name: string;
  eventTitle: string;
  eventLocation: string;
  eventStartDate: Date;
  eventEndDate?: Date | null;
  status: "CONFIRMED" | "WAITLISTED";
  calendarUrl?: string;
  googleCalendarUrl?: string;
  eventUrl?: string;
}) {
  const {
    to,
    name,
    eventTitle,
    eventLocation,
    eventStartDate,
    eventEndDate,
    status,
    calendarUrl,
    googleCalendarUrl,
    eventUrl,
  } = args;
  const formattedDate = eventStartDate.toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const subject =
    status === "CONFIRMED"
      ? `RSVP confirmed for ${eventTitle} — Powerhouse Church`
      : `You are on the waitlist for ${eventTitle} — Powerhouse Church`;

  const statusBody =
    status === "CONFIRMED"
      ? "<p>Your seat has been reserved. We look forward to welcoming you.</p>"
      : "<p>The event is currently full, so we have placed you on the waitlist. We will reach out if a seat opens up.</p>";
  const formattedEndDate = eventEndDate
    ? eventEndDate.toLocaleString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const calendarLinks =
    googleCalendarUrl || calendarUrl
      ? `
        <p>
          ${googleCalendarUrl ? `<a href="${googleCalendarUrl}">Add to Google Calendar</a>` : ""}
          ${
            googleCalendarUrl && calendarUrl
              ? "&nbsp;|&nbsp;"
              : ""
          }
          ${calendarUrl ? `<a href="${calendarUrl}">Download calendar file</a>` : ""}
        </p>
      `
      : "";
  const eventLink = eventUrl
    ? `<p><a href="${eventUrl}">View event details</a></p>`
    : "";

  return queueEmail({
    to,
    recipientName: name,
    subject,
    tag: "event-registration-confirmation",
    metadata: { type: "event_registration_confirmation", eventTitle, status },
    html: `
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for registering for <strong>${escapeHtml(eventTitle)}</strong>.</p>
      ${statusBody}
      <p><strong>Date:</strong> ${formattedDate}</p>
      ${formattedEndDate ? `<p><strong>Ends:</strong> ${formattedEndDate}</p>` : ""}
      <p><strong>Location:</strong> ${escapeHtml(eventLocation)}</p>
      ${calendarLinks}
      ${eventLink}
      <p>Grace and peace,<br/>Powerhouse Church</p>
    `,
  });
}

export async function sendEventReminderEmail(args: {
  to: string;
  name: string;
  eventTitle: string;
  eventLocation: string;
  eventStartDate: Date;
  eventEndDate?: Date | null;
  calendarUrl?: string;
  googleCalendarUrl?: string;
  eventUrl?: string;
}) {
  const {
    to,
    name,
    eventTitle,
    eventLocation,
    eventStartDate,
    eventEndDate,
    calendarUrl,
    googleCalendarUrl,
    eventUrl,
  } = args;

  const formattedStartDate = eventStartDate.toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const formattedEndDate = eventEndDate
    ? eventEndDate.toLocaleString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return queueEmail({
    to,
    recipientName: name,
    subject: `Reminder: ${eventTitle} is coming up — Powerhouse Church`,
    tag: "event-reminder",
    metadata: { type: "event_reminder", eventTitle },
    html: `
      <p>Dear ${escapeHtml(name)},</p>
      <p>This is a reminder that <strong>${escapeHtml(eventTitle)}</strong> is coming up soon.</p>
      <p><strong>Starts:</strong> ${formattedStartDate}</p>
      ${formattedEndDate ? `<p><strong>Ends:</strong> ${formattedEndDate}</p>` : ""}
      <p><strong>Location:</strong> ${escapeHtml(eventLocation)}</p>
      ${
        googleCalendarUrl || calendarUrl
          ? `<p>${
              googleCalendarUrl
                ? `<a href="${googleCalendarUrl}">Add to Google Calendar</a>`
                : ""
            }${
              googleCalendarUrl && calendarUrl ? "&nbsp;|&nbsp;" : ""
            }${
              calendarUrl ? `<a href="${calendarUrl}">Download calendar file</a>` : ""
            }</p>`
          : ""
      }
      ${eventUrl ? `<p><a href="${eventUrl}">View event details</a></p>` : ""}
      <p>We look forward to seeing you.</p>
      <p>Grace and peace,<br/>Powerhouse Church</p>
    `,
  });
}

export async function sendTargetedEmail(args: {
  to: string;
  recipientName?: string | null;
  subject: string;
  body: string;
  audienceLabel: string;
}) {
  const { to, recipientName, subject, body, audienceLabel } = args;
  const greeting = recipientName?.trim() ? `Dear ${escapeHtml(recipientName.trim())},` : "Hello,";

  return queueEmail({
    to,
    recipientName,
    subject,
    tag: "targeted-email",
    metadata: { type: "targeted_email", audienceLabel },
    html: `
      <p>${greeting}</p>
      ${textToHtmlParagraphs(body)}
      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
        You are receiving this update from Powerhouse Church for: ${escapeHtml(audienceLabel)}.
      </p>
      <p>Grace and peace,<br/>Powerhouse Church</p>
    `,
  });
}
