// app/routes/portal/admin/reports.tsx
// CSV attendance export with date range and cell group filters.
// The CSV download route is handled by a separate resource route below.

import {
  useLoaderData,
  Form,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";

export const meta: MetaFunction = () => [{ title: "Reports — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const cellGroups = await db.cellGroup.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Summary stats
  const [totalMembers, totalSermons, totalAttendance, totalPrayers] = await Promise.all([
    db.user.count({ where: { isActive: true } }),
    db.sermon.count({ where: { isPublished: true } }),
    db.attendance.count(),
    db.prayerRequest.count(),
  ]);

  return { cellGroups, totalMembers, totalSermons, totalAttendance, totalPrayers };
}

// Action: generate CSV inline and return as a downloadable response
export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData   = await request.formData();
  const startDate  = new Date((formData.get("startDate") as string) + "T00:00:00");
  const endDate    = new Date((formData.get("endDate")   as string) + "T23:59:59");
  const cellGroupId = (formData.get("cellGroupId") as string) || undefined;
  const type       = (formData.get("type") as string) || "SUNDAY_SERVICE";

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return new Response("Invalid date range", { status: 400 });
  }

  const records = await db.attendance.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      type,
      ...(cellGroupId ? { cellGroupId } : {}),
    },
    include: {
      user:      { select: { firstName: true, lastName: true, email: true, phone: true } },
      cellGroup: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { user: { lastName: "asc" } }],
  });

  // Build CSV
  const header = "Date,Last Name,First Name,Email,Phone,Cell Group,Type,Status";
  const rows   = records.map((r) => {
    const date = r.date instanceof Date
      ? r.date.toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" })
      : String(r.date).slice(0, 10);
    const row  = [
      date,
      r.user.lastName,
      r.user.firstName,
      r.user.email ?? "",
      r.user.phone  ?? "",
      r.cellGroup?.name ?? "Unassigned",
      r.type,
      r.status,
    ];
    // Escape commas and quotes in fields
    return row.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `attendance-${type.toLowerCase().replace("_", "-")}-${startDate.toISOString().slice(0,10)}-to-${endDate.toISOString().slice(0,10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const inputClass =
  "w-full px-4 py-2.5 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300";

const labelClass = "block text-xs font-sans font-bold text-gray-600 mb-1.5";

export default function AdminReportsPage() {
  const { cellGroups, totalMembers, totalSermons, totalAttendance, totalPrayers } =
    useLoaderData<typeof loader>();
  const navigation   = useNavigation();
  const isGenerating = navigation.state === "submitting";

  // Default date range: last 30 days
  const today   = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-gray-900 mb-8">Reports</h1>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: "Active Members",     value: totalMembers    },
          { label: "Published Sermons",  value: totalSermons    },
          { label: "Attendance Records", value: totalAttendance },
          { label: "Prayer Requests",    value: totalPrayers    },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs font-sans font-bold tracking-widest uppercase text-gray-400 mb-2">
              {label}
            </p>
            <p className="font-serif text-3xl font-bold text-gray-900">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* CSV Export */}
      <div className="bg-white border border-gray-100 rounded-xl p-7 max-w-xl">
        <h2 className="font-serif text-lg font-bold text-gray-800 mb-6">
          Export Attendance (CSV)
        </h2>
        <Form method="post" aria-label="Attendance export form">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="startDate" className={labelClass}>Start Date *</label>
              <input
                id="startDate" type="date" name="startDate"
                defaultValue={thirtyAgo} required
                max={today} className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="endDate" className={labelClass}>End Date *</label>
              <input
                id="endDate" type="date" name="endDate"
                defaultValue={today} required
                max={today} className={inputClass}
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="report-type" className={labelClass}>Attendance Type</label>
            <select id="report-type" name="type" className={inputClass}>
              <option value="SUNDAY_SERVICE">Sunday Service</option>
              <option value="CELL_GROUP">Cell Group</option>
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="report-cellGroup" className={labelClass}>Cell Group</label>
            <select id="report-cellGroup" name="cellGroupId" className={inputClass}>
              <option value="">All Groups</option>
              {cellGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>{cg.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3 bg-red-700 text-white font-sans font-bold text-sm
                       rounded-lg hover:bg-red-800 disabled:opacity-60 transition-all
                       focus:outline-none focus:ring-2 focus:ring-red-400
                       flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              "Generating…"
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download CSV
              </>
            )}
          </button>
        </Form>

        <p className="mt-4 text-xs text-gray-400 font-sans">
          The CSV will download directly to your browser. Open in Excel or Google Sheets.
        </p>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-4">
      <p className="text-red-700 font-sans text-sm">
        {isRouteErrorResponse(error) ? error.data : "Reports unavailable. Please refresh."}
      </p>
    </div>
  );
}