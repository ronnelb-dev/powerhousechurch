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
import { Card, CardContent } from "~/components/ui/card";
import { Select } from "~/components/ui/select";
import { buttonVariants } from "~/components/ui/Button";

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

      <div className="shell section-gap !pt-12">
        <Card className="mb-10 bg-white/75">
          <CardContent className="p-5">
            <Form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-center" role="search">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Select
            name="series"
            defaultValue={filters.series}
            onChange={(e) => {
              const form = e.currentTarget.form!;
              const data = new FormData(form);
              data.set("page", "1");
              setSearchParams(Object.fromEntries(data.entries()) as Record<string, string>);
            }}
            aria-label="Filter by series"
          >
            <option value="">All Series</option>
            {allSeries.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
                  </Select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">⌄</span>
                </div>

                <div className="relative">
                  <Select
            name="speaker"
            defaultValue={filters.speaker}
            onChange={(e) => {
              const form = e.currentTarget.form!;
              const data = new FormData(form);
              data.set("page", "1");
              setSearchParams(Object.fromEntries(data.entries()) as Record<string, string>);
            }}
            aria-label="Filter by speaker"
          >
            <option value="">All Speakers</option>
            {allSpeakers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
                  </Select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">⌄</span>
                </div>
              </div>

              {(filters.series || filters.speaker) && (
            <Link
              to="/sermons"
                  className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"
            >
              Clear filters ×
            </Link>
              )}

              <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)] lg:ml-auto">
            {total} {total === 1 ? "sermon" : "sermons"}
            {filters.series || filters.speaker ? " found" : " total"}
          </p>
            </Form>
          </CardContent>
        </Card>

        {sermons.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        {totalPages > 1 && (
          <nav
            className="mt-12 flex items-center justify-center gap-3"
            aria-label="Sermon pagination"
          >
            {page > 1 && (
              <Link
                to={`/sermons?series=${filters.series}&speaker=${filters.speaker}&page=${page - 1}`}
                className={buttonVariants({ variant: "outline" })}
              >
                ← Previous
              </Link>
            )}
            <span className="px-4 text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                to={`/sermons?series=${filters.series}&speaker=${filters.speaker}&page=${page + 1}`}
                className={buttonVariants({ variant: "outline" })}
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
