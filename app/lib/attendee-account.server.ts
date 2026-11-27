import { createHash, randomBytes } from "node:crypto";
import { db } from "~/lib/db.server";
import { hashPassword } from "~/lib/password-hash.server";
import { sendAttendeeAccountSetupEmail } from "~/lib/email.server";
import { attendeeUsernameBase } from "~/lib/attendee-username";

const USERNAME_MAX_LENGTH = 40;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAttendeeProfile({
  firstName,
  lastName,
  category,
  cellGroupId,
  guardianProfileId,
  email,
  appOrigin,
}: {
  firstName: string;
  lastName: string;
  category: "ADULT" | "YOUNG_PROFESSIONAL" | "KIDS";
  cellGroupId: string | null;
  guardianProfileId: string | null;
  email: string | null;
  appOrigin: string;
}) {
  const normalizedEmail = email?.trim().toLowerCase() || null;
  const shouldCreateLogin = category !== "KIDS" && Boolean(normalizedEmail);
  if (shouldCreateLogin && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
    throw new Error("Account setup email is not configured. Save this person as a roster-only attendee or configure RESEND_API_KEY and EMAIL_FROM.");
  }

  if (normalizedEmail) {
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error("That email already belongs to a portal account. Search the roster or ask an admin to link the existing account.");
    }
  }

  if (!shouldCreateLogin) {
    const attendee = await db.attendeeProfile.create({
      data: {
        firstName,
        lastName,
        category,
        cellGroupId,
        guardianProfileId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        category: true,
        cellGroupId: true,
        guardianProfileId: true,
      },
    });
    return { attendee, username: null, inviteSent: false };
  }

  const baseUsername = attendeeUsernameBase(firstName, lastName);
  const randomPassword = randomBytes(48).toString("base64url");
  const passwordHash = await hashPassword(randomPassword);
  const setupToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(setupToken);

  let created: Awaited<ReturnType<typeof db.$transaction>> | null = null;
  let username = baseUsername;
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    username = suffix === 1 ? baseUsername : `${baseUsername.slice(0, USERNAME_MAX_LENGTH - String(suffix).length)}${suffix}`;
    if (await db.user.findUnique({ where: { username }, select: { id: true } })) continue;

    try {
      created = await db.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            firstName,
            lastName,
            email: normalizedEmail,
            username,
            passwordHash,
            age: null,
            gender: null,
            birthday: null,
            role: "ATTENDEE",
            isEmailVerified: false,
            cellGroupId,
            attendeeProfile: {
              create: {
                firstName,
                lastName,
                category,
                cellGroupId,
                guardianProfileId,
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            attendeeProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                category: true,
                cellGroupId: true,
                guardianProfileId: true,
              },
            },
          },
        });
        await transaction.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            purpose: "ACCOUNT_SETUP",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        return user;
      });
      break;
    } catch (error) {
      if (isUniqueConstraintError(error, "username")) continue;
      throw error;
    }
  }

  if (!created || typeof created !== "object" || !("attendeeProfile" in created) || !created.attendeeProfile) {
    throw new Error("Could not generate an available username. Please try again.");
  }

  const user = created as {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    username: string | null;
    attendeeProfile: {
      id: string;
      firstName: string;
      lastName: string;
      category: string | null;
      cellGroupId: string | null;
      guardianProfileId: string | null;
    };
  };
  const setupUrl = new URL(`/auth/reset-password?token=${setupToken}`, appOrigin).toString();
  let inviteSent = false;
  try {
    await sendAttendeeAccountSetupEmail({
      toEmail: user.email!,
      recipientName: `${user.firstName} ${user.lastName}`.trim(),
      username: user.username!,
      setupUrl,
    });
    inviteSent = true;
  } catch (error) {
    console.error("[attendee-account] Setup email could not be sent:", error);
  }

  return {
    attendee: user.attendeeProfile,
    username: user.username,
    inviteSent,
  };
}

export async function resendAttendeeSetupEmail({
  attendeeProfileId,
  appOrigin,
}: {
  attendeeProfileId: string;
  appOrigin: string;
}) {
  const attendee = await db.attendeeProfile.findUnique({
    where: { id: attendeeProfileId },
    select: {
      firstName: true,
      lastName: true,
      linkedUser: {
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isEmailVerified: true,
        },
      },
    },
  });
  if (!attendee?.linkedUser || attendee.linkedUser.role !== "ATTENDEE" || !attendee.linkedUser.email || !attendee.linkedUser.username) {
    throw new Error("This attendee has no eligible login account.");
  }
  if (attendee.linkedUser.isEmailVerified) {
    throw new Error("This account is already set up.");
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Account setup email is not configured.");
  }

  const setupToken = randomBytes(32).toString("hex");
  await db.passwordResetToken.deleteMany({ where: { userId: attendee.linkedUser.id } });
  await db.passwordResetToken.create({
    data: {
      userId: attendee.linkedUser.id,
      tokenHash: hashToken(setupToken),
      purpose: "ACCOUNT_SETUP",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await sendAttendeeAccountSetupEmail({
    toEmail: attendee.linkedUser.email,
    recipientName: `${attendee.firstName} ${attendee.lastName}`.trim(),
    username: attendee.linkedUser.username,
    setupUrl: new URL(`/auth/reset-password?token=${setupToken}`, appOrigin).toString(),
  });
}

function isUniqueConstraintError(error: unknown, field: string) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002" &&
      "meta" in error &&
      JSON.stringify(error.meta).includes(field),
  );
}
