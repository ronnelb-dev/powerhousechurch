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

  const updates: { key: string; value: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      updates.push({ key, value });
    }
  }

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
  "w-full px-4 py-2.5 text-base font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent";

const labelClass = "block text-sm font-sans font-bold text-gray-600 mb-1.5";
const hintClass  = "mt-1 text-xs text-gray-400 font-sans";

const SETTING_GROUPS = [
  {
    title: "Church Identity",
    fields: [
      { key: "church.name",    label: "Church Name",   type: "text"  },
      { key: "church.tagline", label: "Tagline",       type: "text"  },
      { key: "church.address", label: "Full Address",  type: "text"  },
      { key: "church.email",   label: "Contact Email", type: "email" },
      { key: "church.phone",   label: "Phone Number",  type: "tel"   },
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
    hint: "The YouTube Channel ID enables automatic live detection — no manual URL needed each Sunday.",
    fields: [
      {
        key:         "youtube.channelId",
        label:       "YouTube Channel ID",
        type:        "text",
        placeholder: "UCxxxxxxxxxxxxxxxxxxxxxxxxx",
        hint:        "Starts with UC. Find it at youtube.com → Your channel → About → Share → Copy channel ID. This enables automatic live detection.",
      },
      {
        key:         "youtube.apiKey",
        label:       "YouTube API Key (optional override)",
        type:        "text",
        placeholder: "AIza…",
        hint:        "Leave blank to use the YOUTUBE_API_KEY environment variable. Only set this if you need a different key.",
      },
      {
        key:         "youtube.live",
        label:       "Manual Live URL (fallback)",
        type:        "url",
        placeholder: "https://www.youtube.com/watch?v=…",
        hint:        "Only used if automatic detection is unavailable. Leave blank when Channel ID is set.",
      },
      {
        key:         "facebook.live",
        label:       "Facebook Live URL",
        type:        "url",
        placeholder: "https://www.facebook.com/…/live",
        hint:        "Optional. Shown in the Facebook chat card below the video.",
      },
    ],
  },
];

export default function AdminSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigation   = useNavigation();
  const isSaving     = navigation.state === "submitting";

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl">
      <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">
        Church Settings
      </h1>
      <p className="text-base text-gray-400 font-sans mb-8">
        Changes take effect immediately across the entire website.
      </p>

      {actionData?.success && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 px-5 py-3 bg-green-50 border border-green-200 rounded-xl
                     text-base font-sans font-bold text-green-700"
        >
          ✓ Settings saved successfully.
        </div>
      )}

      <Form method="post" aria-label="Church settings form">
        <div className="space-y-8">
          {SETTING_GROUPS.map((group) => (
            <div
              key={group.title}
              className="bg-white border border-gray-100 rounded-xl p-5 sm:p-6"
            >
              <h2 className="font-serif text-base font-bold text-gray-800 mb-1">
                {group.title}
              </h2>
              {group.hint && (
                <p className="text-sm text-gray-400 font-sans mb-5">{group.hint}</p>
              )}
              {!group.hint && <div className="mb-5" />}

              <div className="space-y-5">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={`setting-${field.key}`}
                      className={labelClass}
                    >
                      {field.label}
                    </label>
                    <input
                      id={`setting-${field.key}`}
                      type={field.type}
                      name={field.key}
                      defaultValue={settings[field.key] ?? ""}
                      placeholder={"placeholder" in field ? field.placeholder : undefined}
                      className={inputClass}
                      autoComplete="off"
                      // Mask API key field after first character
                      {...(field.key === "youtube.apiKey" && settings[field.key]
                        ? { placeholder: "••••••••••••••••••••• (set — paste to replace)" }
                        : {})}
                    />
                    {"hint" in field && field.hint && (
                      <p className={hintClass}>{field.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live detection status indicator */}
        <div className="mt-6 bg-gray-50 border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-sans font-bold text-gray-600 mb-2">
            Live Detection Status
          </p>
          {settings["youtube.channelId"] ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
              <p className="text-sm text-gray-600 font-sans">
                Automatic detection active. Channel ID:{" "}
                <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                  {settings["youtube.channelId"]}
                </code>
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1" aria-hidden="true" />
              <p className="text-sm text-gray-500 font-sans">
                Channel ID not set. Automatic live detection is disabled.
                {settings["youtube.live"]
                  ? " Using manual live URL as fallback."
                  : " Set the YouTube Channel ID above to enable it."}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className="inline-flex items-center justify-center
                       min-h-[52px] px-8 py-3
                       bg-red-700 text-white font-sans font-bold text-base
                       rounded-xl hover:bg-red-800 active:bg-red-900
                       disabled:opacity-60 transition-all touch-manipulation
                       focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {isSaving ? "Saving…" : "Save All Settings"}
          </button>
        </div>
      </Form>
    </div>
  );
}