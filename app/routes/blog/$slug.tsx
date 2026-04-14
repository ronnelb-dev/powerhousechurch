// app/routes/blog/$slug.tsx
// Single blog post. Fully SSR for SEO — Open Graph tags per post.
// Content is stored as Markdown in the DB — rendered with basic formatting.

import {
  useLoaderData,
  Link,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await db.blogPost.findFirst({
    where: { slug: params.slug, isPublished: true },
  });

  if (!post) throw new Response("Post not found", { status: 404 });

  return {
    post: {
      ...post,
      publishedAt: post.publishedAt instanceof Date
        ? post.publishedAt.toISOString()
        : (post.publishedAt ?? null),
      createdAt: post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt,
    },
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Post Not Found — Powerhouse Church" }];
  const { post } = data;
  return [
    { title: `${post.title} — Powerhouse Church Blog` },
    { name: "description", content: post.excerpt ?? post.content.slice(0, 160) },
    { property: "og:title",       content: post.title },
    { property: "og:description", content: post.excerpt ?? post.content.slice(0, 160) },
    { property: "og:type",        content: "article" },
    ...(post.imageUrl ? [{ property: "og:image", content: post.imageUrl }] : []),
    ...(post.publishedAt
      ? [{ property: "article:published_time", content: post.publishedAt }]
      : []),
  ];
};

const CATEGORY_COLORS: Record<string, string> = {
  Devotional:   "bg-red-50 text-red-700 border-red-100",
  Announcement: "bg-amber-50 text-amber-700 border-amber-100",
  Testimony:    "bg-green-50 text-green-700 border-green-100",
};

// Minimal Markdown-to-HTML renderer — no external dependency required.
// For rich Markdown support, swap this with `marked` or `@mdx-js/mdx`.
function renderMarkdown(md: string): string {
  return md
    .replace(/^# (.+)$/gm,   "<h1 class=\"font-serif text-3xl font-bold text-gray-900 mt-8 mb-4\">$1</h1>")
    .replace(/^## (.+)$/gm,  "<h2 class=\"font-serif text-2xl font-bold text-gray-800 mt-7 mb-3\">$1</h2>")
    .replace(/^### (.+)$/gm, "<h3 class=\"font-serif text-xl font-bold text-gray-800 mt-6 mb-2\">$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong class=\"font-bold text-gray-900\">$1</strong>")
    .replace(/\*(.+?)\*/g,    "<em class=\"italic text-gray-700\">$1</em>")
    .replace(/^> (.+)$/gm,
      "<blockquote class=\"border-l-4 border-red-700 bg-red-50 px-5 py-3 my-4 font-serif italic text-red-900 text-base\">$1</blockquote>")
    .replace(/^- (.+)$/gm,   "<li class=\"ml-5 list-disc text-gray-600 mb-1\">$1</li>")
    .replace(/\[(.+?)\]\((.+?)\)/g,
      "<a href=\"$2\" class=\"text-red-700 underline underline-offset-2 hover:text-red-900\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>")
    .replace(/\n\n/g, "</p><p class=\"text-gray-700 font-sans text-base leading-relaxed mb-4\">")
    .replace(/^(?!<[h|b|l|p])/gm, ""); // Remove orphan newlines
}

export default function BlogPostPage() {
  const { post } = useLoaderData<typeof loader>();

  const dateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-PH", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "";

  const categoryClass = CATEGORY_COLORS[post.category] ?? "bg-gray-50 text-gray-600 border-gray-100";

  const html = renderMarkdown(post.content);

  return (
    <div className="pt-24 pb-20 max-w-3xl mx-auto px-6">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm font-sans" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-gray-400">
          <li><Link to="/blog" className="hover:text-red-700 transition-colors">Blog</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-600 truncate max-w-xs">{post.title}</li>
        </ol>
      </nav>

      {/* Hero image */}
      {post.imageUrl && (
        <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
          <img
            src={post.imageUrl}
            alt={`Cover image for ${post.title}`}
            className="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      )}

      {/* Category + date */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-xs font-sans font-bold border px-3 py-1 rounded-full ${categoryClass}`}>
          {post.category}
        </span>
        {dateStr && (
          <time dateTime={post.publishedAt ?? ""} className="text-xs text-gray-400 font-sans">
            {dateStr}
          </time>
        )}
      </div>

      {/* Title */}
      <h1 className="font-serif text-4xl md:text-5xl font-bold text-gray-900
                     leading-tight mb-8">
        {post.title}
      </h1>

      {/* Red divider */}
      <div className="w-16 h-1 bg-red-700 rounded-full mb-10" aria-hidden="true" />

      {/* Content */}
      <div
        className="prose-content"
        dangerouslySetInnerHTML={{
          __html: `<p class="text-gray-700 font-sans text-base leading-relaxed mb-4">${html}</p>`,
        }}
      />

      {/* Back link */}
      <div className="mt-16 pt-8 border-t border-gray-100">
        <Link
          to="/blog"
          className="text-sm font-sans font-bold text-red-700 hover:text-red-900
                     transition-colors focus:outline-none focus:underline"
        >
          ← Back to blog
        </Link>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-24">
      <div className="text-center max-w-md">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          {isRouteErrorResponse(error) && error.status === 404
            ? "Post Not Found"
            : "Unable to Load Post"}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
        <Link
          to="/blog"
          className="px-5 py-2.5 bg-red-700 text-white font-bold text-sm
                     rounded-lg hover:bg-red-800 transition-colors"
        >
          Back to blog
        </Link>
      </div>
    </div>
  );
}