// app/routes/portal/profile.tsx
import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { useRef } from "react";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";
import { describedBy, useFocusFirstInvalidField, ValidationSummary } from "~/components/ui/FormAccessibility";
import { PendingButton } from "~/components/ui/PendingButton";

export const meta: MetaFunction = () => [
  { title: "My Profile — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, phone: true, age: true,
      gender: true, birthday: true, role: true,
      createdAt: true,
      cellGroup: { select: { id: true, name: true } },
    },
  });

  if (!fullUser) throw new Response("User not found", { status: 404 });

  return {
    user: {
      ...fullUser,
      birthday:  fullUser.birthday instanceof Date
        ? fullUser.birthday.toISOString().slice(0, 10)
        : String(fullUser.birthday).slice(0, 10),
      createdAt: fullUser.createdAt instanceof Date
        ? fullUser.createdAt.toISOString()
        : String(fullUser.createdAt),
    },
  };
}

const ProfileUpdateSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName:  z.string().min(1).max(50),
  email:     z.string().email().optional().or(z.literal("")),
  phone:     z.string().regex(/^[0-9+\s\-(). ]{7,20}$/).optional().or(z.literal("")),
  age:       z.coerce.number().int().min(5).max(120),
  birthday:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword:     z.string().min(8, "Must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ActionData =
  | { success: true; message: string }
  | { success: false; errors: Record<string, string[]>; intent: string }
  | { success: false; globalError: string; intent: string };

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent   = formData.get("intent") as string;

  if (intent === "updateProfile") {
    const raw = {
      firstName: formData.get("firstName") as string,
      lastName:  formData.get("lastName") as string,
      email:     (formData.get("email") as string) ?? "",
      phone:     (formData.get("phone") as string) ?? "",
      age:       formData.get("age") as string,
      birthday:  formData.get("birthday") as string,
    };
    const result = ProfileUpdateSchema.safeParse(raw);
    if (!result.success) {
      return { success: false, errors: result.error.flatten().fieldErrors, intent } satisfies ActionData;
    }

    const { firstName, lastName, email, phone, age, birthday } = result.data;
    await db.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        email:    email || null,
        phone:    phone || null,
        age,
        birthday: new Date(birthday),
      },
    });
    return { success: true, message: "Profile updated successfully." } satisfies ActionData;
  }

  if (intent === "changePassword") {
    const raw = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword:     formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };
    const result = PasswordChangeSchema.safeParse(raw);
    if (!result.success) {
      return { success: false, errors: result.error.flatten().fieldErrors, intent } satisfies ActionData;
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser) throw new Response("Not found", { status: 404 });

    const valid = await verify(dbUser.passwordHash, result.data.currentPassword, {
      memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1,
    });
    if (!valid) {
      return {
        success: false,
        globalError: "Current password is incorrect.",
        intent,
      } satisfies ActionData;
    }

    const newHash = await hash(result.data.newPassword, {
      memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1,
    });
    await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    return { success: true, message: "Password changed successfully." } satisfies ActionData;
  }

  return { success: false, globalError: "Unknown action.", intent: "" } satisfies ActionData;
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

const labelClass = "block text-sm font-sans font-bold text-gray-700 mb-1.5";

function FieldError({ errors, id }: { errors?: string[]; id?: string }) {
  if (!errors?.length) return null;
  return <p id={id} role="alert" className="mt-1.5 text-xs text-red-600 font-sans">{errors[0]}</p>;
}

