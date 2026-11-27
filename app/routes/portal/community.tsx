// app/routes/portal/community.tsx
import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { DevotionPost } from "~/components/church/DevotionPost";
import { EmptyState } from "~/components/ui/EmptyState";
import { PendingButton } from "~/components/ui/PendingButton";
import {
  PortalHeader,
  PortalPage,
  PortalPanel,
  PortalSection,
  PortalSectionHeading,
  portalButtonClasses,
} from "~/components/ui/Portal";
import { Sheet } from "~/components/ui/sheet";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

export const meta: MetaFunction = () => [
  { title: "Shared Reflections — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  const posts = await db.post.findMany({
    where: {
      isApproved: true,
      OR: [
        { scope: "PUBLIC" },
        ...(user.cellGroupId
          ? [{ scope: "CELL_GROUP", cellGroupId: user.cellGroupId }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { likes: true, comments: true } },
      likes:    { where: { userId: user.id }, select: { id: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 5,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  // Pending posts for admin approval
  const pendingPosts =
    user.role === "ADMIN"
      ? await db.post.findMany({
          where: { isApproved: false },
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { likes: true, comments: true } },
          },
        })
      : [];

  const serialize = (p: typeof posts[0]) => ({
    id:           p.id,
    bibleVerse:   p.bibleVerse,
    bibleText:    p.bibleText,
    content:      p.content,
    scope:        p.scope as "PUBLIC" | "CELL_GROUP",
    createdAt:    p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    author:       p.author,
    likeCount:    p._count.likes,
    commentCount: p._count.comments,
    userHasLiked: p.likes.length > 0,
    comments:     p.comments.map((c) => ({
      id:        c.id,
      content:   c.content,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      author:    c.author,
    })),
  });

  return {
    posts:        posts.map(serialize),
    pendingPosts: pendingPosts.map((p) => ({
      id:        p.id,
      content:   p.content.slice(0, 120) + (p.content.length > 120 ? "…" : ""),
      bibleVerse: p.bibleVerse,
      author:    p.author,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    })),
    userRole:      user.role,
    cellGroupId:   user.cellGroupId,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent   = formData.get("intent") as string;

  if (intent === "createPost") {
    const content    = (formData.get("content") as string)?.trim();
    const bibleVerse = (formData.get("bibleVerse") as string)?.trim() || null;
    const bibleText  = (formData.get("bibleText") as string)?.trim() || null;
    const scope      = (formData.get("scope") as string) === "CELL_GROUP"
      ? "CELL_GROUP" : "PUBLIC";

    if (!content || content.length < 10) {
      return { error: "Please write at least a sentence before posting." };
    }
    if (content.length > 2000) {
      return { error: "Reflection must be under 2000 characters." };
    }

    await db.post.create({
      data: {
        authorId:   user.id,
        content,
        bibleVerse,
        bibleText,
        scope,
        cellGroupId: scope === "CELL_GROUP" ? (user.cellGroupId ?? null) : null,
        isApproved:  user.role === "ADMIN", // admins skip the approval queue
      },
    });
    return { success: "Reflection submitted for review." };
  }

  if (intent === "toggleLike") {
    const postId = formData.get("postId") as string;
    const existing = await db.like.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });
    if (existing) {
      await db.like.delete({ where: { id: existing.id } });
    } else {
      await db.like.create({ data: { postId, userId: user.id } });
    }
    return { success: true };
  }

  if (intent === "createComment") {
    const postId  = formData.get("postId") as string;
    const content = (formData.get("content") as string)?.trim();
    if (!content || content.length > 500) {
      return { error: "Comment must be between 1 and 500 characters." };
    }
    await db.comment.create({
      data: { postId, authorId: user.id, content },
    });
    return { success: "Comment posted." };
  }

  if (intent === "approvePost") {
    if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
    const postId = formData.get("postId") as string;
    await db.post.update({ where: { id: postId }, data: { isApproved: true } });
    return { success: "Post approved." };
  }

  if (intent === "rejectPost") {
    if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
    const postId = formData.get("postId") as string;
    await db.post.delete({ where: { id: postId } });
    return { success: "Post removed." };
  }

  return { error: "Unknown action." };
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

export default function CommunityPage() {
  const { posts, pendingPosts, userRole, cellGroupId } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const lastActionDataRef = useRef<object | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const isPosting  = navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "createPost";

  useEffect(() => {
    if (navigation.state === "submitting") {
      lastActionDataRef.current = null;
    }
  }, [navigation.state]);

  useEffect(() => {
    if (!actionData || typeof actionData !== "object") {
      return;
    }

    if (isPosting) {
      setShowComposer(true);
    }

    if (navigation.state !== "idle") {
      return;
    }

    if ("error" in actionData && actionData.error) {
      setShowComposer(true);
    }

    if ("success" in actionData && actionData.success === "Reflection submitted for review.") {
      setShowComposer(false);
    }

    const message =
      "error" in actionData && actionData.error
        ? actionData.error
        : "success" in actionData && typeof actionData.success === "string"
        ? actionData.success
        : null;

    if (!message || lastActionDataRef.current === actionData) {
      return;
    }

    lastActionDataRef.current = actionData;
    if ("error" in actionData && actionData.error) {
      toast.error(message, { autoClose: 6000, role: "alert" });
    } else {
      toast.success(message, { role: "status" });
    }
  }, [actionData, isPosting, navigation.state]);

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Members Portal"
        title="Shared Reflections"
        subtitle="Share what God is speaking to you through His Word."
      />

      <div className="mx-auto w-full max-w-5xl">
        <section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-red-950 via-red-900 to-amber-800 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">Scripture · Reflection · Fellowship</p>
            <h2 className="mt-3 font-serif text-2xl font-bold leading-tight text-white sm:text-3xl">Faith grows when we share it.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-red-50 sm:text-base">
              Read reflections from your church family, find encouragement in Scripture, and share what God is teaching you.
            </p>
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-red-950 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-900"
              aria-expanded={showComposer}
              aria-controls="community-reflection-form"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Share a reflection
            </button>
          </div>
          <svg className="pointer-events-none absolute -bottom-10 -right-6 h-44 w-44 text-white/10 sm:bottom-0 sm:right-8 sm:h-56 sm:w-56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" aria-hidden="true">
            <path d="M3 5.5c3.3-.9 6.3-.3 9 1.7v13c-2.7-2-5.7-2.6-9-1.7z" />
            <path d="M21 5.5c-3.3-.9-6.3-.3-9 1.7v13c2.7-2 5.7-2.6 9-1.7z" />
            <path d="M12 7.2v13" />
          </svg>
        </section>

        {/* Admin approval queue */}
        {userRole === "ADMIN" && pendingPosts.length > 0 && (
          <PortalSection className="mb-6 border-amber-200 bg-amber-50/80">
            <PortalSectionHeading
              eyebrow="Admin review"
              title={`Pending approval · ${pendingPosts.length}`}
              subtitle="Review submitted reflections before they appear in the church feed."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {pendingPosts.map((p) => (
                <PortalPanel
                  key={p.id}
                  className="flex min-w-0 flex-col justify-between gap-4 border-amber-100 bg-white sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    {p.bibleVerse && (
                      <p className="mb-1 text-xs font-bold text-amber-700">
                        {p.bibleVerse}
                      </p>
                    )}
                    <p className="break-words text-sm leading-6 text-gray-700">{p.content}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Shared by {p.author.firstName} {p.author.lastName}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Form method="post">
                      <input type="hidden" name="intent" value="approvePost" />
                      <input type="hidden" name="postId" value={p.id} />
                      <button
                        type="submit"
                        className={portalButtonClasses({
                          className: "min-h-10 bg-green-700 px-3 text-xs hover:bg-green-800",
                        })}
                      >
                        Approve
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="rejectPost" />
                      <input type="hidden" name="postId" value={p.id} />
                      <button
                        type="submit"
                        className={portalButtonClasses({
                          variant: "danger",
                          className: "min-h-10 px-3 text-xs",
                        })}
                      >
                        Remove
                      </button>
                    </Form>
                  </div>
                </PortalPanel>
              ))}
            </div>
          </PortalSection>
        )}

      <Sheet open={showComposer} onOpenChange={setShowComposer}>
        <div className="absolute inset-x-4 top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-2xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-sans font-bold tracking-widest uppercase text-gray-400">
                Share a Reflection
              </p>
              <h2
                id="community-reflection-form"
                className="mt-2 font-serif text-2xl font-bold text-gray-900"
              >
                What is God showing you today?
              </h2>
              <p className="mt-2 text-sm font-sans leading-6 text-gray-500">
                Share a verse, a short reflection, or something your group can pray through this week.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              aria-label="Close reflection form"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <Form method="post" noValidate className="mt-5">
            <input type="hidden" name="intent" value="createPost" />

            <div className="mb-3">
              <label htmlFor="bibleVerse" className="sr-only">Scripture reference</label>
              <input
                id="bibleVerse"
                type="text"
                name="bibleVerse"
                placeholder="Scripture reference (e.g. John 15:5)"
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="bibleText" className="sr-only">Verse text (optional)</label>
              <input
                id="bibleText"
                type="text"
                name="bibleText"
                placeholder="Paste the verse text here (optional)"
                maxLength={500}
                className={inputClass}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="content" className="sr-only">Your reflection</label>
              <textarea
                id="content"
                name="content"
                rows={5}
                maxLength={2000}
                placeholder="Write your devotional reflection…"
                required
                aria-required="true"
                className={`${inputClass} min-h-[140px] resize-y`}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label htmlFor="scope" className="sr-only">Audience</label>
                <select
                  id="scope"
                  name="scope"
                  className="w-full cursor-pointer rounded-lg border border-gray-200
                             bg-white px-3 py-2 text-sm font-sans text-gray-600
                             focus:outline-none focus:ring-2 focus:ring-red-300 sm:w-auto"
                >
                  <option value="PUBLIC">Whole Church</option>
                  {cellGroupId && (
                    <option value="CELL_GROUP">My Cell Group Only</option>
                  )}
                </select>
              </div>

              <PendingButton
                type="submit"
                isPending={isPosting}
                pendingText="Posting..."
                className={portalButtonClasses({ className: "px-6" })}
              >
                Post Reflection
              </PendingButton>
            </div>
          </Form>

          {userRole !== "ADMIN" && (
            <p className="mt-4 text-xs text-gray-400 font-sans">
              Reflections are reviewed by an admin before appearing in the feed.
            </p>
          )}
        </div>
      </Sheet>

        {/* Feed */}
        <section aria-labelledby="community-feed-heading">
          <div className="mb-4 flex flex-col gap-1 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">From your church family</p>
              <h2 id="community-feed-heading" className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">Latest reflections</h2>
              <p className="mt-1 text-sm text-gray-500">Scripture and encouragement shared across the church.</p>
            </div>
            {posts.length > 0 ? <span className="text-sm text-gray-500">Showing {posts.length} recent {posts.length === 1 ? "reflection" : "reflections"}</span> : null}
          </div>
          {posts.length > 0 ? (
            <div className="mx-auto max-w-3xl space-y-4">
              {posts.map((post) => (
                <DevotionPost
                  key={post.id}
                  post={post}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="devotion"
              title="No reflections yet"
              message="Be the first to share what God is speaking to you today."
            />
          )}
        </section>
      </div>
    </PortalPage>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="devotion"
        title="Shared Reflections unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
      />
    </div>
  );
}
