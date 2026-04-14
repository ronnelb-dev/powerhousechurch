// app/routes/sermons/_index.tsx
import {
  useLoaderData,
  useSearchParams,
  Link,
  Form,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { PageHero } from "~/components/ui/PageHero";
import { SermonCard } from "~/components/church/SermonCard";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Sermons — Powerhouse Church" },
  {
    name: "description",
    content:
      "Browse our complete sermon archive. Filter by series, speaker, or date.",
  },
];

const PER_PAGE = 12;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const series  = url.searchParams.get("series")  ?? "";
  const speaker = url.searchParams.get("speaker") ?? "";
  const page    = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where = {
    isPublished: true,
    ...(series  ? { series }  : {}),
    ...(speaker ? { speaker } : {}),
  };

  const [sermons, total, allSeriesRaw, allSpeakersRaw] = await Promise.all([
    db.sermon.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, title: true, speaker: true,
        series: true, date: true, thumbnail: true, tags: true,
      },
    }),
    db.sermon.count({ where }),
    db.sermon.findMany({
      where: { isPublished: true },
      select: { series: true },
      distinct: ["series"],
    }),
    db.sermon.findMany({
      where: { isPublished: true },
      select: { speaker: true },
      distinct: ["speaker"],
    }),
  ]);

  return {
    sermons: sermons.map((s) => ({
      ...s,
      date: s.date instanceof Date ? s.date.toISOString() : s.date,
    })),
    total,
    page,
    perPage: PER_PAGE,
    totalPages: Math.ceil(total / PER_PAGE),
    allSeries:   allSeriesRaw.map((r) => r.series).filter(Boolean) as string[],
    allSpeakers: allSpeakersRaw.map((r) => r.speaker),
    filters: { series, speaker },
  };
}

export default function SermonsPage() {
  const { sermons, total, page, totalPages, allSeries, allSpeakers, filters } =
    useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <>
      <PageHero
        title="Sermon Archive"
        subtitle="Every word preached is a seed planted. Browse, listen, and go deeper."
        scripture="Faith comes from hearing, and hearing through the word of Christ. — Romans 10:17"
      />

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Filter bar */}
        <Form method="get" className="flex flex-wrap gap-3 mb-8" role="search">
          <select
            name="series"
            defaultValue={filters.series}
            onChange={(e) => {
              const form = e.currentTarget.form!;
              const data = new FormData(form);
              data.set("page", "1");
              setSearchParams(Object.fromEntries(data.entries()) as Record<string, string>);
            }}
            className="text-sm font-sans px-4 py-2.5 rounded-lg border border-gray-200
                       bg-white text-gray-700 focus:outline-none focus:ring-2
                       focus:ring-red-300 focus:border-transparent cursor-pointer"
            aria-label="Filter by series"
          >
            <option value="">All Series</option>
            {allSeries.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            name="speaker"
            defaultValue={filters.speaker}
            onChange={(e) => {
              const form = e.currentTarget.form!;
              const data = new FormData(form);
              data.set("page", "1");
              setSearchParams(Object.fromEntries(data.entries()) as Record<string, string>);
            }}
            className="text-sm font-sans px-4 py-2.5 rounded-lg border border-gray-200
                       bg-white text-gray-700 focus:outline-none focus:ring-2
                       focus:ring-red-300 focus:border-transparent cursor-pointer"
            aria-label="Filter by speaker"
          >
            <option value="">All Speakers</option>
            {allSpeakers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(filters.series || filters.speaker) && (
            <Link
              to="/sermons"
              className="px-4 py-2.5 text-sm font-sans font-bold text-red-600
                         hover:text-red-800 transition-colors focus:outline-none
                         focus:underline"
            >
              Clear filters ×
            </Link>
          )}

          <p className="ml-auto text-sm text-gray-400 font-sans self-center">
            {total} {total === 1 ? "sermon" : "sermons"}
            {filters.series || filters.speaker ? " found" : " total"}
          </p>
        </Form>

        {/* Grid */}
        {sermons.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sermons.map((sermon) => (
              <SermonCard
                key={sermon.id}
                id={sermon.id}
                title={sermon.title}
                speaker={sermon.speaker}
                series={sermon.series}
                date={sermon.date}
                thumbnail={sermon.thumbnail}
                tags={sermon.tags}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="sermons"
            title="No sermons found"
            message="Try adjusting your filters, or browse the full archive."
            action={{ label: "View all sermons", to: "/sermons" }}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            className="mt-12 flex items-center justify-center gap-2"
            aria-label="Sermon pagination"
          >
            {page > 1 && (
              <Link
                to={`/sermons?series=${filters.series}&speaker=${filters.speaker}&page=${page - 1}`}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm
                           font-sans font-bold text-gray-600 hover:border-red-300
                           hover:text-red-700 transition-all focus:outline-none
                           focus:ring-2 focus:ring-red-300"
              >
                ← Previous
              </Link>
            )}
            <span className="text-sm font-sans text-gray-500 px-4">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                to={`/sermons?series=${filters.series}&speaker=${filters.speaker}&page=${page + 1}`}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm
                           font-sans font-bold text-gray-600 hover:border-red-300
                           hover:text-red-700 transition-all focus:outline-none
                           focus:ring-2 focus:ring-red-300"
              >
                Next →
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="sermons"
      title="Could not load sermons"
      message={
        isRouteErrorResponse(error)
          ? error.data
          : "Please refresh the page and try again."
      }
      action={{ label: "Go home", to: "/" }}
    />
  );
}