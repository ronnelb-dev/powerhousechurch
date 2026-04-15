// app/components/ui/EmptyState.tsx
// Shown in every list/table/data view when there is no content.
// role="status" so screen readers announce it as a live region update.
// Icon is decorative; message provides full context.

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
      className="flex flex-col items-center justify-center text-center py-16 px-6"
      role="status"
      aria-label={title}
    >
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full bg-red-50 border border-red-100
                   flex items-center justify-center mb-5 shrink-0"
        aria-hidden="true"
      >
        <svg
          width="28" height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#be123c"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICON_PATHS[icon]}
        </svg>
      </div>

      {/* Copy */}
      <h3 className="font-serif text-xl font-bold text-gray-800 mb-2">
        {title}
      </h3>
      <p className="font-sans text-base text-gray-500 max-w-sm leading-relaxed mb-6">
        {message}
      </p>

      {/* Optional CTA */}
      {action && (
        <a
          href={action.to}
          className="inline-flex items-center justify-center
                     min-h-12 px-6 py-3
                     bg-red-700 text-white text-base font-sans font-bold
                     rounded-xl hover:bg-red-800 active:bg-red-900
                     transition-colors touch-manipulation
                     focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}