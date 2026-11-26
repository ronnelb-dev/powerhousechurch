// app/components/ui/EmptyState.tsx
// Shown in every list/table/data view when there is no content.
// role="status" so screen readers announce it as a live region update.
// Icon is decorative; message provides full context.

import { Link } from "react-router";

import { buttonVariants } from "~/components/ui/Button";
import { Card } from "~/components/ui/card";

interface EmptyStateProps {
  title:   string;
  message: string;
  action?: { label: string; to: string };
  icon?:   "members" | "sermons" | "events" | "devotion" | "attendance" | "generic";
}

const ICON_PATHS: Record<NonNullable<EmptyStateProps["icon"]>, React.ReactNode> = {
  members: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round"/>
    </>
  ),
  sermons: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4" strokeLinecap="round"/>
    </>
  ),
  events: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </>
  ),
  devotion: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </>
  ),
  attendance: (
    <>
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </>
  ),
  generic: <circle cx="12" cy="12" r="10"/>,
};

export function EmptyState({
  title,
  message,
  action,
  icon = "generic",
}: EmptyStateProps) {
  return (
    <div
      className="px-6 py-16"
      role="status"
      aria-label={title}
    >
      <Card className="mx-auto max-w-xl bg-white/75 p-8 text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(146,48,52,0.12)]"
          aria-hidden="true"
        >
          <svg
            width="28" height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#923034"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICON_PATHS[icon]}
          </svg>
        </div>

        <h3 className="font-serif text-3xl font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-base leading-7">
          {message}
        </p>

        {action && (
          <Link to={action.to} className={buttonVariants({ className: "mt-6 inline-flex" })}>
            {action.label}
          </Link>
        )}
      </Card>
    </div>
  );
}
