// app/routes/portal/admin/settings.tsx
// Edit all church settings stored in the Settings table.
// Changes take effect immediately — no restart required.

import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { getSettings } from "~/lib/settings.server";

export const meta: MetaFunction = () => [{ title: "Church Settings — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { settings: await getSettings() };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();

  // Each form field name = the setting key
  const updates: { key: string; value: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      updates.push({ key, value });
    }
  }

  // Upsert all settings in parallel
  await Promise.all(
    updates.map((u) =>
      db.setting.upsert({
        where:  { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );

  return { success: true };
}

const inputClass =
  "w-full px-4 py-2.5 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent";

const labelClass = "block text-xs font-sans font-bold text-gray-600 mb-1.5";

const SETTING_GROUPS = [
  {
    title: "Church Identity",
    fields: [
      { key: "church.name",    label: "Church Name",   type: "text" },
      { key: "church.tagline", label: "Tagline",       type: "text" },
      { key: "church.address", label: "Full Address",  type: "text" },
      { key: "church.email",   label: "Contact Email", type: "email" },
      { key: "church.phone",   label: "Phone Number",  type: "tel"  },
    ],
  },
  {
    title: "Service Times",
    fields: [
      { key: "service.sunday1",       label: "First Sunday Service",  type: "text" },
      { key: "service.sunday2",       label: "Second Sunday Service", type: "text" },
      { key: "service.cellGroupDays", label: "Cell Group Days",       type: "text" },
    ],
  },
  {
    title: "Social Media",
    fields: [
      { key: "social.facebook",  label: "Facebook URL",  type: "url" },
      { key: "social.youtube",   label: "YouTube URL",   type: "url" },
      { key: "social.instagram", label: "Instagram URL", type: "url" },
    ],
  },
  {
    title: "Livestream",
    fields: [
      { key: "youtube.live",  label: "YouTube Live URL",  type: "url" },
      { key: "facebook.live", label: "Facebook Live URL", type: "url" },
    ],
  },
];

export default function AdminSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigation   = useNavigation();
  const isSaving     = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">Church Settings</h1>
      <p className="text-sm text-gray-400 font-sans mb-8">
        Changes take effect immediately across the entire website.
      </p>

      {actionData?.success && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 px-5 py-3 bg-green-50 border border-green-200 rounded-xl
                     text-sm font-sans font-bold text-green-700"
        >
          ✓ Settings saved successfully.
        </div>
      )}

      <Form method="post" aria-label="Church settings form">
        <div className="space-y-8">
          {SETTING_GROUPS.map((group) => (
            <div
              key={group.title}
              className="bg-white border border-gray-100 rounded-xl p-6"
            >
              <h2 className="font-serif text-base font-bold text-gray-800 mb-5">
                {group.title}
              </h2>
              <div className="space-y-4">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={`setting-${field.key}`} className={labelClass}>
                      {field.label}
                    </label>
                    <input
                      id={`setting-${field.key}`}
                      type={field.type}
                      name={field.key}
                      defaultValue={settings[field.key] ?? ""}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className="px-8 py-3 bg-red-700 text-white font-sans font-bold text-sm
                       rounded-lg hover:bg-red-800 disabled:opacity-60 transition-all
                       focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {isSaving ? "Saving…" : "Save All Settings"}
          </button>
        </div>
      </Form>
    </div>
  );
}