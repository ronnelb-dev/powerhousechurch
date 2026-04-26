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
import { SERMON_PLAYLISTS } from "~/lib/sermon-playlists";
import { getSermonPlaylistVideos } from "~/lib/youtube.server";
import { PageHero } from "~/components/ui/PageHero";
import { SermonCard } from "~/components/church/SermonCard";
import { EmptyState } from "~/components/ui/EmptyState";
import { Card, CardContent } from "~/components/ui/card";
import { Select } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { buttonVariants } from "~/components/ui/Button";

export const meta: MetaFunction = () => [
  { title: "Sermons — Powerhouse Church" },
  {
    name: "description",
    content:
      "Browse sermon messages from Powerhouse Church with playlist filters and keyword search.",
  },
];

const PER_PAGE = 12;

function includesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const playlist = url.searchParams.get("playlist") ?? "";
  const speaker = url.searchParams.get("speaker") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  try {
    const youtubeSermons = await getSermonPlaylistVideos();

    if (youtubeSermons.length > 0) {
      const filtered = youtubeSermons.filter((sermon) => {
        const matchesPlaylist = !playlist || sermon.playlistKey === playlist;
        const matchesSpeaker = !speaker || sermon.speaker === speaker;
        const matchesQuery =
          !q ||
          includesQuery(sermon.title, q) ||
          includesQuery(sermon.description, q) ||
          includesQuery(sermon.speaker, q) ||
          includesQuery(sermon.playlistLabel, q);

        return matchesPlaylist && matchesSpeaker && matchesQuery;
      });

      const allSpeakers = Array.from(
        new Set(youtubeSermons.map((sermon) => sermon.speaker).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));

      const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

      return {
        source: "youtube" as const,
        sermons: paged.map((sermon) => ({
          id: sermon.id,
          title: sermon.title,
          speaker: sermon.speaker,
          series: sermon.playlistLabel,
          date: sermon.publishedAt,
          thumbnail: sermon.thumbnail,
          tags: sermon.playlistLabel,
          href: sermon.url,
          external: true,
        })),
        total: filtered.length,
        page,
        perPage: PER_PAGE,
        totalPages: Math.ceil(filtered.length / PER_PAGE),
        allPlaylists: Object.entries(SERMON_PLAYLISTS).map(([key, value]) => ({
          key,
          label: value.label,
        })),
        allSpeakers,
        filters: { q, playlist, speaker },
      };
    }
  } catch (error) {
    console.error("[sermons] Failed to load YouTube playlists:", error);
  }

  const where = {
    isPublished: true,
    ...(speaker ? { speaker } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { speaker: { contains: q } },
            { series: { contains: q } },
            { tags: { contains: q } },
          ],
        }
      : {}),
  };

  const [sermons, total, allSpeakersRaw] = await Promise.all([
    db.sermon.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        speaker: true,
        series: true,
        date: true,
        thumbnail: true,
        tags: true,
      },
    }),
    db.sermon.count({ where }),
    db.sermon.findMany({
      where: { isPublished: true },
      select: { speaker: true },
      distinct: ["speaker"],
    }),
  ]);

  return {
    source: "database" as const,
    sermons: sermons.map((sermon) => ({
      ...sermon,
      date:
        sermon.date instanceof Date ? sermon.date.toISOString() : sermon.date,
      href: undefined,
      external: false,
    })),
    total,
    page,
    perPage: PER_PAGE,
    totalPages: Math.ceil(total / PER_PAGE),
    allPlaylists: [],
    allSpeakers: allSpeakersRaw.map((row) => row.speaker).filter(Boolean),
    filters: { q, playlist: "", speaker },
  };
}

export default function SermonsPage() {
  const {
    source,
    sermons,
    total,
    page,
    totalPages,
    allPlaylists,
    allSpeakers,
    filters,
  } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <>
      <PageHero
        title="Sermon Archive"
        subtitle="Every word preached is a seed planted. Browse, search, and revisit messages from the church."
        scripture="Faith comes from hearing, and hearing through the word of Christ. — Romans 10:17"
      />

      <div className="shell section-gap !pt-12">
        <Card className="mb-10 bg-white/75">
          <CardContent className="p-5">
            <Form
              method="get"
              className="flex flex-col gap-3"
              role="search"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input
                  type="search"
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Search titles, descriptions, speakers..."
                  aria-label="Search sermons"
                />

                {source === "youtube" && (
                  <div className="relative">
                    <Select
                      name="playlist"
                      defaultValue={filters.playlist}
                      onChange={(e) => {
                        const form = e.currentTarget.form!;
                        const data = new FormData(form);
                        data.set("page", "1");
                        setSearchParams(
                          Object.fromEntries(data.entries()) as Record<
                            string,
                            string
                          >,
                        );
                      }}
                      aria-label="Filter by playlist"
                    >
                      <option value="">All Playlists</option>
                      {allPlaylists.map((playlist) => (
                        <option key={playlist.key} value={playlist.key}>
                          {playlist.label}
                        </option>
                      ))}
                    </Select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                      ⌄
                    </span>
                  </div>
                )}

                <div className="relative">
                  <Select
                    name="speaker"
                    defaultValue={filters.speaker}
                    onChange={(e) => {
                      const form = e.currentTarget.form!;
                      const data = new FormData(form);
                      data.set("page", "1");
                      setSearchParams(
                        Object.fromEntries(data.entries()) as Record<
                          string,
                          string
                        >,
                      );
                    }}
                    aria-label="Filter by speaker"
                  >
                    <option value="">All Speakers</option>
                    {allSpeakers.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                    ⌄
                  </span>
                </div>

                <button type="submit" className={buttonVariants()}>
                  Search
                </button>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                {(filters.q || filters.playlist || filters.speaker) && (
                  <Link
                    to="/sermons"
                    className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"
                  >
                    Clear filters ×
                  </Link>
                )}

                <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)] lg:ml-auto">
                  {total} {total === 1 ? "sermon" : "sermons"}
                  {filters.q || filters.playlist || filters.speaker
                    ? " found"
                    : " total"}
                </p>
              </div>
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
                href={sermon.href}
                external={sermon.external}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="sermons"
            title="No sermons found"
            message="Try a broader keyword or switch to a different playlist filter."
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
                to={`/sermons?${new URLSearchParams({
                  ...(filters.q ? { q: filters.q } : {}),
                  ...(filters.playlist ? { playlist: filters.playlist } : {}),
                  ...(filters.speaker ? { speaker: filters.speaker } : {}),
                  page: String(page - 1),
                }).toString()}`}
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
                to={`/sermons?${new URLSearchParams({
                  ...(filters.q ? { q: filters.q } : {}),
                  ...(filters.playlist ? { playlist: filters.playlist } : {}),
                  ...(filters.speaker ? { speaker: filters.speaker } : {}),
                  page: String(page + 1),
                }).toString()}`}
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
