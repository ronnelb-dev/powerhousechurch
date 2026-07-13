import {
  Form,
  Link,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { PendingButton } from "~/components/ui/PendingButton";

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

export async function action(_args: ActionFunctionArgs) {
  return {
    success: false,
    message: "Password reset by email is currently unavailable.",
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
            Password reset by email is currently unavailable.
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

            <PendingButton
              type="submit"
              isPending={isSubmitting}
              pendingText="Working..."
              className="w-full rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
            >
              Continue
            </PendingButton>
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