export default function ProfilePage() {
  const { user }     = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigation   = useNavigation();
  const profileFormRef = useRef<HTMLFormElement>(null);
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const isSubmitting = navigation.state === "submitting";

  const profileErrors = (actionData?.success === false && "errors" in actionData && actionData.intent === "updateProfile")
    ? (actionData.errors as Record<string, string[] | undefined>)
    : {};
  const passwordErrors = (actionData?.success === false && "errors" in actionData && actionData.intent === "changePassword")
    ? (actionData.errors as Record<string, string[] | undefined>)
    : {};
  const globalPasswordError = actionData?.success === false && "globalError" in actionData && actionData.intent === "changePassword"
    ? actionData.globalError : null;

  const initials = (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "");
  const joinDate = new Date(user.createdAt).toLocaleDateString("en-PH", {
    month: "long", year: "numeric",
  });

  const roleLabel =
    user.role === "ADMIN" ? "Administrator" :
    user.role === "CELL_LEADER" ? "Cell Leader" : "Member";

  useFocusFirstInvalidField({
    formRef: profileFormRef,
    errors: profileErrors,
    fieldOrder: ["firstName", "lastName", "email", "phone", "age", "birthday"],
  });

  useFocusFirstInvalidField({
    formRef: passwordFormRef,
    errors: passwordErrors,
    globalError: globalPasswordError,
    fieldOrder: ["currentPassword", "newPassword", "confirmPassword"],
  });

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      {/* Profile header */}
      <div className="flex items-center gap-5 mb-10">
        <div
          className="w-16 h-16 rounded-full bg-red-700 flex items-center justify-center
                     text-white font-serif text-2xl font-bold flex-shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-400 font-sans">
            {roleLabel}
            {user.cellGroup ? ` · ${user.cellGroup.name}` : ""}
            {" · "}Member since {joinDate}
          </p>
        </div>
      </div>

      {/* Success banner */}
      {actionData?.success && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 px-5 py-3 bg-green-50 border border-green-200 rounded-xl
                     text-sm font-sans font-bold text-green-700"
        >
          ✓ {actionData.message}
        </div>
      )}

      {/* Profile form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-7 mb-6">
        <h2 className="font-serif text-lg font-bold text-gray-800 mb-6">
          Personal Information
        </h2>
        <Form ref={profileFormRef} method="post" noValidate>
          <input type="hidden" name="intent" value="updateProfile" />
          <ValidationSummary errors={profileErrors} />

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label htmlFor="firstName" className={labelClass}>First Name</label>
              <input
                id="firstName" type="text" name="firstName"
                defaultValue={user.firstName} required
                aria-invalid={profileErrors?.firstName?.length ? true : undefined}
                aria-describedby={describedBy(profileErrors?.firstName?.length ? "firstName-error" : null)}
                className={`${inputClass} ${profileErrors?.firstName ? "border-red-300" : ""}`}
              />
              <FieldError errors={profileErrors?.firstName} id="firstName-error" />
            </div>
            <div>
              <label htmlFor="lastName" className={labelClass}>Last Name</label>
              <input
                id="lastName" type="text" name="lastName"
                defaultValue={user.lastName} required
                aria-invalid={profileErrors?.lastName?.length ? true : undefined}
                aria-describedby={describedBy(profileErrors?.lastName?.length ? "lastName-error" : null)}
                className={`${inputClass} ${profileErrors?.lastName ? "border-red-300" : ""}`}
              />
              <FieldError errors={profileErrors?.lastName} id="lastName-error" />
            </div>
          </div>

          <div className="mb-5">
            <label htmlFor="profile-email" className={labelClass}>Email Address</label>
            <input
              id="profile-email" type="email" name="email"
              defaultValue={user.email ?? ""}
              aria-invalid={profileErrors?.email?.length ? true : undefined}
              aria-describedby={describedBy(profileErrors?.email?.length ? "profile-email-error" : null)}
              className={inputClass}
            />
            <FieldError errors={profileErrors?.email} id="profile-email-error" />
          </div>

          <div className="mb-5">
            <label htmlFor="profile-phone" className={labelClass}>Phone Number</label>
            <input
              id="profile-phone" type="tel" name="phone"
              defaultValue={user.phone ?? ""}
              aria-invalid={profileErrors?.phone?.length ? true : undefined}
              aria-describedby={describedBy(profileErrors?.phone?.length ? "profile-phone-error" : null)}
              className={inputClass}
            />
            <FieldError errors={profileErrors?.phone} id="profile-phone-error" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-7">
            <div>
              <label htmlFor="profile-age" className={labelClass}>Age</label>
              <input
                id="profile-age" type="number" name="age"
                defaultValue={user.age} min={5} max={120}
                aria-invalid={profileErrors?.age?.length ? true : undefined}
                aria-describedby={describedBy(profileErrors?.age?.length ? "profile-age-error" : null)}
                className={inputClass}
              />
              <FieldError errors={profileErrors?.age} id="profile-age-error" />
            </div>
            <div>
              <label htmlFor="profile-birthday" className={labelClass}>Birthday</label>
              <input
                id="profile-birthday" type="date" name="birthday"
                defaultValue={user.birthday}
                aria-invalid={profileErrors?.birthday?.length ? true : undefined}
                aria-describedby={describedBy(profileErrors?.birthday?.length ? "profile-birthday-error" : null)}
                className={inputClass}
              />
              <FieldError errors={profileErrors?.birthday} id="profile-birthday-error" />
            </div>
          </div>

          <PendingButton
            type="submit"
            isPending={isSubmitting}
            pendingText="Saving..."
            className="px-6 py-3 bg-red-700 text-white font-sans font-bold text-sm
                       rounded-lg hover:bg-red-800 disabled:opacity-60 transition-all
                       focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Save Changes
          </PendingButton>
        </Form>
      </div>

      {/* Password change */}
      <div className="bg-white border border-gray-100 rounded-2xl p-7">
        <h2 className="font-serif text-lg font-bold text-gray-800 mb-6">
          Change Password
        </h2>
        <Form ref={passwordFormRef} method="post" noValidate>
          <input type="hidden" name="intent" value="changePassword" />
          <ValidationSummary errors={passwordErrors} globalError={globalPasswordError} />

          {globalPasswordError && (
            <div role="alert" className="mb-5 px-4 py-3 bg-red-50 border border-red-200
                                          rounded-lg text-sm font-sans text-red-700">
              {globalPasswordError}
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="currentPassword" className={labelClass}>Current Password</label>
            <input
              id="currentPassword" type="password" name="currentPassword"
              autoComplete="current-password" required
              aria-invalid={passwordErrors?.currentPassword?.length ? true : undefined}
              aria-describedby={describedBy(passwordErrors?.currentPassword?.length ? "currentPassword-error" : null)}
              className={`${inputClass} ${passwordErrors?.currentPassword ? "border-red-300" : ""}`}
            />
            <FieldError errors={passwordErrors?.currentPassword} id="currentPassword-error" />
          </div>

          <div className="mb-5">
            <label htmlFor="newPassword" className={labelClass}>New Password</label>
            <input
              id="newPassword" type="password" name="newPassword"
              autoComplete="new-password" required
              aria-invalid={passwordErrors?.newPassword?.length ? true : undefined}
              aria-describedby={describedBy(passwordErrors?.newPassword?.length ? "newPassword-error" : null)}
              className={`${inputClass} ${passwordErrors?.newPassword ? "border-red-300" : ""}`}
            />
            <FieldError errors={passwordErrors?.newPassword} id="newPassword-error" />
          </div>

          <div className="mb-7">
            <label htmlFor="confirmPassword" className={labelClass}>Confirm New Password</label>
            <input
              id="confirmPassword" type="password" name="confirmPassword"
              autoComplete="new-password" required
              aria-invalid={passwordErrors?.confirmPassword?.length ? true : undefined}
              aria-describedby={describedBy(passwordErrors?.confirmPassword?.length ? "confirmPassword-error" : null)}
              className={`${inputClass} ${passwordErrors?.confirmPassword ? "border-red-300" : ""}`}
            />
            <FieldError errors={passwordErrors?.confirmPassword} id="confirmPassword-error" />
          </div>

          <PendingButton
            type="submit"
            isPending={isSubmitting}
            pendingText="Updating..."
            className="px-6 py-3 bg-gray-800 text-white font-sans font-bold text-sm
                       rounded-lg hover:bg-gray-900 disabled:opacity-60 transition-all
                       focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Update Password
          </PendingButton>
        </Form>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="members"
        title="Profile unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
      />
    </div>
  );
}
