// app/routes/blog/_index.tsx
// Public blog archive. Server-rendered for SEO.
// Categories: Devotional | Announcement | Testimony
// Each post has its own SEO-optimised page at /blog/:slug

import {
  useLoaderData,
  Link,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { PageHero } from "~/components/ui/PageHero";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Blog — Powerhouse Church" },
  {
    name: "description",
    content:
      "Devotionals, announcements, and testimonies from the Powerhouse Church community.",
  },
];

const PER_PAGE = 9;

const CATEGORIES = [
  { value: "",             label: "All Posts"     },
  { value: "Devotional",   label: "Devotionals"   },
  { value: "Announcement", label: "Announcements" },
  { value: "Testimony",    label: "Testimonies"   },
];

const CATEGORY_COLORS: Record<string, string> = {
  Devotional:   "bg-red-50 text-red-700 border-red-100",
  Announcement: "bg-amber-50 text-amber-700 border-amber-100",
  Testimony:    "bg-green-50 text-green-700 border-green-100",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url      = new URL(request.url);
  const category = url.searchParams.get("category") ?? "";
  const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where = {
    isPublished: true,
    ...(category ? { category } : {}),
  };

  const [posts, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, title: true, slug: true, excerpt: true,
        category: true, imageUrl: true, publishedAt: true,
      },
    }),
    db.blogPost.count({ where }),
  ]);

  return {
    posts: posts.map((p) => ({
      ...p,
      publishedAt: p.publishedAt instanceof Date
        ? p.publishedAt.toISOString()
        : (p.publishedAt ?? null),
    })),
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    category,
  };
}

export default function BlogIndexPage() {
  const { posts, total, page, totalPages, category } =
    useLoaderData<typeof loader>();

  return (
    <>
      <PageHero
        title="Blog"
        subtitle="Words of life from our pastors, leaders, and community."
        scripture="Your word is a lamp to my feet and a light to my path. — Psalm 119:105"
      />

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-10" role="tablist" aria-label="Filter by category">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              to={cat.value ? `/blog?category=${cat.value}` : "/blog"}
              role="tab"
              aria-selected={category === cat.value}
              className={[
                "px-5 py-2 rounded-full text-sm font-sans font-bold border",
                "transition-all focus:outline-none focus:ring-2 focus:ring-red-300",
                category === cat.value
                  ? "bg-red-700 text-white border-red-700"
                  : "bg-white text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-700",
              ].join(" ")}
            >
              {cat.label}
            </Link>
          ))}
          <span className="ml-auto text-sm text-gray-400 font-sans self-center">
            {total} {total === 1 ? "post" : "posts"}
          </span>
        </div>

        {/* Grid */}
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const categoryClass =
                CATEGORY_COLORS[post.category] ?? "bg-gray-50 text-gray-600 border-gray-100";
              const dateStr = post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString("en-PH", {
                    month: "long", day: "numeric", year: "numeric",
                  })
                : "";

              return (
                <article
                  key={post.id}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden
                             hover:border-red-200 hover:shadow-sm transition-all group"
                >
                  {/* Image */}
                  <div className="h-44 bg-gradient-to-br from-red-700 to-red-900 overflow-hidden">
                    {post.imageUrl ? (
                      <img
                        src={post.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105
                                   transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/20 font-serif text-6xl font-bold"
                              aria-hidden="true">✝</span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`text-xs font-sans font-bold border px-2.5 py-0.5
                                   rounded-full ${categoryClass}`}
                      >
                        {post.category}
                      </span>
                      {dateStr && (
                        <span className="text-xs text-gray-400 font-sans">{dateStr}</span>
                      )}
                    </div>
                    <h2 className="font-serif text-lg font-bold text-gray-900 leading-snug
                                   mb-2 group-hover:text-red-800 transition-colors line-clamp-2">
                      <Link
                        to={`/blog/${post.slug}`}
                        className="focus:outline-none focus:underline"
                      >
                        {post.title}
                      </Link>
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-gray-500 font-sans leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <Link
                      to={`/blog/${post.slug}`}
                      className="inline-block mt-4 text-xs font-sans font-bold text-red-700
                                 hover:text-red-900 transition-colors focus:outline-none focus:underline"
                      aria-label={`Read "${post.title}"`}
                    >
                      Read more →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="devotion"
            title="No posts yet"
            message={
              category
                ? `No ${category.toLowerCase()} posts have been published yet.`
                : "No blog posts have been published yet. Check back soon."
            }
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Blog pagination">
            {page > 1 && (
              <Link
                to={`/blog?category=${category}&page=${page - 1}`}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-sans
                           font-bold text-gray-600 hover:border-red-300 hover:text-red-700
                           transition-all focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                ← Previous
              </Link>
            )}
            <span className="text-sm font-sans text-gray-400 px-3">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                to={`/blog?category=${category}&page=${page + 1}`}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-sans
                           font-bold text-gray-600 hover:border-red-300 hover:text-red-700
                           transition-all focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                Next →
              </Link>
            )}
          </nav>
        )}

        {/* RSS link */}
        <div className="mt-10 text-center">
          <a
            href="/blog/rss.xml"
            className="inline-flex items-center gap-2 text-xs text-gray-400 font-sans
                       hover:text-red-600 transition-colors focus:outline-none focus:underline"
            aria-label="Subscribe to RSS feed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98
                       20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1
                       19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1
                       9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
            </svg>
            Subscribe via RSS
          </a>
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="devotion"
      title="Blog unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
      action={{ label: "Go home", to: "/" }}
    />
  );
}