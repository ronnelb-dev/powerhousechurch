// app/routes/ministries.tsx
import {
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
    orderBy: { sortOrder: "asc" },
  });
  return { ministries };
}

const MINISTRY_GRADIENTS = [
  "from-red-700 to-red-900",
  "from-rose-600 to-red-800",
  "from-red-800 to-rose-950",
  "from-pink-700 to-red-900",
  "from-red-600 to-rose-800",
  "from-rose-700 to-red-950",
];

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
              {ministries.map((ministry, i) => (
                <article
                  key={ministry.id}
                  id={ministry.id}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden
                             hover:shadow-md hover:border-red-200 transition-all duration-200
                             group"
                >
                  {/* Image or gradient header */}
                  <div
                    className={`h-36 bg-gradient-to-br ${
                      MINISTRY_GRADIENTS[i % MINISTRY_GRADIENTS.length]
                    } flex items-center justify-center relative overflow-hidden`}
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
                        className="text-white/20 font-serif text-6xl font-bold
                                   select-none group-hover:text-white/30
                                   transition-colors"
                        aria-hidden="true"
                      >
                        ✝
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    <h2 className="font-serif text-xl font-bold text-gray-900 mb-1">
                      {ministry.name}
                    </h2>
                    <p className="text-xs font-sans font-bold tracking-wide
                                  text-red-600 mb-3">
                      Led by {ministry.leader}
                    </p>
                    <p className="text-sm text-gray-500 font-sans leading-relaxed">
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
          className="mt-20 bg-red-900 rounded-2xl px-8 py-14 text-center"
          aria-labelledby="ministry-cta-heading"
        >
          <h2
            id="ministry-cta-heading"
            className="font-serif text-3xl font-bold text-white mb-4"
          >
            Not Sure Where to Start?
          </h2>
          <p className="text-red-200 font-sans text-base max-w-lg mx-auto mb-8">
            Our pastoral team would love to help you discover your spiritual gifts
            and find the right place to serve. Reach out — we're here.
          </p>
          <a
            href="/contact?subject=Ministry+Interest"
            className="inline-block px-8 py-4 bg-yellow-400 text-red-900 font-sans
                       font-bold text-sm tracking-wide rounded-lg hover:bg-yellow-300
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-yellow-200"
          >
            Talk to Our Team →
          </a>
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
