import { cn } from "~/lib/utils";

type RouteLoadingSkeletonProps = {
  isLoading?: boolean;
  label?: string;
};

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-md bg-gray-200/80 motion-safe:animate-pulse", className)}
      aria-hidden="true"
    />
  );
}

function PublicSkeleton() {
  return (
    <div className="min-h-dvh bg-[#f8f5f0]">
      <div className="shell pt-3">
        <div className="flex items-center justify-between gap-4 rounded-[2rem] bg-white/75 px-4 py-3 shadow-[0_16px_45px_-34px_rgba(42,18,12,0.65)]">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-11 w-11 rounded-full bg-red-100" />
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-44 bg-red-100" />
              <SkeletonBlock className="hidden h-3 w-36 bg-amber-100 md:block" />
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-9 w-20 rounded-full" />
            ))}
          </div>
          <SkeletonBlock className="h-11 w-11 rounded-full lg:hidden" />
        </div>
      </div>

      <main className="shell grid gap-10 pb-16 pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-36">
        <section className="space-y-5">
          <SkeletonBlock className="h-4 w-36 bg-amber-100" />
          <div className="space-y-3">
            <SkeletonBlock className="h-12 w-full max-w-xl bg-red-100" />
            <SkeletonBlock className="h-12 w-10/12 max-w-lg bg-red-100" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-full max-w-xl" />
            <SkeletonBlock className="h-4 w-11/12 max-w-lg" />
            <SkeletonBlock className="h-4 w-8/12 max-w-md" />
          </div>
          <div className="flex gap-3 pt-2">
            <SkeletonBlock className="h-11 w-32 rounded-full bg-red-100" />
            <SkeletonBlock className="h-11 w-28 rounded-full" />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <SkeletonBlock className="aspect-[4/3] rounded-2xl bg-gray-200" />
          <div className="space-y-4">
            <SkeletonBlock className="h-36 rounded-2xl bg-white/80" />
            <SkeletonBlock className="h-36 rounded-2xl bg-white/80" />
          </div>
        </section>
      </main>
    </div>
  );
}

export function RouteLoadingSkeleton({
  isLoading = true,
  label = "Loading page",
}: RouteLoadingSkeletonProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-white pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <PublicSkeleton />
      <span className="sr-only">{label}</span>
    </div>
  );
}
