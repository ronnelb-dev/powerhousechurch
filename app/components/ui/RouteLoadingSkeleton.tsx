import { cn } from "~/lib/utils";

type RouteLoadingSkeletonProps = {
  isLoading?: boolean;
  variant?: "public" | "portal" | "admin";
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

function PortalSkeleton({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <div className="flex min-h-dvh bg-gray-50">
      <aside className="hidden w-56 shrink-0 bg-red-900 p-4 md:block">
        <div className="space-y-2 border-b border-red-800/60 pb-5 pt-2">
          <SkeletonBlock className="h-5 w-36 bg-red-700/80" />
          <SkeletonBlock className="h-3 w-28 bg-red-800/80" />
        </div>
        <div className="mt-5 space-y-2">
          {Array.from({ length: isAdmin ? 11 : 6 }).map((_, index) => (
            <SkeletonBlock
              key={index}
              className={cn(
                "h-11 rounded-xl bg-red-800/80",
                index % 3 === 0 ? "w-full" : "w-10/12",
              )}
            />
          ))}
        </div>
      </aside>

      <main className="flex-1 pt-18 md:pt-0">
        {isAdmin ? (
          <div className="border-b border-gray-800 bg-gray-900 px-4 py-3 md:px-6">
            <SkeletonBlock className="h-3 w-24 bg-yellow-500/70" />
            <SkeletonBlock className="mt-2 h-4 w-36 bg-gray-700" />
          </div>
        ) : (
          <div className="fixed left-0 right-0 top-0 h-14 bg-red-900 px-4 py-2 md:hidden">
            <SkeletonBlock className="h-10 w-28 bg-red-800/80" />
          </div>
        )}

        <div className="max-w-6xl p-4 sm:p-6 md:p-8">
          <header className="mb-5 border-b border-gray-200 pb-4">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="mt-3 h-8 w-full max-w-sm" />
            <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-3 h-8 w-16" />
                <SkeletonBlock className="mt-3 h-3 w-32" />
              </div>
            ))}
          </section>

          <section className="mt-5 rounded-lg border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-44" />
                <SkeletonBlock className="h-3 w-64 max-w-full" />
              </div>
              <SkeletonBlock className="hidden h-10 w-28 rounded-md sm:block" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-gray-100 p-3 sm:grid-cols-[1.2fr_0.8fr_0.5fr]">
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-10/12" />
                  <SkeletonBlock className="h-4 w-20" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export function RouteLoadingSkeleton({
  isLoading = true,
  variant = "public",
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
      {variant === "public" ? <PublicSkeleton /> : <PortalSkeleton isAdmin={variant === "admin"} />}
      <span className="sr-only">{label}</span>
    </div>
  );
}
