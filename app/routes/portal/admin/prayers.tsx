// app/routes/portal/admin/prayers.tsx
// Admin prayer request viewer. Full content visible only to admins.
// Cell leaders and members cannot access this route.

import {
  useLoaderData,
  useFetcher,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [{ title: "Prayer Requests — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url      = new URL(request.url);
  const answered = url.searchParams.get("answered") === "true";

  const prayers = await db.prayerRequest.findMany({
    where: { isAnswered: answered },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  return {
    prayers: prayers.map((p) => ({
      ...p,
      submittedAt: p.submittedAt instanceof Date
        ? p.submittedAt.toISOString()
        : p.submittedAt,
    })),
    showingAnswered: answered,
    total: await db.prayerRequest.count({ where: { isAnswered: answered } }),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const id       = formData.get("id") as string;
  const intent   = formData.get("intent") as string;

  if (intent === "markAnswered") {
    await db.prayerRequest.update({ where: { id }, data: { isAnswered: true } });
    return { success: true };
  }
  if (intent === "delete") {
    await db.prayerRequest.delete({ where: { id } });
    return { success: true };
  }
  return { error: "Unknown intent." };
}

function PrayerCard({
  prayer,
}: {
  prayer: ReturnType<typeof useLoaderData<typeof loader>>["prayers"][0];
}) {
  const fetcher = useFetcher();
  const date    = new Date(prayer.submittedAt).toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-3
                    hover:border-red-100 transition-all">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-sans font-bold text-gray-800">{prayer.name}</p>
          <p className="text-xs text-gray-400 font-sans">
            {date}
            {prayer.email && ` · ${prayer.email}`}
            {prayer.isPrivate && (
              <span className="ml-2 text-amber-600 font-bold">🔒 Private</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!prayer.isAnswered && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="markAnswered" />
              <input type="hidden" name="id" value={prayer.id} />
              <button
                type="submit"
                className="text-xs font-sans font-bold px-3 py-1.5 rounded-lg border
                           text-green-600 border-green-200 hover:bg-green-50 transition-all
                           focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                Mark Answered ✓
              </button>
            </fetcher.Form>
          )}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={prayer.id} />
            <button
              type="submit"
              onClick={(e) => {
                if (!confirm("Delete this prayer request?")) e.preventDefault();
              }}
              className="text-xs font-sans font-bold px-3 py-1.5 rounded-lg border
                         text-red-600 border-red-200 hover:bg-red-50 transition-all
                         focus:outline-none focus:ring-2 focus:ring-red-300"
              aria-label={`Delete prayer request from ${prayer.name}`}
            >
              Delete
            </button>
          </fetcher.Form>
        </div>
      </div>

      {/* Prayer text */}
      <div className="bg-red-50 border-l-4 border-red-200 rounded-r-lg px-4 py-3">
        <p className="text-sm text-gray-700 font-sans leading-relaxed">
          {prayer.request}
        </p>
      </div>
    </div>
  );
}

export default function AdminPrayersPage() {
  const { prayers, showingAnswered, total } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">
            Prayer Requests
          </h1>
          <p className="text-sm text-gray-400 font-sans">{total} {showingAnswered ? "answered" : "unanswered"}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/portal/admin/prayers"
            className={[
              "px-4 py-2 rounded-lg border text-sm font-sans font-bold transition-all",
              !showingAnswered
                ? "bg-red-700 text-white border-red-700"
                : "bg-white text-gray-500 border-gray-200 hover:border-red-300",
            ].join(" ")}
          >
            Unanswered
          </a>
          <a
            href="/portal/admin/prayers?answered=true"
            className={[
              "px-4 py-2 rounded-lg border text-sm font-sans font-bold transition-all",
              showingAnswered
                ? "bg-red-700 text-white border-red-700"
                : "bg-white text-gray-500 border-gray-200 hover:border-red-300",
            ].join(" ")}
          >
            Answered
          </a>
        </div>
      </div>

      {prayers.length > 0 ? (
        <div>
          {prayers.map((prayer) => (
            <PrayerCard key={prayer.id} prayer={prayer} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="generic"
          title={showingAnswered ? "No answered prayers logged" : "No prayer requests"}
          message={
            showingAnswered
              ? "Mark prayers as answered to see them here."
              : "Prayer requests will appear here once submitted."
          }
        />
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-4">
      <p className="text-red-700 font-sans text-sm">
        {isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
      </p>
    </div>
  );
}