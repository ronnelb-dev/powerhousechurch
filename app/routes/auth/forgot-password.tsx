import {
  Form,
  Link,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";

import { getTrustedAppOrigin } from "~/lib/app-url.server";
import { db } from "~/lib/db.server";
import { sendPasswordResetForUser } from "~/lib/password-reset.server";
import { authRateLimiter, getClientIpAddress } from "~/lib/rate-limit.server";

export const meta: MetaFunction = () => [
  { title: "Forgot Password — Powerhouse Church Members Portal" },
];

type ActionData =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
    }
  | null;

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";

  if (!email) {
    return {
      success: false,
      message: "Enter the email address tied to your account.",
    } satisfies ActionData;
  }

  const limit = authRateLimiter.consume({
    bucket: "auth:forgot-password",
    key: `${getClientIpAddress(request)}:${email}`,
    limit: 4,
    windowMs: 30 * 60 * 1000,
  });

  if (!limit.ok) {
    return {
      success: false,
      message: `Too many reset requests from this connection. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
    } satisfies ActionData;
  }

  const user = await db.user.findFirst({
    where: {
      email,
      isActive: true,
    },
  });

  if (user?.email) {
    try {
      await sendPasswordResetForUser(
        { id: user.id, email: user.email, firstName: user.firstName },
        getTrustedAppOrigin(request.url),
      );
    } catch (error) {
      console.error("[auth.forgot-password] Failed to send reset email:", error);
      return {
        success: false,
        message: "We could not send the reset email right now. Please try again.",
      } satisfies ActionData;
    }
  }

  return {
    success: true,
    message:
      "If an active account with that email exists, a password reset link has been sent.",
  } satisfies ActionData;
}

export default function ForgotPasswordPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="text-center">
          <Link
            to="/"
            className="inline-block font-serif text-2xl font-bold text-red-800
                       hover:text-red-900 transition-colors mb-2"
          >
            Powerhouse Church
          </Link>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mb-2">
            Forgot Your Password?
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Enter your email and we will send a secure reset link.
          </p>
        </div>

        <div className="mt-8">
          {actionData && (
            <div
              className={`mb-5 rounded-lg px-4 py-3 text-sm ${
                actionData.success
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {actionData.message}
            </div>
          )}

          <Form method="post" className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-sans font-bold text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="your@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
            >
              {isSubmitting ? "Sending Reset Link…" : "Send Reset Link"}
            </button>
          </Form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Remembered your password?{" "}
          <Link
            to="/auth/login"
            className="font-bold text-red-700 transition-colors hover:text-red-900"
          >
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
