import { useFetcher } from "react-router";

export interface DevotionPostData {
  id: string;
  bibleVerse: string | null;
  bibleText: string | null;
  content: string;
  scope: "PUBLIC" | "CELL_GROUP";
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
  likeCount: number;
  commentCount: number;
  userHasLiked: boolean;
  comments: {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; firstName: string; lastName: string };
  }[];
}

interface DevotionPostProps {
  post: DevotionPostData;
  currentUserId: string;
}

export function DevotionPost({ post, currentUserId }: DevotionPostProps) {
  const likeFetcher = useFetcher();
  const commentFetcher = useFetcher();

  // Optimistic like toggle
  const isLiked = likeFetcher.formData
    ? likeFetcher.formData.get("intent") === "toggleLike"
      ? !post.userHasLiked
      : post.userHasLiked
    : post.userHasLiked;

  const likeCount = likeFetcher.formData
    ? isLiked ? post.likeCount + 1 : post.likeCount - 1
    : post.likeCount;

  const authorInitials =
    post.author.firstName[0] + post.author.lastName[0];

  const formattedDate = new Date(post.createdAt).toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <article
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4"
      aria-labelledby={`post-verse-${post.id}`}
    >
      {/* Scripture block — always first, always prominent */}
      {(post.bibleVerse || post.bibleText) && (
        <div className="bg-primary-50 border-l-4 border-red-700 px-5 py-4">
          {post.bibleVerse && (
            <p
              id={`post-verse-${post.id}`}
              className="text-xs font-sans font-bold tracking-widest uppercase
                         text-red-600 mb-1"
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

      {/* Reflection body */}
      <div className="px-5 py-4">
        <p className="text-gray-800 font-sans text-sm leading-relaxed">
          {post.content}
        </p>
      </div>

      {/* Author + scope */}
      <div className="px-5 pb-4 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full bg-red-50 border border-red-100
                     flex items-center justify-center text-xs font-bold
                     text-red-700 font-sans flex-shrink-0"
          aria-hidden="true"
        >
          {authorInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-sans font-bold text-gray-800">
            {post.author.firstName} {post.author.lastName}
          </p>
          <p className="text-xs text-gray-400 font-sans">{formattedDate}</p>
        </div>
        {post.scope === "CELL_GROUP" && (
          <span className="text-xs font-sans font-bold text-red-600
                           bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
            Cell Group
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-gray-100" />

      {/* Dove like + comment count */}
      <div className="px-5 py-3 flex items-center gap-4">
        <likeFetcher.Form method="post" action="/portal/community">
          <input type="hidden" name="intent" value="toggleLike" />
          <input type="hidden" name="postId" value={post.id} />
          <button
            type="submit"
            className={[
              "flex items-center gap-1.5 text-xs font-sans font-bold",
              "px-3 py-1.5 rounded-lg transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-red-300",
              isLiked
                ? "text-red-700 bg-red-50"
                : "text-gray-400 hover:text-red-600 hover:bg-red-50",
            ].join(" ")}
            aria-label={isLiked ? `Unlike this reflection (${likeCount} likes)` : `Like this reflection (${likeCount} likes)`}
            aria-pressed={isLiked}
          >
            {/* Dove SVG — not emoji, for consistent rendering */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
              <line x1="16" y1="8" x2="2" y2="22"/>
              <line x1="17" y1="15" x2="9" y2="15"/>
            </svg>
            {likeCount > 0 ? likeCount : ""}
            <span className="sr-only">
              {isLiked ? "liked" : "like"}
            </span>
          </button>
        </likeFetcher.Form>

        <button
          className="flex items-center gap-1.5 text-xs font-sans font-bold
                     text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg
                     hover:bg-gray-50 transition-all focus:outline-none focus:ring-2
                     focus:ring-gray-200"
          aria-expanded={post.commentCount > 0}
          aria-controls={`comments-${post.id}`}
          aria-label={`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {post.commentCount > 0 ? post.commentCount : ""}
          Comment{post.commentCount !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Comments */}
      {post.comments.length > 0 && (
        <div
          id={`comments-${post.id}`}
          className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-3"
          role="list"
          aria-label="Comments"
        >
          {post.comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5" role="listitem">
              <div
                className="w-6 h-6 rounded-full bg-red-100 flex-shrink-0
                           flex items-center justify-center text-xs font-bold
                           text-red-700 font-sans mt-0.5"
                aria-hidden="true"
              >
                {comment.author.firstName[0]}
              </div>
              <div>
                <span className="text-xs font-sans font-bold text-gray-700">
                  {comment.author.firstName} {comment.author.lastName}
                </span>{" "}
                <span className="text-xs text-gray-600 font-sans">
                  {comment.content}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment composer */}
      <commentFetcher.Form
        method="post"
        action="/portal/community"
        className="border-t border-gray-100 px-5 py-3 flex gap-2"
      >
        <input type="hidden" name="intent" value="createComment" />
        <input type="hidden" name="postId" value={post.id} />
        <input
          type="text"
          name="content"
          placeholder="Add a reflection…"
          maxLength={500}
          className="flex-1 text-xs font-sans bg-gray-50 border border-gray-200
                     rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-red-300
                     focus:border-transparent transition-all"
          aria-label="Write a comment"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg bg-red-700 text-white text-xs
                     font-sans font-bold hover:bg-red-800 transition-colors
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

export default DevotionPost;