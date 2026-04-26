import { describe, expect, it, vi } from "vitest";
import { handleLoginSubmission, handleRegisterSubmission } from "~/lib/auth-actions.server";

describe("handleLoginSubmission", () => {
  it("returns a verification prompt for unverified users", async () => {
    const result = await handleLoginSubmission(
      { identifier: "user@example.com", password: "Secret123" },
      {
        db: {
          user: {
            findFirst: vi.fn().mockResolvedValue({
              id: "user_1",
              email: "user@example.com",
              phone: null,
              passwordHash: "hashed",
              firstName: "Jane",
              lastName: "Doe",
              age: 30,
              gender: "FEMALE",
              birthday: new Date("1994-01-01"),
              isEmailVerified: false,
            }),
          },
        },
        verifyPassword: vi.fn().mockResolvedValue(true),
        createSession: vi.fn(),
      },
    );

    expect(result).toEqual({
      error: "Please verify your email before accessing the portal.",
      needsVerification: true,
      email: "user@example.com",
    });
  });

  it("redirects verified users into the portal", async () => {
    const createSession = vi.fn().mockResolvedValue({
      sessionId: "session_1",
      cookie: "session=value",
    });

    const result = await handleLoginSubmission(
      { identifier: "user@example.com", password: "Secret123" },
      {
        db: {
          user: {
            findFirst: vi.fn().mockResolvedValue({
              id: "user_1",
              email: "user@example.com",
              phone: null,
              passwordHash: "hashed",
              firstName: "Jane",
              lastName: "Doe",
              age: 30,
              gender: "FEMALE",
              birthday: new Date("1994-01-01"),
              isEmailVerified: true,
            }),
          },
        },
        verifyPassword: vi.fn().mockResolvedValue(true),
        createSession,
      },
    );

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      throw new Error("Expected a redirect response");
    }

    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("/portal/dashboard");
    expect(result.headers.get("Set-Cookie")).toBe("session=value");
    expect(createSession).toHaveBeenCalledWith("user_1");
  });
});

describe("handleRegisterSubmission", () => {
  const baseFields = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "09123456789",
    password: "Secret123",
    confirmPassword: "Secret123",
    age: "31",
    gender: "FEMALE",
    birthday: "1993-07-15",
  };

  it("returns a duplicate-account error when the email already exists", async () => {
    const result = await handleRegisterSubmission(
      baseFields,
      "https://example.com/auth/register",
      {
        db: {
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
            create: vi.fn(),
            delete: vi.fn(),
          },
        } as any,
        hashPassword: vi.fn(),
        sendVerificationEmailForUser: vi.fn(),
      },
    );

    expect(result).toEqual({
      success: false,
      globalError:
        "An account with that email or phone already exists. Please log in instead.",
    });
  });

  it("rolls back the user if verification email delivery fails", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      firstName: "Jane",
    });
    const remove = vi.fn().mockResolvedValue(undefined);

    const result = await handleRegisterSubmission(
      baseFields,
      "https://example.com/auth/register",
      {
        db: {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create,
            delete: remove,
          },
        } as any,
        hashPassword: vi.fn().mockResolvedValue("hashed-password"),
        sendVerificationEmailForUser: vi
          .fn()
          .mockRejectedValue(new Error("mailer down")),
      },
    );

    expect(create).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith({ where: { id: "user_1" } });
    expect(result).toEqual({
      success: false,
      globalError:
        "We could not send the verification email right now. Please try again.",
    });
  });
});
