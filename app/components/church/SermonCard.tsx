import { Link } from "react-router";

interface SermonCardProps {
  id: string;
  title: string;
  speaker: string;
  series?: string | null;
  date: string;
  thumbnail?: string | null;
  tags?: string;
}

export function SermonCard({
  id, title, speaker, series, date, thumbnail, tags,
}: SermonCardProps) {
  const tagList = tags ? tags.split(",").filter(Boolean) : [];
  const formattedDate = new Date(date).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <article>
      <Link
        to={`/sermons/${id}`}
        className="block bg-white border border-gray-100 rounded-2xl overflow-hidden
                   hover:border-red-300 hover:shadow-md transition-all duration-200
                   focus:outline-none focus:ring-2 focus:ring-red-400 group"
        aria-label={`Listen to sermon: ${title} by ${speaker}`}
      >
        {/* Thumbnail */}
        <div
          className="h-40 bg-gradient-to-br from-red-700 to-red-900
                     flex items-center justify-center relative overflow-hidden"
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            /* Cross motif placeholder */
            <div className="text-white/20 font-serif text-7xl font-bold select-none"
                 aria-hidden="true">
              ✝
            </div>
          )}
          {/* Play overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center
                       bg-black/0 group-hover:bg-black/20 transition-all duration-200"
            aria-hidden="true"
          >
            <div className="w-12 h-12 rounded-full bg-white/0 group-hover:bg-white/20
                            border-2 border-transparent group-hover:border-white/60
                            flex items-center justify-center transition-all duration-200">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <polygon points="5,3 14,9 5,15"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {series && (
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-600 mb-1.5 truncate">
              {series}
            </p>
          )}
          <h3 className="font-serif text-lg font-bold text-gray-900
                         leading-snug mb-2 group-hover:text-red-800
                         transition-colors line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-gray-500 font-sans mb-3">
            {speaker} · {formattedDate}
          </p>
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Tags">
              {tagList.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-sans font-bold text-red-700
                             bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}