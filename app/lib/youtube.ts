export function buildEmbedUrl(videoId: string, autoplay = false): string {
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  params.set("rel", "0");
  params.set("modestbranding", "1");
  const qs = params.toString();
  return `https://www.youtube.com/embed/${videoId}${qs ? `?${qs}` : ""}`;
}

export function parseVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const vid =
      u.searchParams.get("v") ||
      (u.hostname === "youtu.be" ? u.pathname.slice(1) : null);
    return vid || null;
  } catch {
    return null;
  }
}
