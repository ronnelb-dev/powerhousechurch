// app/components/church/PastoralAlert.tsx
// Appears on the portal dashboard when members have missed 2+ consecutive Sundays.
// Embodies "Discipleship Through Visibility" — warm, pastoral, not punitive.
// Renders null when no members need care (zero-cost when not needed).

import { Link } from "react-router";

interface MemberRef {
  id:                string;
  firstName:         string;
  lastName:          string;
  consecutiveMissed: number;
}

interface PastoralAlertProps {
  members: MemberRef[];
}

export function PastoralAlert({ members }: PastoralAlertProps) {
  // Zero-cost render when no care is needed
  if (members.length === 0) return null;

  return (
    <aside
      className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6"
      role="region"
      aria-label="Members who may need pastoral care"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {/* Shepherd / person icon */}
        <div
          className="w-10 h-10 rounded-full bg-red-100 border border-red-200
                     flex items-center justify-center shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <svg
            width="20" height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#be123c"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          </svg>
        </div>

        <div>
          <p className="font-sans font-bold text-red-800 text-base mb-0.5">
            Pastoral Care Needed
          </p>
          <p className="font-sans text-sm text-red-600 leading-relaxed">
            {members.length === 1
              ? "The following member has missed 2 or more consecutive Sundays."
              : `${members.length} members have missed 2 or more consecutive Sundays.`}{" "}
            This is an invitation to reach out — not a report.
          </p>
        </div>
      </div>

      {/* Member list */}
      <ul className="space-y-2" role="list">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-4
                       bg-white rounded-xl px-4 py-3 border border-red-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Initials avatar */}
              <div
                className="w-9 h-9 rounded-full bg-red-100 border border-red-200
                           flex items-center justify-center text-xs font-bold
                           text-red-700 font-sans shrink-0"
                aria-hidden="true"
              >
                {(member.firstName[0] ?? "").toUpperCase()}
                {(member.lastName[0]  ?? "").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-sans font-bold text-sm text-gray-800 truncate">
                  {member.firstName} {member.lastName}
                </p>
                <p className="font-sans text-xs text-red-500">
                  {member.consecutiveMissed} consecutive{" "}
                  {member.consecutiveMissed === 1 ? "Sunday" : "Sundays"} missed
                </p>
              </div>
            </div>

            <Link
              to={`/portal/directory?memberId=${member.id}`}
              className="font-sans font-bold text-xs text-red-700
                         hover:text-red-900 underline underline-offset-2
                         transition-colors shrink-0
                         min-h-[44px] flex items-center px-1
                         focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
              aria-label={`View profile of ${member.firstName} ${member.lastName}`}
            >
              View profile →
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}