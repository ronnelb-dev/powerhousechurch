import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@powerhousechurch.ph";
const ADMIN_EMAIL = process.env.CHURCH_EMAIL ?? "info@powerhousechurch.ph";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendPrayerRequestConfirmation(
  to: string,
  name: string
) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "We received your prayer request — Powerhouse Church",
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for sharing your heart with us. Your prayer request has been received and will be lifted up by our pastoral team.</p>
      <p>You are seen. You are prayed for. You are not alone.</p>
      <p>In His grace,<br/>Powerhouse Church</p>
    `,
  });
}

export async function notifyAdminOfPrayerRequest(
  name: string,
  requestText: string,
  isPrivate: boolean
) {
  return resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Prayer Request — ${name}`,
    html: `
      <p><strong>From:</strong> ${name}</p>
      <p><strong>Private:</strong> ${isPrivate ? "Yes" : "No"}</p>
      <p><strong>Request:</strong></p>
      <blockquote>${requestText}</blockquote>
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

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Your visit is planned — Powerhouse Church",
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

  return resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Plan Your Visit submission — ${escapeHtml(name)}`,
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
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to Powerhouse Church, ${firstName}!`,
    html: `
      <p>Dear ${firstName},</p>
      <p>Your member account has been created. You can now log in to the Members Portal to connect with your cell group, track attendance, and participate in Daily Bread devotions.</p>
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
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your email — Powerhouse Church",
    html: `
      <p>Dear ${firstName},</p>
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
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your password — Powerhouse Church",
    html: `
      <p>Dear ${firstName},</p>
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

  return resend.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for registering for <strong>${eventTitle}</strong>.</p>
      ${statusBody}
      <p><strong>Date:</strong> ${formattedDate}</p>
      ${formattedEndDate ? `<p><strong>Ends:</strong> ${formattedEndDate}</p>` : ""}
      <p><strong>Location:</strong> ${eventLocation}</p>
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

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Reminder: ${eventTitle} is coming up — Powerhouse Church`,
    html: `
      <p>Dear ${name},</p>
      <p>This is a reminder that <strong>${eventTitle}</strong> is coming up soon.</p>
      <p><strong>Starts:</strong> ${formattedStartDate}</p>
      ${formattedEndDate ? `<p><strong>Ends:</strong> ${formattedEndDate}</p>` : ""}
      <p><strong>Location:</strong> ${eventLocation}</p>
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
