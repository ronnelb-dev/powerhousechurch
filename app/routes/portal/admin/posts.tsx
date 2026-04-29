// app/routes/portal/admin/posts.tsx
// Admin moderation queue for Daily Bread devotion posts.
// Approve → post becomes visible in the feed.
// Reject → post is deleted.

import {
  useLoaderData,
  useFetcher,
  Link,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";

export const meta: MetaFunction = () => [{ title: "Community Moderation — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url      = new URL(request.url);
  const approved = url.searchParams.get("approved") === "true";

  const posts = await db.post.findMany({
    where: { isApproved: approved },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  return {
    posts: posts.map((p) => ({
      id:          p.id,
      bibleVerse:  p.bibleVerse,
      content:     p.content,
      scope:       p.scope,
      isApproved:  p.isApproved,
      createdAt:   p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      author:      p.author,
      likeCount:   p._count.likes,
      commentCount: p._count.comments,
    })),
    showingApproved: approved,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const id       = formData.get("id") as string;
  const intent   = formData.get("intent") as string;
  const existingPost = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      scope: true,
      author: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (intent === "approve") {
    await db.post.update({ where: { id }, data: { isApproved: true } });
    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "post.approve",
      entityType: "post",
      entityId: id,
      summary: `Approved Community post by ${existingPost?.author.firstName ?? "unknown"} ${existingPost?.author.lastName ?? ""}`.trim(),
      details: {
        scope: existingPost?.scope ?? null,
        preview: existingPost?.content.slice(0, 140) ?? null,
      },
    });
    return { success: true };
  }
  if (intent === "reject") {
    await db.post.delete({ where: { id } });
    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "post.reject",
      entityType: "post",
      entityId: id,
      summary: `Removed Community post by ${existingPost?.author.firstName ?? "unknown"} ${existingPost?.author.lastName ?? ""}`.trim(),
      details: {
        scope: existingPost?.scope ?? null,
        preview: existingPost?.content.slice(0, 140) ?? null,
      },
    });
    return { success: true };
  }
  return { error: "Unknown intent." };
}

export default function AdminPostsPage() {
  const { posts, showingApproved } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">
            Community Moderation
          </h1>
          <p className="text-sm text-gray-400 font-sans">
            Review and approve member devotion posts.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/portal/admin/posts"
            className={[
              "px-4 py-2 rounded-lg border text-sm font-sans font-bold transition-all",
              !showingApproved
                ? "bg-red-700 text-white border-red-700"
                : "bg-white text-gray-500 border-gray-200 hover:border-red-300",
            ].join(" ")}
          >
            Pending
          </Link>
          <Link
            to="/portal/admin/posts?approved=true"
            className={[
              "px-4 py-2 rounded-lg border text-sm font-sans font-bold transition-all",
              showingApproved
                ? "bg-red-700 text-white border-red-700"
                : "bg-white text-gray-500 border-gray-200 hover:border-red-300",
            ].join(" ")}
          >
            Approved
          </Link>
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white border border-gray-100 rounded-xl p-6
                         hover:border-red-100 transition-all"
            >
              {/* Verse */}
              {post.bibleVerse && (
                <p className="text-xs font-sans font-bold tracking-widest uppercase
                               text-red-600 mb-2">
                  {post.bibleVerse}
                </p>
              )}

              {/* Content */}
              <p className="text-sm text-gray-700 font-sans leading-relaxed mb-4">
                {post.content.length > 300
                  ? post.content.slice(0, 300) + "…"
                  : post.content}
              </p>

              {/* Author + meta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-red-50 border border-red-100
                                  flex items-center justify-center text-xs font-bold
                                  text-red-700 font-sans">
                    {post.author.firstName[0]}{post.author.lastName[0]}
                  </div>
                  <div>
                    <p className="text-xs font-sans font-bold text-gray-700">
                      {post.author.firstName} {post.author.lastName}
                    </p>
                    <p className="text-xs text-gray-400 font-sans">
                      {new Date(post.createdAt).toLocaleDateString("en-PH", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                      {" · "}
                      {post.scope === "CELL_GROUP" ? "Cell Group only" : "Whole Church"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {!post.isApproved ? (
                  <div className="flex gap-2">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="approve" />
                      <input type="hidden" name="id"     value={post.id} />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 text-white text-xs font-bold
                                   font-sans rounded-lg hover:bg-green-700 transition-colors
                                   focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        Approve
                      </button>
                    </fetcher.Form>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="reject" />
                      <input type="hidden" name="id"     value={post.id} />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-red-100 text-red-700 text-xs font-bold
                                   font-sans rounded-lg hover:bg-red-200 transition-colors
                                   focus:outline-none focus:ring-2 focus:ring-red-400"
                      >
                        Reject
                      </button>
                    </fetcher.Form>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-sans">
                      {post.likeCount} likes · {post.commentCount} comments
                    </span>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="reject" />
                      <input type="hidden" name="id"     value={post.id} />
                      <button
                        type="submit"
                        onClick={(e) => {
                          if (!confirm("Remove this post from the feed?")) e.preventDefault();
                        }}
                        className="text-xs font-sans font-bold text-red-500 hover:text-red-700
                                   underline underline-offset-2 transition-colors"
                      >
                        Remove
                      </button>
                    </fetcher.Form>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="devotion"
          title={showingApproved ? "No approved posts" : "No pending posts"}
          message={
            showingApproved
              ? "Approved posts will appear here."
              : "All posts have been reviewed. Check back when members submit new reflections."
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
        {isRouteErrorResponse(error) ? error.data : "Please refresh."}
      </p>
    </div>
  );
}
