import { createHash, randomBytes } from "node:crypto";

import { db } from "~/lib/db.server";
import { sendPasswordResetEmail } from "~/lib/email.server";
import { hashPassword } from "~/lib/password-hash.server";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetForUser(
  user: { id: string; email: string; firstName: string },
  origin: string,
) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const resetUrl = `${origin}/auth/reset-password?token=${token}`;

  await db.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  await sendPasswordResetEmail(user.email, user.firstName, resetUrl);
}

export async function validatePasswordResetToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    return { ok: false as const, reason: "invalid" as const };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await db.passwordResetToken.delete({ where: { id: record.id } });
    return { ok: false as const, reason: "expired" as const };
  }

  return { ok: true as const, record };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const validated = await validatePasswordResetToken(token);
  if (!validated.ok) return validated;

  const passwordHash = await hashPassword(password);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: validated.record.userId },
      data: { passwordHash },
    });

    await tx.passwordResetToken.deleteMany({
      where: { userId: validated.record.userId },
    });

    await tx.session.deleteMany({
      where: { userId: validated.record.userId },
    });
  });

  return { ok: true as const };
}
