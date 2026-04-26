import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from "react-router";
import type { MetaFunction } from "react-router";

import { getSession, lucia } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  sendVerificationEmailForUser,
  verifyEmailToken,
} from "~/lib/email-verification.server";
import { authRateLimiter, getClientIpAddress } from "~/lib/rate-limit.server";

export const meta: MetaFunction = () => [
  { title: "Verify Email — Powerhouse Church Members Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await getSession(request);
  if (user?.isEmailVerified) {
    throw redirect("/portal/dashboard");
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token) {
    const result = await verifyEmailToken(token);

    if (result.ok) {
      const session = await lucia.createSession(result.user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      throw redirect("/portal/dashboard", {
        headers: { "Set-Cookie": sessionCookie.serialize() },
      });
    }

    return {
      email: url.searchParams.get("email") ?? user?.email ?? "",
      sent: false,
      tokenError:
        result.reason === "expired"
          ? "That verification link has expired. Request a new one below."
          : "That verification link is invalid. Request a new one below.",
    };
  }

  return {
    email: url.searchParams.get("email") ?? user?.email ?? "",
    sent: url.searchParams.get("sent") === "1",
    tokenError: null as string | null,
  };
}

type ActionData =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";

  if (!email) {
    return {
      success: false,
      message: "Enter the email address used during registration.",
    } satisfies ActionData;
  }

  const limit = authRateLimiter.consume({
    bucket: "auth:verify-email",
    key: `${getClientIpAddress(request)}:${email}`,
    limit: 4,
    windowMs: 30 * 60 * 1000,
  });

  if (!limit.ok) {
    return {
      success: false,
      message: `Too many verification email requests from this connection. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
    } satisfies ActionData;
  }

  const user = await db.user.findFirst({
    where: {
      email,
      isActive: true,
    },
  });

  if (user && !user.isEmailVerified && user.email) {
    try {
      await sendVerificationEmailForUser(
        { id: user.id, email: user.email, firstName: user.firstName },
        new URL(request.url).origin,
      );
    } catch (error) {
      console.error("[auth.verify-email] Failed to resend verification:", error);
      return {
        success: false,
        message: "We could not send the verification email right now. Please try again.",
      } satisfies ActionData;
    }
  }

  return {
    success: true,
    message:
      "If an account with that email exists and still needs verification, a fresh link has been sent.",
  } satisfies ActionData;
}

export default function VerifyEmailPage() {
  const { email, sent, tokenError } = useLoaderData<typeof loader>();
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
            Verify Your Email
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Portal access stays locked until your email address is confirmed.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {sent && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Verification email sent. Check your inbox and spam folder for the link.
            </div>
          )}

          {tokenError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {tokenError}
            </div>
          )}

          {actionData && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                actionData.success
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {actionData.message}
            </div>
          )}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700">Email on file</p>
            <p className="mt-1 break-all text-sm text-gray-500">
              {email || "Enter your registration email below to resend the link."}
            </p>
          </div>

          <Form method="post" className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-sans font-bold text-gray-700"
              >
                Resend verification link
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={email}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="your@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
            >
              {isSubmitting ? "Sending Link…" : "Resend Verification Email"}
            </button>
          </Form>

          <div className="pt-2 text-center text-sm text-gray-400">
            Already verified?{" "}
            <Link
              to="/auth/login"
              className="font-bold text-red-700 transition-colors hover:text-red-900"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
