// app/components/church/DevotionPost.tsx
// The heart of the Daily Bread feed.
// Scripture block ALWAYS comes first — Community as Sacrament principle.
// Like button uses a dove SVG (not a heart emoji — consistent rendering).
// Optimistic like toggle via useFetcher.
// Comment composer is inline — no modal needed.

import { useFetcher } from "react-router";

export interface DevotionPostData {
  id:           string;
  bibleVerse:   string | null;
  bibleText:    string | null;
  content:      string;
  scope:        "PUBLIC" | "CELL_GROUP";
  createdAt:    string;
  author:       { id: string; firstName: string; lastName: string };
  likeCount:    number;
  commentCount: number;
  userHasLiked: boolean;
  comments: {
    id:        string;
    content:   string;
    createdAt: string;
    author:    { id: string; firstName: string; lastName: string };
  }[];
}

interface DevotionPostProps {
  post: DevotionPostData;
}

// Dove SVG — intentional over emoji for consistent cross-platform rendering
function DoveIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16" height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8"  x2="2"  y2="22"/>
      <line x1="17" y1="15" x2="9"  y2="15"/>
    </svg>
  );
}

export function DevotionPost({ post }: DevotionPostProps) {
  const likeFetcher    = useFetcher();
  const commentFetcher = useFetcher();

  // Optimistic like state
  const isLiked: boolean = likeFetcher.formData
    ? !post.userHasLiked  // toggle from what we had
    : post.userHasLiked;

  const likeCount: number = likeFetcher.formData
    ? isLiked ? post.likeCount + 1 : post.likeCount - 1
    : post.likeCount;

  const authorName    = `${post.author.firstName} ${post.author.lastName}`;
  const authorInitials = (post.author.firstName[0] ?? "") + (post.author.lastName[0] ?? "");
  const formattedDate  = new Date(post.createdAt).toLocaleDateString("en-PH", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  });

  return (
    <article
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4"
      aria-labelledby={`post-ref-${post.id}`}
    >
      {/* ── Scripture block — always first ─────────────────────────── */}
      {(post.bibleVerse || post.bibleText) && (
        <div className="bg-red-50 border-l-4 border-red-700 px-5 py-4">
          {post.bibleVerse && (
            <p
              id={`post-ref-${post.id}`}
              className="font-sans font-bold tracking-[0.15em] uppercase
                         text-red-600 text-xs mb-1.5"
            >
              {post.bibleVerse}
            </p>
          )}
          {post.bibleText && (
            <blockquote className="font-serif italic text-red-900 text-base leading-relaxed">
              "{post.bibleText}"
            </blockquote>
          )}
        </div>
      )}

      {/* ── Reflection body ─────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="font-sans text-base text-gray-700 leading-relaxed">
          {post.content}
        </p>
      </div>

      {/* ── Author + scope ──────────────────────────────────────────── */}
      <div className="px-5 pb-4 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full bg-red-50 border border-red-100
                     flex items-center justify-center text-xs font-bold
                     text-red-700 font-sans shrink-0"
          aria-hidden="true"
        >
          {authorInitials.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-bold text-sm text-gray-800">{authorName}</p>
          <p className="font-sans text-xs text-gray-400">{formattedDate}</p>
        </div>
        {post.scope === "CELL_GROUP" && (
          <span className="font-sans font-bold text-xs text-red-600
                           bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
            Cell Group
          </span>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="mx-5 border-t border-gray-100" />

      {/* ── Actions bar ─────────────────────────────────────────────── */}
      <div className="px-5 py-3 flex items-center gap-4">
        {/* Dove like */}
        <likeFetcher.Form method="post" action="/portal/community">
          <input type="hidden" name="intent"  value="toggleLike" />
          <input type="hidden" name="postId"  value={post.id} />
          <button
            type="submit"
            className={[
              "inline-flex items-center gap-1.5 font-sans font-bold text-sm",
              "min-h-11 px-3 rounded-lg transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-red-300",
              "touch-manipulation",
              isLiked
                ? "text-red-700 bg-red-50"
                : "text-gray-400 hover:text-red-600 hover:bg-red-50",
            ].join(" ")}
            aria-label={
              isLiked
                ? `Unlike this reflection (${likeCount} likes)`
                : `Like this reflection (${likeCount} likes)`
            }
            aria-pressed={isLiked}
          >
            <DoveIcon />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        </likeFetcher.Form>

        {/* Comment count */}
        <button
          className="inline-flex items-center gap-1.5 font-sans font-bold text-sm
                     text-gray-400 hover:text-gray-600 hover:bg-gray-50
                     min-h-11 px-3 rounded-lg transition-all duration-150
                     focus:outline-none focus:ring-2 focus:ring-gray-200
                     touch-manipulation"
          aria-label={`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </button>
      </div>

      {/* ── Comments ────────────────────────────────────────────────── */}
      {post.comments.length > 0 && (
        <div
          className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-3"
          role="list"
          aria-label="Comments"
        >
          {post.comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5" role="listitem">
              <div
                className="w-7 h-7 rounded-full bg-red-100 shrink-0
                           flex items-center justify-center text-xs font-bold
                           text-red-700 font-sans mt-0.5"
                aria-hidden="true"
              >
                {(comment.author.firstName[0] ?? "").toUpperCase()}
              </div>
              <p className="text-sm font-sans text-gray-600">
                <span className="font-bold text-gray-700">
                  {comment.author.firstName} {comment.author.lastName}
                </span>{" "}
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Comment composer ─────────────────────────────────────────── */}
      <commentFetcher.Form
        method="post"
        action="/portal/community"
        className="border-t border-gray-100 px-4 py-3 flex gap-2"
      >
        <input type="hidden" name="intent"  value="createComment" />
        <input type="hidden" name="postId"  value={post.id} />
        <input
          type="text"
          name="content"
          placeholder="Add a reflection…"
          maxLength={500}
          className="flex-1 min-h-11 text-base font-sans bg-gray-50
                     border border-gray-200 rounded-xl px-3
                     text-gray-700 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-red-300
                     focus:border-transparent transition-all"
          aria-label="Write a comment on this reflection"
        />
        <button
          type="submit"
          className="min-h-11 px-4 rounded-xl bg-red-700 text-white
                     font-sans font-bold text-sm hover:bg-red-800
                     active:bg-red-900 transition-colors touch-manipulation
                     focus:outline-none focus:ring-2 focus:ring-red-400
                     disabled:opacity-50"
          disabled={commentFetcher.state === "submitting"}
          aria-label="Post comment"
        >
          Post
        </button>
      </commentFetcher.Form>
    </article>
  );
}
