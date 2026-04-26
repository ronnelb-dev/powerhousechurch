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
import { z } from "zod";

import { getSession } from "~/lib/auth.server";
import {
  resetPasswordWithToken,
  validatePasswordResetToken,
} from "~/lib/password-reset.server";

export const meta: MetaFunction = () => [
  { title: "Reset Password — Powerhouse Church Members Portal" },
];

const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type LoaderData =
  | { token: string; tokenValid: true }
  | { token: string; tokenValid: false; tokenError: string };

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const { user } = await getSession(request);
  if (user?.isEmailVerified) {
    throw redirect("/portal/dashboard");
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return {
      token,
      tokenValid: false,
      tokenError: "This password reset link is missing its token.",
    };
  }

  const result = await validatePasswordResetToken(token);
  if (!result.ok) {
    return {
      token,
      tokenValid: false,
      tokenError:
        result.reason === "expired"
          ? "This password reset link has expired."
          : "This password reset link is invalid.",
    };
  }

  return { token, tokenValid: true };
}

type ActionData =
  | { success: false; globalError: string; errors?: Record<string, string[]> }
  | { success: true; message: string };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = (formData.get("token") as string | null)?.trim() ?? "";
  const raw = {
    password: (formData.get("password") as string | null) ?? "",
    confirmPassword: (formData.get("confirmPassword") as string | null) ?? "",
  };

  if (!token) {
    return {
      success: false,
      globalError: "The password reset token is missing.",
    } satisfies ActionData;
  }

  const parsed = ResetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      globalError: "Please correct the form and try again.",
      errors: parsed.error.flatten().fieldErrors,
    } satisfies ActionData;
  }

  const result = await resetPasswordWithToken(token, parsed.data.password);
  if (!result.ok) {
    return {
      success: false,
      globalError:
        result.reason === "expired"
          ? "This password reset link has expired."
          : "This password reset link is invalid.",
    } satisfies ActionData;
  }

  return {
    success: true,
    message: "Your password has been reset. You can sign in with your new password now.",
  } satisfies ActionData;
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-xs text-red-600">{errors[0]}</p>;
}

export default function ResetPasswordPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors =
    actionData?.success === false ? actionData.errors as Record<string, string[] | undefined> | undefined : undefined;

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
            Reset Your Password
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Choose a new password for your Members Portal account.
          </p>
        </div>

        <div className="mt-8">
          {!loaderData.tokenValid ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loaderData.tokenError}
              </div>
              <Link
                to="/auth/forgot-password"
                className="inline-flex w-full justify-center rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800"
              >
                Request a new reset link
              </Link>
            </div>
          ) : actionData?.success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {actionData.message}
              </div>
              <Link
                to="/auth/login"
                className="inline-flex w-full justify-center rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              {actionData?.success === false && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionData.globalError}
                </div>
              )}

              <Form method="post" className="space-y-5">
                <input type="hidden" name="token" value={loaderData.token} />

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-sans font-bold text-gray-700"
                  >
                    New Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-300 ${
                      errors?.password ? "border-red-300" : "border-gray-200"
                    }`}
                    placeholder="Min. 8 characters"
                    required
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    At least 8 characters, one uppercase letter, one number.
                  </p>
                  <FieldError errors={errors?.password} />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1.5 block text-sm font-sans font-bold text-gray-700"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-300 ${
                      errors?.confirmPassword ? "border-red-300" : "border-gray-200"
                    }`}
                    placeholder="Repeat your new password"
                    required
                  />
                  <FieldError errors={errors?.confirmPassword} />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="w-full rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
                >
                  {isSubmitting ? "Resetting Password…" : "Reset Password"}
                </button>
              </Form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
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
