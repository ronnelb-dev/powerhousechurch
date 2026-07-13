type EnqueueEmailInput = {
  toEmail: string;
  subject: string;
  html: string;
  recipientName?: string | null;
  textBody?: string | null;
  tag?: string | null;
  metadata?: Record<string, unknown> | null;
  maxAttempts?: number;
};

export async function enqueueOutboundEmail(_input: EnqueueEmailInput) {
  return undefined;
}

export async function enqueueOutboundEmails(_inputs: EnqueueEmailInput[]) {
  return { count: 0 };
}

export async function processPendingOutboundEmails() {
  return { processed: 0, sent: 0, failed: 0, skipped: 0 };
}
