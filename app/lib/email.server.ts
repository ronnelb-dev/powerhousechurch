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