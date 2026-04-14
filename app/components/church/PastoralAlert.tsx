import { Link } from "react-router";

interface MemberRef {
  id: string;
  firstName: string;
  lastName: string;
  consecutiveMissed: number;
}

interface PastoralAlertProps {
  members: MemberRef[];
}

export function PastoralAlert({ members }: PastoralAlertProps) {
  if (members.length === 0) return null;

  return (
    <aside
      className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6"
      role="region"
      aria-label="Members who may need pastoral care"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-full bg-red-100 border border-red-200
                     flex items-center justify-center flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          {/* Shepherd icon — SVG cross/person */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="#be123c" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          </svg>
        </div>
        <div>
          <p className="text-red-800 font-sans font-bold text-sm mb-0.5">
            Pastoral Care Needed
          </p>
          <p className="text-red-600 text-xs font-sans leading-relaxed">
            {members.length === 1
              ? "The following member has missed 2 or more consecutive Sundays."
              : `The following ${members.length} members have missed 2 or more consecutive Sundays.`
            } This is not a report — it is an invitation to reach out.
          </p>
        </div>
      </div>

      {/* Member list */}
      <ul className="space-y-2" role="list">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between
                       bg-white rounded-lg px-4 py-3 border border-red-100"
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full bg-red-100 border border-red-200
                           flex items-center justify-center text-xs font-bold
                           text-red-700 font-sans"
                aria-hidden="true"
              >
                {member.firstName[0]}{member.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-sans font-bold text-gray-800">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-xs text-red-500 font-sans">
                  {member.consecutiveMissed} consecutive{" "}
                  {member.consecutiveMissed === 1 ? "Sunday" : "Sundays"} missed
                </p>
              </div>
            </div>
            <Link
              to={`/portal/directory?memberId=${member.id}`}
              className="text-xs font-sans font-bold text-red-700
                         hover:text-red-900 underline underline-offset-2
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-red-400 rounded"
            >
              View profile →
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default PastoralAlert;
