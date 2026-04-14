// app/routes/portal/community.tsx
import {
  useLoaderData,
  useOutletContext,
  Form,
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
import { SectionHeader } from "~/components/ui/SectionHeader";

export const meta: MetaFunction = () => [
  { title: "Daily Bread — Powerhouse Church Portal" },
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
    currentUserId: user.id,
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
    return { success: true };
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
    return { success: true };
  }

  if (intent === "approvePost") {
    if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
    const postId = formData.get("postId") as string;
    await db.post.update({ where: { id: postId }, data: { isApproved: true } });
    return { success: true };
  }

  if (intent === "rejectPost") {
    if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
    const postId = formData.get("postId") as string;
    await db.post.delete({ where: { id: postId } });
    return { success: true };
  }

  return { error: "Unknown action." };
}

const inputClass =
  "w-full px-4 py-3 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all";

export default function CommunityPage() {
  const { posts, pendingPosts, currentUserId, userRole, cellGroupId } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isPosting  = navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "createPost";

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <SectionHeader
        eyebrow="Members Portal"
        title="Daily Bread"
        subtitle="Share what God is speaking to you through His Word."
      />

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

      {/* Post composer */}
      <div className="mt-8 bg-white border border-gray-100 rounded-xl p-6 mb-8">
        <p className="text-xs font-sans font-bold tracking-widest uppercase
                      text-gray-400 mb-4">
          Share a Reflection
        </p>
        <Form method="post" noValidate>
          <input type="hidden" name="intent" value="createPost" />

          {/* Bible verse */}
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

          {/* Bible text */}
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

          {/* Reflection */}
          <div className="mb-4">
            <label htmlFor="content" className="sr-only">Your reflection</label>
            <textarea
              id="content"
              name="content"
              rows={4}
              maxLength={2000}
              placeholder="Write your devotional reflection…"
              required
              aria-required="true"
              className={`${inputClass} resize-y min-h-[100px]`}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="scope" className="sr-only">Audience</label>
              <select
                id="scope"
                name="scope"
                className="text-sm font-sans px-3 py-2 border border-gray-200
                           rounded-lg bg-white text-gray-600 focus:outline-none
                           focus:ring-2 focus:ring-red-300 cursor-pointer"
              >
                <option value="PUBLIC">Whole Church</option>
                {cellGroupId && (
                  <option value="CELL_GROUP">My Cell Group Only</option>
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPosting}
              aria-busy={isPosting}
              className="px-6 py-2.5 bg-red-700 text-white font-sans font-bold
                         text-sm rounded-lg hover:bg-red-800 disabled:opacity-60
                         transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {isPosting ? "Posting…" : "Post Reflection"}
            </button>
          </div>
        </Form>

        {userRole !== "ADMIN" && (
          <p className="mt-3 text-xs text-gray-400 font-sans">
            Reflections are reviewed by an admin before appearing in the feed.
          </p>
        )}
      </div>

      {/* Feed */}
      {posts.length > 0 ? (
        <div>
          {posts.map((post) => (
            <DevotionPost
              key={post.id}
              post={post}
              currentUserId={currentUserId}
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
        title="Daily Bread unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
      />
    </div>
  );
}