// app/routes/ministries.tsx
import {
  Link,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { ensureSampleMinistries } from "~/lib/ministries.server";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Ministries — Powerhouse Church" },
  {
    name: "description",
    content:
      "Discover the ministries of Powerhouse Church. Find your place to serve.",
  },
];

export async function loader() {
  await ensureSampleMinistries();
  const ministries = await db.ministry.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { ministries };
}

export default function MinistriesPage() {
  const { ministries } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHero
        title="Ministries"
        subtitle="Every member is a minister. Find the area where God has called you to serve."
        scripture="Each of you should use whatever gift you have received to serve others. — 1 Peter 4:10"
      />

      <div className="max-w-6xl mx-auto px-6 py-16">
        {ministries.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Serve & Connect"
              title="Find Your Place"
              subtitle="Our ministries exist to mobilize every member of the body to fulfill their God-given purpose."
            />

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {ministries.map((ministry) => (
                <article
                  key={ministry.id}
                  id={ministry.id}
                  className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-200 hover:border-[var(--primary)]/35 hover:shadow-[var(--shadow-card)]"
                >
                  {/* Image or gradient header */}
                  <div
                    className="relative flex h-36 items-center justify-center overflow-hidden"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, var(--primary), var(--surface-inverse))",
                    }}
                  >
                    {ministry.imageUrl ? (
                      <img
                        src={ministry.imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105
                                   transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="select-none font-serif text-6xl font-bold text-[var(--inverse-accent)]/55 transition-colors group-hover:text-[var(--inverse-accent)]"
                        aria-hidden="true"
                      >
                        ✝
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    <h2 className="mb-1 font-serif text-xl font-bold text-[var(--foreground)]">
                      {ministry.name}
                    </h2>
                    <p className="mb-3 text-xs font-sans font-bold tracking-wide text-[var(--primary)]">
                      Led by {ministry.leader}
                    </p>
                    <p className="text-sm font-sans leading-relaxed text-[var(--muted-foreground)]">
                      {ministry.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="generic"
            title="Ministries Coming Soon"
            message="Our ministry pages are being updated. Check back soon."
          />
        )}

        {/* Join CTA */}
        <div
          className="mt-20 rounded-2xl bg-[var(--surface-inverse)] px-8 py-14 text-center"
          aria-labelledby="ministry-cta-heading"
        >
          <h2
            id="ministry-cta-heading"
            className="mb-4 font-serif text-3xl font-bold text-[var(--inverse)]"
          >
            Not Sure Where to Start?
          </h2>
          <p className="mx-auto mb-8 max-w-lg font-sans text-base text-[var(--inverse-muted)]">
            Our pastoral team would love to help you discover your spiritual gifts
            and find the right place to serve. You can also meet people through a cell group.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/contact?subject=Ministry+Interest"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--accent-foreground)] transition-colors hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--inverse-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-inverse)]"
            >
              Talk to Our Team
            </Link>
            <Link
              to="/cell-groups"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/8 px-6 py-3 text-sm font-bold tracking-wide text-[var(--inverse)] transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[var(--inverse-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-inverse)]"
            >
              Find a Cell Group
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <EmptyState
        icon="generic"
        title="Ministries unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
        action={{ label: "Go home", to: "/" }}
      />
    </div>
  );
}
