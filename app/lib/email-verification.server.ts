import { createHash, randomBytes } from "node:crypto";

import { db } from "~/lib/db.server";
import { sendEmailVerificationEmail, sendWelcomeEmail } from "~/lib/email.server";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmailForUser(
  user: { id: string; email: string; firstName: string },
  origin: string,
) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const verifyUrl = `${origin}/auth/verify-email?token=${token}`;

  await db.emailVerificationToken.deleteMany({
    where: { userId: user.id },
  });

  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  await sendEmailVerificationEmail(user.email, user.firstName, verifyUrl);
}

export async function verifyEmailToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    return { ok: false as const, reason: "invalid" as const };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await db.emailVerificationToken.delete({ where: { id: record.id } });
    return {
      ok: false as const,
      reason: "expired" as const,
      email: record.user.email,
    };
  }

  const user = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: record.userId },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await tx.emailVerificationToken.deleteMany({
      where: { userId: record.userId },
    });

    return updatedUser;
  });

  if (user.email) {
    sendWelcomeEmail(user.email, user.firstName).catch(() => {});
  }

  return { ok: true as const, user };
}
