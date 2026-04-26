import {
  Form,
  Link,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  redirect,
} from "react-router";
import type { MetaFunction } from "react-router";
import { handleRegisterSubmission } from "~/lib/auth-actions.server";
import { getTrustedAppOrigin } from "~/lib/app-url.server";
import { getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { sendVerificationEmailForUser } from "~/lib/email-verification.server";
import { authRateLimiter, getClientIpAddress } from "~/lib/rate-limit.server";

export const meta: MetaFunction = () => [
  { title: "Register — Powerhouse Church Members Portal" },
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
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const limit = authRateLimiter.consume({
    bucket: "auth:register",
    key: `${getClientIpAddress(request)}:${email || "unknown"}`,
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.ok) {
    return {
      success: false,
      globalError: `Too many registration attempts from this connection. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
    };
  }

  return handleRegisterSubmission(
    {
      firstName: (formData.get("firstName") as string) ?? "",
      lastName: (formData.get("lastName") as string) ?? "",
      email,
      phone: (formData.get("phone") as string) ?? "",
      password: (formData.get("password") as string) ?? "",
      confirmPassword: (formData.get("confirmPassword") as string) ?? "",
      age: (formData.get("age") as string) ?? "",
      gender: (formData.get("gender") as string) ?? "",
      birthday: (formData.get("birthday") as string) ?? "",
    },
    getTrustedAppOrigin(request.url),
    {
      db,
      sendVerificationEmailForUser,
    },
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

const labelClass = "block text-sm font-sans font-bold text-gray-700 mb-1.5";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-600 font-sans">
      {errors[0]}
    </p>
  );
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = (actionData?.success === false && "errors" in actionData)
    ? (actionData.errors as Record<string, string[] | undefined>) : {};
  const globalError = actionData?.success === false && "globalError" in actionData
    ? actionData.globalError : null;

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block font-serif text-2xl font-bold text-red-800
                       hover:text-red-900 transition-colors mb-2"
          >
            Powerhouse Church
          </Link>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1">
            Create Your Account
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Register with your real email. Portal access starts after verification.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <Form method="post" noValidate aria-label="Registration form">
            {globalError && (
              <div
                role="alert"
                className="mb-6 px-4 py-3 bg-red-50 border border-red-200
                           rounded-lg text-sm font-sans text-red-700"
              >
                {globalError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="firstName" className={labelClass}>
                  First Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="firstName" type="text" name="firstName"
                  autoComplete="given-name" required aria-required="true"
                  aria-invalid={!!errors?.firstName}
                  className={`${inputClass} ${errors?.firstName ? "border-red-300" : ""}`}
                  placeholder="Maria"
                />
                <FieldError errors={errors?.firstName} />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="lastName" type="text" name="lastName"
                  autoComplete="family-name" required aria-required="true"
                  aria-invalid={!!errors?.lastName}
                  className={`${inputClass} ${errors?.lastName ? "border-red-300" : ""}`}
                  placeholder="Reyes"
                />
                <FieldError errors={errors?.lastName} />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="email" className={labelClass}>
                Email Address <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="email" type="email" name="email"
                autoComplete="email" required aria-required="true"
                aria-invalid={!!errors?.email}
                className={`${inputClass} ${errors?.email ? "border-red-300" : ""}`}
                placeholder="your@email.com"
              />
              <p className="mt-1.5 text-xs text-gray-400 font-sans">
                We send a verification link here before portal access is enabled.
              </p>
              <FieldError errors={errors?.email} />
            </div>

            <div className="mb-5">
              <label htmlFor="phone" className={labelClass}>
                Phone Number
              </label>
              <input
                id="phone" type="tel" name="phone"
                autoComplete="tel" aria-invalid={!!errors?.phone}
                className={`${inputClass} ${errors?.phone ? "border-red-300" : ""}`}
                placeholder="09XX XXX XXXX"
              />
              <FieldError errors={errors?.phone} />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <label htmlFor="age" className={labelClass}>
                  Age <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="age" type="number" name="age" min={5} max={120}
                  required aria-required="true" aria-invalid={!!errors?.age}
                  className={`${inputClass} ${errors?.age ? "border-red-300" : ""}`}
                  placeholder="28"
                />
                <FieldError errors={errors?.age} />
              </div>
              <div>
                <label htmlFor="gender" className={labelClass}>
                  Gender <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="gender" name="gender" required aria-required="true"
                  aria-invalid={!!errors?.gender}
                  className={`${inputClass} cursor-pointer ${errors?.gender ? "border-red-300" : ""}`}
                >
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
                <FieldError errors={errors?.gender} />
              </div>
              <div>
                <label htmlFor="birthday" className={labelClass}>
                  Birthday <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="birthday" type="date" name="birthday"
                  required aria-required="true" aria-invalid={!!errors?.birthday}
                  className={`${inputClass} ${errors?.birthday ? "border-red-300" : ""}`}
                />
                <FieldError errors={errors?.birthday} />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="password" className={labelClass}>
                Password <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="password" type="password" name="password"
                autoComplete="new-password" required aria-required="true"
                aria-invalid={!!errors?.password}
                aria-describedby="password-hint"
                className={`${inputClass} ${errors?.password ? "border-red-300" : ""}`}
                placeholder="Min. 8 characters"
              />
              <p id="password-hint" className="mt-1.5 text-xs text-gray-400 font-sans">
                At least 8 characters, one uppercase letter, one number.
              </p>
              <FieldError errors={errors?.password} />
            </div>

            <div className="mb-7">
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm Password <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="confirmPassword" type="password" name="confirmPassword"
                autoComplete="new-password" required aria-required="true"
                aria-invalid={!!errors?.confirmPassword}
                className={`${inputClass} ${errors?.confirmPassword ? "border-red-300" : ""}`}
                placeholder="Repeat your password"
              />
              <FieldError errors={errors?.confirmPassword} />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-4 bg-red-700 text-white font-sans font-bold
                         text-sm tracking-wide rounded-lg hover:bg-red-800
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {isSubmitting ? "Creating Account…" : "Create Account"}
            </button>
          </Form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400 font-sans">
          Already have an account?{" "}
          <Link
            to="/auth/login"
            className="text-red-700 font-bold hover:text-red-900 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
