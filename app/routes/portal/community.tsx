// app/routes/portal/community.tsx
import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  Link,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { DevotionPost } from "~/components/church/DevotionPost";
import { EmptyState } from "~/components/ui/EmptyState";
import { PendingButton } from "~/components/ui/PendingButton";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { Sheet } from "~/components/ui/sheet";
import { useToast } from "~/components/ui/ToastProvider";
import { useEffect, useRef, useState } from "react";

export const meta: MetaFunction = () => [
  { title: "Community — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  const latestSermon = await db.sermon.findFirst({
    where: {
      isPublished: true,
      OR: [
        { weeklyGuide: { not: null } },
        { reflectionPrompts: { not: null } },
        { scriptureFocus: { not: null } },
      ],
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      speaker: true,
      date: true,
      scriptureFocus: true,
      weeklyGuide: true,
      reflectionPrompts: true,
    },
  });

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
    latestSermon: latestSermon
      ? {
          ...latestSermon,
          date: latestSermon.date instanceof Date
            ? latestSermon.date.toISOString()
            : latestSermon.date,
        }
      : null,
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
  const { latestSermon, posts, pendingPosts, userRole, cellGroupId } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const isPosting  = navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "createPost";
  const reflectionPrompts = latestSermon?.reflectionPrompts
    ? latestSermon.reflectionPrompts
        .split(/\r?\n/)
        .map((prompt) => prompt.trim())
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!actionData || typeof actionData !== "object") {
      return;
    }

    if (("error" in actionData && actionData.error) || isPosting) {
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

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: "error" in actionData && actionData.error ? "error" : "success",
      message,
    });
  }, [actionData, showToast]);

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <SectionHeader
        eyebrow="Members Portal"
        title="Community"
        subtitle="Share what God is speaking to you through His Word."
      />

      {latestSermon && (
        <div className="mt-8 rounded-3xl border border-red-100 bg-linear-to-br from-red-50 via-white to-amber-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-sans font-bold tracking-[0.2em] uppercase text-red-700 mb-2">
                This Week's Sermon Guide
              </p>
              <h2 className="font-serif text-2xl font-bold text-gray-900">
                {latestSermon.title}
              </h2>
              <p className="mt-1 text-sm font-sans text-gray-500">
                {latestSermon.speaker} ·{" "}
                {new Date(latestSermon.date).toLocaleDateString("en-PH", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
            <Link
              to={`/sermons/${latestSermon.id}`}
              className="inline-flex items-center rounded-full bg-red-700 px-4 py-2 text-xs font-sans font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-red-800"
            >
              Open Sermon
            </Link>
          </div>

          {latestSermon.scriptureFocus && (
            <div className="mt-5">
              <p className="text-xs font-sans font-bold uppercase tracking-[0.18em] text-red-700 mb-2">
                Scripture Focus
              </p>
              <p className="text-sm font-sans leading-7 text-gray-700">
                {latestSermon.scriptureFocus}
              </p>
            </div>
          )}

          {latestSermon.weeklyGuide && (
            <div className="mt-5">
              <p className="text-xs font-sans font-bold uppercase tracking-[0.18em] text-red-700 mb-2">
                Weekly Guide
              </p>
              <div className="whitespace-pre-wrap text-sm font-sans leading-7 text-gray-700">
                {latestSermon.weeklyGuide}
              </div>
            </div>
          )}

          {reflectionPrompts.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-sans font-bold uppercase tracking-[0.18em] text-red-700 mb-3">
                Reflection Prompts
              </p>
              <div className="space-y-3">
                {reflectionPrompts.map((prompt) => (
                  <div
                    key={prompt}
                    className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm font-sans text-gray-700 shadow-sm"
                  >
                    {prompt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin approval queue */}
      {userRole === "ADMIN" && pendingPosts.length > 0 && (
        <div className="mt-8 mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-xs font-sans font-bold tracking-widest uppercase
                        text-amber-700 mb-3">
            Pending Approval ({pendingPosts.length})
          </p>
          <div className="space-y-3">
            {pendingPosts.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-amber-100 rounded-lg p-4
                           flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  {p.bibleVerse && (
                    <p className="text-xs font-bold text-amber-700 mb-1">
                      {p.bibleVerse}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 font-sans">{p.content}</p>
                  <p className="text-xs text-gray-400 font-sans mt-1">
                    by {p.author.firstName} {p.author.lastName}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Form method="post">
                    <input type="hidden" name="intent" value="approvePost" />
                    <input type="hidden" name="postId" value={p.id} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-green-600 text-white text-xs
                                 font-bold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="rejectPost" />
                    <input type="hidden" name="postId" value={p.id} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs
                                 font-bold rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Remove
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                className="rounded-lg bg-red-700 px-6 py-2.5 text-sm font-sans font-bold
                           text-white transition-all hover:bg-red-800 disabled:opacity-60
                           focus:outline-none focus:ring-2 focus:ring-red-400"
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

      <button
        type="button"
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-red-700 px-4 py-3 text-sm font-sans font-bold text-white shadow-[0_18px_35px_-18px_rgba(146,18,28,0.8)] transition-all hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 md:bottom-8 md:right-8"
        aria-expanded={showComposer}
        aria-controls="community-reflection-form"
        aria-label="Share a reflection"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span>Share</span>
      </button>

      {/* Feed */}
      {posts.length > 0 ? (
        <div>
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
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="devotion"
        title="Community unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
      />
    </div>
  );
}
