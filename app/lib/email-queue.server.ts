import { db } from "~/lib/db.server";
import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@powerhousechurch.ph";
const resend = new Resend(process.env.RESEND_API_KEY);
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

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

type OutboundEmailRecord = {
  id: string;
  toEmail: string;
  recipientName: string | null;
  subject: string;
  html: string;
  textBody: string | null;
  tag: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
};

function getEmailModel() {
  return (db as unknown as {
    outboundEmail: {
      create(args: { data: Record<string, unknown> }): Promise<OutboundEmailRecord>;
      createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
      findMany(args: Record<string, unknown>): Promise<OutboundEmailRecord[]>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
  }).outboundEmail;
}

function getRetryDelayMs(attempts: number) {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)] ?? 24 * 60 * 60_000;
}

function truncateError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 1000);
}

export async function enqueueOutboundEmail(input: EnqueueEmailInput) {
  const model = getEmailModel();
  return model.create({
    data: {
      toEmail: input.toEmail.trim().toLowerCase(),
      recipientName: input.recipientName?.trim() || null,
      subject: input.subject,
      html: input.html,
      textBody: input.textBody ?? null,
      tag: input.tag ?? null,
      metadata: input.metadata ?? null,
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

export async function enqueueOutboundEmails(inputs: EnqueueEmailInput[]) {
  if (inputs.length === 0) return { count: 0 };
  const model = getEmailModel();
  return model.createMany({
    data: inputs.map((input) => ({
      toEmail: input.toEmail.trim().toLowerCase(),
      recipientName: input.recipientName?.trim() || null,
      subject: input.subject,
      html: input.html,
      textBody: input.textBody ?? null,
      tag: input.tag ?? null,
      metadata: input.metadata ?? null,
      maxAttempts: input.maxAttempts ?? 5,
    })),
  });
}

export async function processPendingOutboundEmails(args?: { limit?: number }) {
  const limit = args?.limit ?? 10;
  const model = getEmailModel();
  if (!process.env.RESEND_API_KEY) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const now = new Date();
  const jobs = await model.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      ],
    },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    processed += 1;
    try {
      await model.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING",
          lockedAt: new Date(),
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      await resend.emails.send({
        from: FROM,
        to: job.toEmail,
        subject: job.subject,
        html: job.html,
        text: job.textBody ?? undefined,
      });

      await model.update({
        where: { id: job.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      const nextAttempts = job.attempts + 1;
      const isTerminal = nextAttempts >= job.maxAttempts;
      await model.update({
        where: { id: job.id },
        data: {
          status: isTerminal ? "DEAD_LETTER" : "FAILED",
          lockedAt: null,
          lastError: truncateError(error),
          nextAttemptAt: new Date(Date.now() + getRetryDelayMs(nextAttempts)),
        },
      });
      failed += 1;
    }
  }

  return { processed, sent, failed, skipped };
}
