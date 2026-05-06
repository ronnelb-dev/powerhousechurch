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
import { requireUser } from "~/lib/auth.server";
import { uploadImageToCloudinary } from "~/lib/cloudinary.server";
import { db } from "~/lib/db.server";
import { hashPassword, verifyPassword } from "~/lib/password-hash.server";
import { EmptyState } from "~/components/ui/EmptyState";
import { describedBy, useFocusFirstInvalidField, ValidationSummary } from "~/components/ui/FormAccessibility";
import { PendingButton } from "~/components/ui/PendingButton";
import {
  PortalHeader,
  PortalPage,
  PortalPanel,
  PortalSection,
  PortalSectionHeading,
  portalButtonClasses,
} from "~/components/ui/Portal";

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
      gender: true, birthday: true, role: true, profilePhoto: true,
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
    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: { profilePhoto: true },
    });

    if (!currentUser) throw new Response("Not found", { status: 404 });

    const uploadedPhoto = await uploadImageToCloudinary(
      formData.get("profilePhoto"),
      "powerhouse/profiles",
    );

    if (!uploadedPhoto.ok) {
      return {
        success: false,
        errors: { profilePhoto: [uploadedPhoto.error] },
        intent,
      } satisfies ActionData;
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        email:    email || null,
        phone:    phone || null,
        age,
        birthday: new Date(birthday),
        profilePhoto: uploadedPhoto.secureUrl || currentUser.profilePhoto,
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

    const valid = await verifyPassword(
      dbUser.passwordHash,
      result.data.currentPassword,
    );
    if (!valid) {
      return {
        success: false,
        globalError: "Current password is incorrect.",
        intent,
      } satisfies ActionData;
    }

    const newHash = await hashPassword(result.data.newPassword);
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
  const pendingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : "";
  const isProfileSubmitting = pendingIntent === "updateProfile";
  const isPasswordSubmitting = pendingIntent === "changePassword";

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
    fieldOrder: ["profilePhoto", "firstName", "lastName", "email", "phone", "age", "birthday"],
  });

  useFocusFirstInvalidField({
    formRef: passwordFormRef,
    errors: passwordErrors,
    globalError: globalPasswordError,
    fieldOrder: ["currentPassword", "newPassword", "confirmPassword"],
  });

  return (
    <PortalPage className="max-w-3xl">
      <PortalHeader
        eyebrow="Members Portal"
        title="My Profile"
        subtitle="Keep your contact details, photo, and account security up to date."
      />

      {/* Profile header */}
      <PortalPanel className="mb-5 flex items-center gap-4 bg-white">
        {user.profilePhoto ? (
          <img
            src={user.profilePhoto}
            alt=""
            className="h-14 w-14 flex-shrink-0 rounded-full border border-gray-200 object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 font-sans text-lg font-bold text-white"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-sm text-gray-400 font-sans">
            {roleLabel}
            {user.cellGroup ? ` · ${user.cellGroup.name}` : ""}
            {" · "}Member since {joinDate}
          </p>
        </div>
      </PortalPanel>

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
      <PortalSection className="mb-5">
        <PortalSectionHeading
          title="Personal Information"
          subtitle="These details help leaders identify and contact you accurately."
        />
        <Form ref={profileFormRef} method="post" encType="multipart/form-data" noValidate>
          <input type="hidden" name="intent" value="updateProfile" />
          <ValidationSummary errors={profileErrors} />

          <div className="mb-5">
            <label htmlFor="profilePhoto" className={labelClass}>Profile Photo</label>
            {user.profilePhoto ? (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <img
                  src={user.profilePhoto}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
                <p className="text-xs font-sans text-gray-500">
                  Choose a new image only if you want to replace your current photo.
                </p>
              </div>
            ) : null}
            <input
              id="profilePhoto"
              type="file"
              name="profilePhoto"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-invalid={profileErrors?.profilePhoto?.length ? true : undefined}
              aria-describedby={describedBy(profileErrors?.profilePhoto?.length ? "profilePhoto-error" : "profilePhoto-hint")}
              className={inputClass}
            />
            <p id="profilePhoto-hint" className="mt-1.5 text-xs text-gray-400 font-sans">
              Upload JPG, PNG, WebP, or GIF up to 5 MB. Leave blank to keep your current photo.
            </p>
            <FieldError errors={profileErrors?.profilePhoto} id="profilePhoto-error" />
          </div>

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
            isPending={isProfileSubmitting}
            pendingText="Saving..."
            className={portalButtonClasses()}
          >
            Save Changes
          </PendingButton>
        </Form>
      </PortalSection>

      {/* Password change */}
      <PortalSection>
        <PortalSectionHeading
          title="Change Password"
          subtitle="Use a strong password that you do not reuse on other sites."
        />
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
            isPending={isPasswordSubmitting}
            pendingText="Updating..."
            className={portalButtonClasses()}
          >
            Update Password
          </PendingButton>
        </Form>
      </PortalSection>
    </PortalPage>
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
