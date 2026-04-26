import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
  type ActionFunctionArgs,
  redirect,
} from "react-router";
import type { MetaFunction } from "react-router";
import { handleLoginSubmission } from "~/lib/auth-actions.server";
import { lucia, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";

export const meta: MetaFunction = () => [
  { title: "Member Login — Powerhouse Church" },
];

export async function loader({ request }: { request: Request }) {
  const { user } = await getSession(request);
  if (user) {
    throw redirect(
      user.isEmailVerified
        ? "/portal/dashboard"
        : `/auth/verify-email?email=${encodeURIComponent(user.email ?? "")}`,
    );
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  return handleLoginSubmission(
    {
      identifier: (formData.get("identifier") as string) ?? "",
      password: (formData.get("password") as string) ?? "",
    },
    {
      db,
      createSession: async (userId) => {
        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        return {
          sessionId: session.id,
          cookie: sessionCookie.serialize(),
        };
      },
    },
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block font-serif text-2xl font-bold text-red-800
                       hover:text-red-900 transition-colors mb-2"
          >
            Powerhouse Church
          </Link>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1">
            Members Portal
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Sign in to access your community
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <Form method="post" noValidate aria-label="Login form">
            {actionData?.error && (
              <div
                role="alert"
                className="mb-5 px-4 py-3 bg-red-50 border border-red-200
                           rounded-lg text-sm font-sans text-red-700"
              >
                <p>{actionData.error}</p>
                {actionData.needsVerification && (
                  <Link
                    to={`/auth/verify-email?email=${encodeURIComponent(actionData.email)}`}
                    className="mt-2 inline-flex font-bold text-red-800 hover:text-red-900"
                  >
                    Open email verification
                  </Link>
                )}
              </div>
            )}

            <div className="mb-5">
              <label
                htmlFor="identifier"
                className="block text-sm font-sans font-bold text-gray-700 mb-1.5"
              >
                Email or Phone Number
              </label>
              <input
                id="identifier"
                type="text"
                name="identifier"
                autoComplete="username"
                autoFocus
                required
                aria-required="true"
                className={inputClass}
                placeholder="your@email.com or 09XX XXX XXXX"
              />
            </div>

            <div className="mb-7">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-sans font-bold text-gray-700"
                >
                  Password
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs font-bold text-red-700 transition-colors hover:text-red-900"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                aria-required="true"
                className={inputClass}
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-4 bg-red-700 text-white font-sans font-bold
                         text-sm tracking-wide rounded-lg hover:bg-red-800
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all focus:outline-none focus:ring-2
                         focus:ring-red-400"
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </Form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400 font-sans">
          Don't have an account?{" "}
          <Link
            to="/auth/register"
            className="text-red-700 font-bold hover:text-red-900 transition-colors
                       focus:outline-none focus:underline"
          >
            Register here
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-gray-400 font-sans">
          <Link to="/" className="hover:text-gray-600 transition-colors">
            ← Back to church website
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          Login unavailable
        </h1>
        <p className="text-gray-500 text-sm">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
      </div>
    </div>
  );
}
