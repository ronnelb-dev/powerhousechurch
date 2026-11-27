export async function sendPrayerRequestConfirmation() {
  return undefined;
}

export async function notifyAdminOfPrayerRequest() {
  return undefined;
}

export async function sendVisitPlanConfirmation() {
  return undefined;
}

export async function notifyAdminOfVisitPlan() {
  return undefined;
}

export async function sendWelcomeEmail() {
  return undefined;
}

export async function sendPasswordResetEmail() {
  return undefined;
}

export async function sendAttendeeAccountSetupEmail({
  toEmail,
  recipientName,
  username,
  setupUrl,
}: {
  toEmail: string;
  recipientName: string;
  username: string;
  setupUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required to send account setup emails.");
  }

  const safeName = escapeHtml(recipientName);
  const safeUsername = escapeHtml(username);
  const safeUrl = escapeHtml(setupUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: "Set up your Powerhouse Church portal account",
      html: `<p>Hello ${safeName},</p><p>An attendee portal account was created for you.</p><p>Your username is <strong>${safeUsername}</strong>.</p><p><a href="${safeUrl}">Set your password</a></p><p>This one-time link expires in 1 hour. If you were not expecting this email, you can ignore it.</p>`,
      text: `Hello ${recipientName},\n\nAn attendee portal account was created for you. Your username is ${username}. Set your password using this one-time link: ${setupUrl}\n\nThe link expires in 1 hour. If you were not expecting this email, you can ignore it.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}.`);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function sendEventRegistrationConfirmation() {
  return undefined;
}

export async function sendEventReminderEmail() {
  return undefined;
}

export async function sendTargetedEmail() {
  return undefined;
}
