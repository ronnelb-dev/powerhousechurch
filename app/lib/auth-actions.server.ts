import { redirect } from "react-router";
import { z } from "zod";

import {
  hashPassword,
  verifyPassword,
  type PasswordHashFunction,
  type PasswordVerifyFunction,
} from "~/lib/password-hash.server";

const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
    email: z.string().email("Valid email address is required"),
    phone: z
      .string()
      .regex(/^[0-9+\s\-(). ]{7,20}$/, "Invalid phone number")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
    age: z.coerce.number().int().min(5, "Age must be at least 5").max(120),
    gender: z.enum(["MALE", "FEMALE"], { message: "Select a gender" }),
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use format YYYY-MM-DD"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  age: string;
  gender: string;
  birthday: string;
};

type LoginFields = {
  identifier: string;
  password: string;
};

type UserRecord = {
  id: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  birthday: Date;
  isEmailVerified: boolean;
};

export type RegisterActionData =
  | { success: false; errors: Record<string, string[]> }
  | { success: false; globalError: string }
  | null;

export type LoginActionData =
  | { error: string; needsVerification?: false }
  | { error: string; needsVerification: true; email: string }
  | null;

type RegisterDeps = {
  db: {
    user: {
      findFirst(args: unknown): Promise<UserRecord | null>;
      create(args: unknown): Promise<UserRecord>;
      delete(args: unknown): Promise<unknown>;
    };
  };
  hashPassword?: PasswordHashFunction;
  sendVerificationEmailForUser: (
    user: { id: string; email: string; firstName: string },
    origin: string,
  ) => Promise<unknown>;
};

type LoginDeps = {
  db: {
    user: {
      findFirst(args: unknown): Promise<UserRecord | null>;
    };
  };
  verifyPassword?: PasswordVerifyFunction;
  createSession: (userId: string) => Promise<{
    sessionId: string;
    cookie: string;
  }>;
};

export async function handleRegisterSubmission(
  raw: RegisterFields,
  requestUrl: string,
  deps: RegisterDeps,
) {
  const result = registerSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    } satisfies RegisterActionData;
  }

  const { firstName, lastName, email, phone, password, age, gender, birthday } =
    result.data;

  const existing = await deps.db.user.findFirst({
    where: {
      OR: [{ email }, ...(phone ? [{ phone }] : [])],
    },
  });

  if (existing) {
    return {
      success: false,
      globalError:
        "An account with that email or phone already exists. Please log in instead.",
    } satisfies RegisterActionData;
  }

  const passwordHash = await (deps.hashPassword ?? hashPassword)(password);

  const user = await deps.db.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone: phone || null,
      passwordHash,
      age,
      gender,
      birthday: new Date(birthday),
      role: "MEMBER",
      isEmailVerified: false,
      emailVerifiedAt: null,
    },
  });

  try {
    await deps.sendVerificationEmailForUser(
      { id: user.id, email: user.email!, firstName: user.firstName },
      new URL(requestUrl).origin,
    );
  } catch (error) {
    await deps.db.user.delete({ where: { id: user.id } });
    console.error("[auth.register] Failed to send verification email:", error);
    return {
      success: false,
      globalError:
        "We could not send the verification email right now. Please try again.",
    } satisfies RegisterActionData;
  }

  return redirect(
    `/auth/verify-email?email=${encodeURIComponent(email)}&sent=1`,
  );
}

export async function handleLoginSubmission(
  raw: LoginFields,
  deps: LoginDeps,
) {
  const identifier = raw.identifier.trim();

  if (!identifier || !raw.password) {
    return { error: "Email/phone and password are required." } satisfies LoginActionData;
  }

  const user = await deps.db.user.findFirst({
    where: {
      isActive: true,
      OR: [{ email: identifier }, { phone: identifier }],
    },
  });

  if (!user) {
    return { error: "Invalid credentials. Please try again." } satisfies LoginActionData;
  }

  const validPassword = await (deps.verifyPassword ?? verifyPassword)(
    user.passwordHash,
    raw.password,
  );

  if (!validPassword) {
    return { error: "Invalid credentials. Please try again." } satisfies LoginActionData;
  }

  if (!user.isEmailVerified) {
    return {
      error: "Please verify your email before accessing the portal.",
      needsVerification: true,
      email: user.email ?? "",
    } satisfies LoginActionData;
  }

  const session = await deps.createSession(user.id);

  return redirect("/portal/dashboard", {
    headers: { "Set-Cookie": session.cookie },
  });
}
