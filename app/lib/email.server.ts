import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@powerhousechurch.ph";
const ADMIN_EMAIL = process.env.CHURCH_EMAIL ?? "info@powerhousechurch.ph";

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
  status: "CONFIRMED" | "WAITLISTED";
}) {
  const { to, name, eventTitle, eventLocation, eventStartDate, status } = args;
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

  return resend.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for registering for <strong>${eventTitle}</strong>.</p>
      ${statusBody}
      <p><strong>Date:</strong> ${formattedDate}</p>
      <p><strong>Location:</strong> ${eventLocation}</p>
      <p>Grace and peace,<br/>Powerhouse Church</p>
    `,
  });
}
