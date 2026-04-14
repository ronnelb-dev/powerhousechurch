// app/routes/gallery.tsx
// Photo gallery powered by Cloudinary.
// Photos are fetched from the Cloudinary Admin API using a tag prefix "powerhouse-".
// Lightbox is implemented with a CSS-only detail/summary approach — no JS library.

import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import { useState } from "react";
import type { MetaFunction } from "react-router";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Gallery — Powerhouse Church" },
  { name: "description", content: "Photos from Powerhouse Church services, events, and community life." },
];

interface CloudinaryImage {
  public_id:   string;
  secure_url:  string;
  width:       number;
  height:      number;
  tags:        string[];
  context?:    { custom?: { caption?: string } };
}

// Cloudinary image transformation helpers
function thumbUrl(publicId: string): string {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_400,h_300,q_auto,f_auto/${publicId}`;
}

function fullUrl(publicId: string): string {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1200,q_auto,f_auto/${publicId}`;
}

export async function loader() {
  // If Cloudinary isn't configured, return demo data so the UI still renders
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return { images: [], tags: [], configured: false };
  }

  try {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
      api_key:     process.env.CLOUDINARY_API_KEY,
      api_secret:  process.env.CLOUDINARY_API_SECRET,
      secure:      true,
    });

    // Fetch up to 100 images tagged with "powerhouse" prefix
    const result = await cloudinary.api.resources_by_tag("powerhouse", {
      max_results: 100,
      tags: true,
      context: true,
    }) as { resources: CloudinaryImage[] };

    // Collect all unique sub-tags (e.g. "powerhouse-easter", "powerhouse-youth")
    const tagSet = new Set<string>();
    for (const img of result.resources) {
      for (const tag of img.tags ?? []) {
        if (tag !== "powerhouse") tagSet.add(tag);
      }
    }

    return {
      images: result.resources,
      tags:   [...tagSet].sort(),
      configured: true,
    };
  } catch {
    return { images: [], tags: [], configured: false };
  }
}

export default function GalleryPage() {
  const { images, tags, configured } = useLoaderData<typeof loader>();
  const [activeTag,   setActiveTag]   = useState<string>("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>("");

  const filtered = activeTag
    ? images.filter((img) => img.tags?.includes(activeTag))
    : images;

  return (
    <>
      <PageHero
        title="Gallery"
        subtitle="Moments of worship, community, and the grace of God captured in time."
      />

      {/* Lightbox overlay */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo lightbox"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white
                       text-3xl leading-none focus:outline-none focus:ring-2
                       focus:ring-white/50 rounded"
            onClick={() => setLightboxSrc(null)}
            aria-label="Close lightbox"
          >
            ×
          </button>
          <img
            src={lightboxSrc}
            alt={lightboxAlt}
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-16">
        {!configured && (
          <div className="mb-8 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl
                          text-sm font-sans text-amber-800">
            <span className="font-bold">Cloudinary not configured.</span> Set{" "}
            <code className="bg-amber-100 px-1 rounded text-xs">CLOUDINARY_CLOUD_NAME</code>,{" "}
            <code className="bg-amber-100 px-1 rounded text-xs">CLOUDINARY_API_KEY</code>, and{" "}
            <code className="bg-amber-100 px-1 rounded text-xs">CLOUDINARY_API_SECRET</code> in{" "}
            your <code className="bg-amber-100 px-1 rounded text-xs">.env</code> file to enable the gallery.
          </div>
        )}

        {/* Tag filters */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10" aria-label="Filter by event tag">
            <button
              onClick={() => setActiveTag("")}
              className={[
                "px-4 py-2 rounded-full text-sm font-sans font-bold border transition-all",
                "focus:outline-none focus:ring-2 focus:ring-red-300",
                activeTag === ""
                  ? "bg-red-700 text-white border-red-700"
                  : "bg-white text-gray-500 border-gray-200 hover:border-red-300",
              ].join(" ")}
              aria-pressed={activeTag === ""}
            >
              All Photos
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={[
                  "px-4 py-2 rounded-full text-sm font-sans font-bold border transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-red-300",
                  activeTag === tag
                    ? "bg-red-700 text-white border-red-700"
                    : "bg-white text-gray-500 border-gray-200 hover:border-red-300",
                ].join(" ")}
                aria-pressed={activeTag === tag}
              >
                {tag.replace("powerhouse-", "").replace(/-/g, " ")}
              </button>
            ))}
          </div>
        )}

        {/* Photo grid */}
        {filtered.length > 0 ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {filtered.map((img) => {
              const caption = img.context?.custom?.caption ?? "";
              const alt     = (caption || img.public_id.split("/").pop()) ?? "Church photo";
              return (
                <div
                  key={img.public_id}
                  className="break-inside-avoid rounded-xl overflow-hidden cursor-pointer
                             border border-gray-100 hover:border-red-200 hover:shadow-md
                             transition-all group"
                  onClick={() => {
                    setLightboxSrc(fullUrl(img.public_id));
                    setLightboxAlt(alt);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View photo: ${alt}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLightboxSrc(fullUrl(img.public_id));
                      setLightboxAlt(alt);
                    }
                  }}
                >
                  <img
                    src={thumbUrl(img.public_id)}
                    alt={alt}
                    loading="lazy"
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover group-hover:scale-105
                               transition-transform duration-300"
                  />
                  {caption && (
                    <div className="px-3 py-2 bg-white">
                      <p className="text-xs text-gray-500 font-sans">{caption}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : configured ? (
          <EmptyState
            icon="events"
            title="No photos yet"
            message={
              activeTag
                ? "No photos found for this tag. Try another filter."
                : "Photos will appear here once uploaded to Cloudinary with the 'powerhouse' tag."
            }
          />
        ) : null}
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return (
    <EmptyState
      icon="events"
      title="Gallery unavailable"
      message="Please try again later."
      action={{ label: "Go home", to: "/" }}
    />
  );
}