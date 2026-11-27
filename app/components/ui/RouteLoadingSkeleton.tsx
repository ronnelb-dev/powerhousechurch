import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { RouteSkeletonPage } from "~/lib/route-loading";

type RouteLoadingSkeletonProps = {
  isLoading?: boolean;
  page: RouteSkeletonPage;
  label?: string;
};

function Block({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-gray-200/80 motion-safe:animate-pulse", className)} />;
}

function PageHeading({ title = "w-56", subtitle = true }: { title?: string; subtitle?: boolean }) {
  return <header className="mb-6 space-y-3 border-b border-gray-200 pb-5"><Block className="h-3 w-28" /><Block className={`h-8 max-w-full ${title}`} />{subtitle ? <Block className="h-4 w-full max-w-2xl" /> : null}</header>;
}

function Lines({ count = 4 }: { count?: number }) {
  return <div aria-hidden="true" className="space-y-3">{Array.from({ length: count }, (_, index) => <Block key={index} className={cn("h-3", index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-11/12" : "w-8/12")} />)}</div>;
}

function Card({ children, className }: { children?: ReactNode; className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-2xl border border-gray-200 bg-white p-5 shadow-sm", className)}>{children ?? <div className="space-y-4"><Block className="h-4 w-32" /><Lines count={3} /></div>}</div>;
}

function Rows({ count = 5, className }: { count?: number; className?: string }) {
  return <div aria-hidden="true" className={cn("divide-y divide-gray-100", className)}>{Array.from({ length: count }, (_, index) => <div key={index} className="flex min-h-16 items-center gap-4 py-3"><Block className="h-10 w-10 shrink-0 rounded-full bg-red-100" /><div className="min-w-0 flex-1 space-y-2"><Block className="h-4 w-40 max-w-full" /><Block className="h-3 w-56 max-w-full bg-gray-100" /></div><Block className="hidden h-9 w-20 rounded-lg sm:block" /></div>)}</div>;
}

function PublicShell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-[#f8f5f0]"><div className="shell pt-3"><div className="flex items-center justify-between gap-4 rounded-[2rem] bg-white/75 px-4 py-3 shadow-sm"><div className="flex items-center gap-3"><Block className="h-11 w-11 rounded-full bg-red-100" /><div className="space-y-2"><Block className="h-5 w-40 bg-red-100" /><Block className="hidden h-3 w-32 bg-amber-100 md:block" /></div></div><div className="hidden items-center gap-2 lg:flex">{Array.from({ length: 6 }, (_, i) => <Block key={i} className="h-9 w-20 rounded-full" />)}</div><Block className="h-11 w-11 rounded-full lg:hidden" /></div></div><main className="shell pb-16 pt-10 sm:pt-14">{children}</main></div>;
}

function PortalShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return (
    <div className="flex min-h-dvh bg-gray-50">
      <aside className="hidden w-56 shrink-0 bg-red-900 p-4 md:block">
        <div className="space-y-2 border-b border-red-800/60 pb-5 pt-2">
          <Block className="h-5 w-36 bg-red-700/80" />
          <Block className="h-3 w-28 bg-red-800/80" />
        </div>
        <div className="mt-5 space-y-2">
          {Array.from({ length: admin ? 11 : 7 }, (_, i) => (
            <Block
              key={i}
              className={cn("h-11 rounded-xl bg-red-800/80", i % 3 === 0 ? "w-full" : "w-10/12")}
            />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 pt-16 md:pt-0">
        <div className="fixed inset-x-0 top-0 z-10 h-14 bg-red-900 px-4 py-2 md:hidden">
          <Block className="h-10 w-28 bg-red-800/80" />
        </div>
        <div className="mx-auto w-full max-w-8xl p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

function AuthPage({ page }: { page: "login" | "register" | "forgot-password" | "reset-password" }) {
  const fieldCount = page === "register" ? 7 : page === "reset-password" ? 2 : page === "login" ? 2 : 1;
  return <div className="flex min-h-dvh items-center justify-center bg-primary-50 px-4 py-10"><Card className="w-full max-w-md p-7 sm:p-9"><div className="mb-8 space-y-3 text-center"><Block className="mx-auto h-6 w-44 bg-red-100" /><Block className="mx-auto h-8 w-56 max-w-full" /><Block className="mx-auto h-3 w-64 max-w-full" /></div><div className="space-y-4">{Array.from({ length: fieldCount }, (_, i) => <div key={i} className="space-y-2"><Block className="h-3 w-24" /><Block className="h-12 w-full rounded-lg" /></div>)}<Block className="mt-2 h-12 w-full rounded-lg bg-red-100" /></div><Block className="mx-auto mt-5 h-3 w-40" /></Card></div>;
}

function PublicContent({ page }: { page: RouteSkeletonPage }) {
  switch (page) {
    case "home":
      return <div className="grid gap-9 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><section className="space-y-5"><Block className="h-4 w-36 bg-amber-100" /><Block className="h-12 w-full max-w-xl bg-red-100" /><Block className="h-12 w-10/12 max-w-lg bg-red-100" /><Lines count={3} /><div className="flex gap-3"><Block className="h-11 w-32 rounded-full bg-red-100" /><Block className="h-11 w-28 rounded-full" /></div></section><section className="grid gap-4 sm:grid-cols-2"><Block className="aspect-[4/3] rounded-2xl" /><div className="space-y-4"><Card className="h-36" /><Card className="h-36" /></div></section></div>;
    case "about":
      return <><PageHeading title="w-64" /><div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]"><Card><Lines count={8} /></Card><div className="space-y-4"><Card className="h-40" /><Card className="h-40" /></div></div></>;
    case "ministries":
      return <><PageHeading title="w-60" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Card key={i} className="space-y-4"><Block className="h-32 rounded-xl bg-red-50" /><Block className="h-5 w-36" /><Lines count={2} /></Card>)}</div></>;
    case "cell-groups":
      return <><PageHeading title="w-64" /><div className="mb-5 flex flex-wrap gap-3"><Block className="h-11 w-full max-w-sm rounded-lg" /><Block className="h-11 w-40 rounded-lg" /><Block className="h-11 w-28 rounded-lg bg-red-100" /></div><div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Card key={i}><div className="mb-4 flex items-center gap-3"><Block className="h-12 w-12 rounded-full bg-red-100" /><Block className="h-5 w-40" /></div><Lines count={3} /></Card>)}</div></>;
    case "events":
      return <><PageHeading title="w-52" /><div className="mb-5 flex flex-wrap gap-3"><Block className="h-11 w-36 rounded-lg" /><Block className="h-11 w-36 rounded-lg" /><Block className="h-11 w-24 rounded-lg bg-red-100" /></div><div className="grid gap-5 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Card key={i} className="p-0"><Block className="h-44 rounded-b-none rounded-t-2xl bg-gray-300" /><div className="space-y-3 p-5"><Block className="h-3 w-24 bg-amber-100" /><Block className="h-5 w-48" /><Lines count={2} /></div></Card>)}</div></>;
    case "new-here":
    case "welcome-inside":
      return <><PageHeading title={page === "new-here" ? "w-60" : "w-72"} /><div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><Card className="min-h-72 bg-red-50"><Block className="h-full min-h-64 rounded-xl bg-red-100" /></Card><Card><div className="space-y-5"><Block className="h-6 w-48" /><Lines count={5} /><Block className="h-11 w-36 rounded-full bg-red-100" /></div></Card></div><div className="mt-6 grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Block className="h-10 w-10 rounded-full bg-amber-100" /><Block className="mt-4 h-4 w-32" /><Lines count={2} /></Card>)}</div></>;
    case "give":
      return <><PageHeading title="w-52" /><div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]"><Card className="bg-red-50"><Block className="h-6 w-48" /><Lines count={6} /></Card><Card><Block className="h-5 w-40" /><div className="my-5 grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, i) => <Block key={i} className="h-12 rounded-lg" />)}</div><Block className="h-12 w-full rounded-lg bg-red-100" /></Card></div></>;
    case "live":
      return <><PageHeading title="w-48" /><div className="grid gap-5 lg:grid-cols-[1.5fr_0.5fr]"><Block className="aspect-video rounded-2xl bg-gray-800" /><div className="space-y-4"><Card className="h-40" /><Card className="h-40" /></div></div></>;
    case "contact":
    case "prayer-request":
      return <><PageHeading title={page === "contact" ? "w-52" : "w-72"} /><div className="grid gap-6 lg:grid-cols-[1fr_0.65fr]"><Card><div className="space-y-4">{Array.from({ length: page === "contact" ? 4 : 3 }, (_, i) => <div key={i} className="space-y-2"><Block className="h-3 w-24" /><Block className={cn("w-full rounded-lg", i === 3 ? "h-32" : "h-11")} /></div>)}<Block className="h-11 w-36 rounded-lg bg-red-100" /></div></Card><div className="space-y-4"><Card className="h-36" /><Card className="h-36" /></div></div></>;
    case "gallery":
      return <><PageHeading title="w-48" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 12 }, (_, i) => <Block key={i} className={cn("rounded-xl bg-gray-300", i % 5 === 0 ? "aspect-[4/5]" : "aspect-square")} />)}</div></>;
    case "preaching":
    case "sermons":
      return <><PageHeading title={page === "preaching" ? "w-56" : "w-40"} /><div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Card className="p-0"><Block className="aspect-video rounded-b-none rounded-t-2xl bg-gray-300" /><div className="space-y-3 p-5"><Block className="h-5 w-56" /><Lines count={3} /></div></Card><div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Card key={i} className="flex gap-3"><Block className="h-20 w-28 shrink-0 rounded-lg bg-gray-300" /><div className="flex-1 space-y-3"><Block className="h-4 w-32" /><Lines count={2} /></div></Card>)}</div></div></>;
    case "blog-index":
      return <><PageHeading title="w-44" /><div className="mb-5 flex gap-3"><Block className="h-11 w-full max-w-sm rounded-lg" /><Block className="h-11 w-24 rounded-lg bg-red-100" /></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Card key={i} className="p-0"><Block className="aspect-[16/10] rounded-b-none rounded-t-2xl bg-gray-300" /><div className="space-y-3 p-5"><Block className="h-3 w-24 bg-amber-100" /><Block className="h-5 w-40" /><Lines count={2} /></div></Card>)}</div></>;
    case "blog-post":
    case "legacy-content":
      return <article className="mx-auto max-w-3xl"><Block className="h-3 w-28 bg-amber-100" /><Block className="mb-4 mt-4 h-10 w-10/12 max-w-2xl" /><Block className="mb-8 h-3 w-48" /><Block className="mb-8 aspect-video rounded-2xl bg-gray-300" /><Lines count={10} /></article>;
    default:
      return <><PageHeading /><div className="grid gap-5 md:grid-cols-2"><Card /><Card /></div></>;
  }
}

function PortalContent({ page }: { page: RouteSkeletonPage }) {
  switch (page) {
    case "dashboard":
      return <><PageHeading title="w-56" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Block className="h-3 w-24" /><Block className="mt-4 h-8 w-16" /><Block className="mt-3 h-3 w-32" /></Card>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]"><Card className="min-h-72"><Block className="mb-6 h-5 w-40" /><Block className="h-48 w-full rounded-xl bg-red-50" /></Card><Card className="min-h-72"><Block className="mb-6 h-5 w-40" /><Rows count={3} /></Card></div></>;
    case "profile":
      return <><PageHeading title="w-48" /><div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><Card><Block className="mb-5 h-20 w-20 rounded-full bg-red-100" /><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Block key={i} className="h-12 rounded-lg" />)}</div><Block className="mt-5 h-11 w-32 rounded-lg bg-red-100" /></Card><div className="space-y-5"><Card><Block className="mb-5 h-5 w-40" /><div className="space-y-4"><Block className="h-11 w-full rounded-lg" /><Block className="h-11 w-full rounded-lg" /><Block className="h-11 w-32 rounded-lg bg-red-100" /></div></Card><Card className="h-36" /></div></div></>;
    case "directory":
      return <><PageHeading title="w-48" /><Card className="mb-5"><div className="grid gap-3 sm:grid-cols-4"><Block className="h-11 rounded-lg sm:col-span-2" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg bg-red-100" /></div></Card><Card className="p-4"><Rows count={7} /></Card></>;
    case "community":
      return <><PageHeading title="w-52" /><div className="mx-auto max-w-3xl space-y-5"><Card><Block className="mb-4 h-20 w-full rounded-xl" /><div className="flex justify-between"><Block className="h-9 w-24 rounded-lg" /><Block className="h-9 w-28 rounded-lg bg-red-100" /></div></Card>{Array.from({ length: 3 }, (_, i) => <Card key={i}><div className="mb-4 flex items-center gap-3"><Block className="h-10 w-10 rounded-full bg-red-100" /><div className="space-y-2"><Block className="h-4 w-32" /><Block className="h-3 w-24" /></div></div><Lines count={3} /><Block className="mt-5 h-48 w-full rounded-xl bg-gray-100" /></Card>)}</div></>;
    case "care":
      return <><PageHeading title="w-40" /><div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card className="h-64"><Block className="h-5 w-44" /><Lines count={4} /></Card><Card><Block className="mb-5 h-5 w-40" /><Rows count={4} /></Card></div></>;
    case "engagement":
      return <><PageHeading title="w-52" /><div className="mb-5 flex gap-2">{Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-10 w-28 rounded-full" />)}</div><div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><Card><div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Block key={i} className={cn("w-full rounded-lg", i === 3 ? "h-28" : "h-11")} />)}<Block className="h-11 w-36 rounded-lg bg-red-100" /></div></Card><Card><Block className="mb-5 h-5 w-40" /><Rows count={4} /></Card></div></>;
    case "attendance":
      return <><PageHeading title="w-56" /><Card className="mb-5"><div className="grid gap-3 sm:grid-cols-4"><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg bg-red-100" /></div></Card><Card><div className="mb-4 flex justify-between"><Block className="h-5 w-40" /><Block className="h-10 w-28 rounded-lg" /></div><div className="space-y-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex items-center gap-3 border-b border-gray-100 pb-3"><Block className="h-4 w-4" /><Block className="h-10 w-10 rounded-full bg-red-100" /><div className="flex-1 space-y-2"><Block className="h-4 w-40" /><Block className="h-3 w-24" /></div><Block className="h-10 w-24 rounded-lg bg-green-100" /><Block className="h-10 w-24 rounded-lg bg-red-100" /></div>)}</div></Card></>;
    case "attendance-entry":
      return <><PageHeading title="w-64" /><div className="grid items-start gap-5 xl:grid-cols-[1.3fr_0.7fr]"><div className="space-y-5"><Card><Block className="mb-4 h-5 w-40" /><Block className="h-12 w-full rounded-xl" /><div className="mt-4 space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-2 border-b border-gray-100 py-3"><Block className="h-4 w-40" /><Block className="h-3 w-56" /></div>)}</div></Card><Card><Block className="h-5 w-40" /><div className="mt-5 grid grid-cols-2 gap-3"><Block className="h-14 rounded-xl bg-green-100" /><Block className="h-14 rounded-xl" /></div></Card></div><Card><Block className="mb-4 h-5 w-44" /><div className="space-y-4">{Array.from({ length: 5 }, (_, i) => <Block key={i} className="h-12 w-full rounded-xl" />)}<Block className="h-12 w-full rounded-xl bg-red-100" /></div></Card></div></>;
    default:
      if (page.startsWith("admin-")) return <AdminContent page={page} />;
      return <><PageHeading /><Card><Rows /></Card></>;
  }
}

function AdminContent({ page }: { page: RouteSkeletonPage }) {
  const titleWidths: Partial<Record<RouteSkeletonPage, string>> = {
    "admin-dashboard": "w-56", "admin-cell-groups": "w-60", "admin-email-queue": "w-56",
    "admin-reports": "w-40", "admin-members": "w-48", "admin-attendees": "w-56",
    "admin-ministries": "w-48", "admin-events": "w-44", "admin-visit-plans": "w-56",
    "admin-posts": "w-52", "admin-prayers": "w-56", "admin-settings": "w-40",
  };
  const title = <PageHeading title={titleWidths[page] ?? "w-52"} />;

  switch (page) {
    case "admin-dashboard":
      return <>{title}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Block className="h-3 w-24" /><Block className="mt-4 h-8 w-16" /><Block className="mt-3 h-3 w-32" /></Card>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-2"><Card className="h-72"><Block className="mb-5 h-5 w-40" /><Block className="h-48 w-full bg-red-50" /></Card><Card className="h-72"><Block className="mb-5 h-5 w-40" /><Rows count={4} /></Card></div></>;
    case "admin-cell-groups":
    case "admin-ministries":
      return <>{title}<div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Card><Block className="mb-5 h-5 w-40" /><div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-11 w-full rounded-lg" />)}<Block className="h-11 w-32 rounded-lg bg-red-100" /></div></Card><Card><div className="mb-5 flex justify-between"><Block className="h-5 w-40" /><Block className="h-4 w-20" /></div><Rows count={5} /></Card></div></>;
    case "admin-attendees":
      return <>{title}<div className="grid items-start gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Card><Block className="mb-5 h-5 w-40" /><div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Block key={i} className="h-11 w-full rounded-lg" />)}<Block className="h-11 w-32 rounded-lg bg-red-100" /></div></Card><Card className="p-4"><div className="mb-4 flex justify-between"><Block className="h-5 w-32" /><Block className="h-3 w-16" /></div><Rows count={6} /></Card></div></>;
    case "admin-email-queue":
      return <>{title}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Card key={i}><Block className="h-3 w-20" /><Block className="mt-4 h-7 w-12" /></Card>)}</div><Card className="mt-5"><div className="grid gap-3 md:grid-cols-4"><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg bg-red-100" /></div><Rows count={5} className="mt-4" /></Card></>;
    case "admin-members":
      return <>{title}<div className="mb-5 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Block className="h-3 w-24" /><Block className="mt-4 h-7 w-16" /></Card>)}</div><Card className="mb-5"><div className="grid gap-3 md:grid-cols-[1.6fr_1fr_0.9fr_auto]"><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 w-24 rounded-lg bg-red-100" /></div></Card><Card className="p-4"><Rows count={7} /></Card></>;
    case "admin-events":
      return <>{title}<div className="mb-5 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Block className="h-3 w-24" /><Block className="mt-4 h-7 w-16" /></Card>)}</div><div className="grid gap-5 xl:grid-cols-[1fr_1fr]"><Card><Block className="mb-5 h-5 w-40" /><div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-11 w-full rounded-lg" />)}</div><Block className="mt-4 h-11 w-32 rounded-lg bg-red-100" /></Card><Card><div className="mb-4 flex justify-between"><Block className="h-5 w-32" /><Block className="h-9 w-24 rounded-lg" /></div><Rows count={5} /></Card></div></>;
    case "admin-visit-plans":
      return <>{title}<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Block className="h-3 w-24" /><Block className="mt-4 h-7 w-16" /></Card>)}</div><Card className="mb-5"><div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.9fr_auto]"><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 w-24 rounded-lg bg-red-100" /></div></Card><div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Block className="mb-4 h-5 w-36" /><Rows count={3} /></Card>)}</div></>;
    case "admin-posts":
      return <>{title}<div className="mb-5 flex gap-3"><Block className="h-10 w-36 rounded-lg" /><Block className="h-10 w-36 rounded-lg" /></div><div className="mx-auto max-w-4xl space-y-4">{Array.from({ length: 4 }, (_, i) => <Card key={i}><div className="mb-4 flex items-center gap-3"><Block className="h-10 w-10 rounded-full bg-red-100" /><div className="space-y-2"><Block className="h-4 w-36" /><Block className="h-3 w-24" /></div></div><Lines count={3} /><div className="mt-5 flex gap-2"><Block className="h-9 w-24 rounded-lg bg-green-100" /><Block className="h-9 w-24 rounded-lg bg-red-100" /></div></Card>)}</div></>;
    case "admin-prayers":
      return <>{title}<div className="mb-5 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Block className="h-3 w-24" /><Block className="mt-4 h-7 w-16" /></Card>)}</div><Card className="mb-5"><div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_auto]"><Block className="h-11 rounded-lg" /><Block className="h-11 rounded-lg" /><Block className="h-11 w-24 rounded-lg bg-red-100" /></div></Card><Card className="p-4"><Rows count={7} /></Card></>;
    case "admin-reports":
      return <>{title}<Card className="mb-5"><div className="flex flex-wrap gap-3">{Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-10 w-32 rounded-lg" />)}</div></Card><div className="grid gap-5 xl:grid-cols-2"><Card className="h-72"><Block className="mb-5 h-5 w-44" /><Block className="h-48 w-full bg-red-50" /></Card><Card className="h-72"><Block className="mb-5 h-5 w-44" /><Rows count={4} /></Card></div></>;
    case "admin-settings":
      return <>{title}<div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Block className="mb-5 h-5 w-40" /><div className="space-y-4"><Block className="h-11 w-full rounded-lg" /><Block className="h-11 w-full rounded-lg" /><Block className="h-10 w-28 rounded-lg bg-red-100" /></div></Card>)}</div></>;
    default:
      return <>{title}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Card key={i}><Block className="h-5 w-36" /><Lines count={3} /></Card>)}</div></>;
  }
}

function LinktreeSkeleton() {
  return <div className="flex min-h-dvh justify-center bg-gray-100 px-4 py-10"><div className="w-full max-w-md space-y-4"><Block className="mx-auto h-24 w-24 rounded-full bg-red-100" /><Block className="mx-auto h-6 w-44" /><Block className="mx-auto h-3 w-60 max-w-full" />{Array.from({ length: 6 }, (_, i) => <Block key={i} className="h-14 w-full rounded-xl bg-white" />)}</div></div>;
}

export function RouteLoadingSkeleton({
  isLoading = true,
  page,
  label = "Loading page",
}: RouteLoadingSkeletonProps) {
  if (!isLoading) return null;

  const isPortal = page === "dashboard" || page === "profile" || page === "directory" || page === "community" || page === "care" || page === "engagement" || page === "attendance" || page === "attendance-entry" || page.startsWith("admin-");
  const isAdmin = page.startsWith("admin-");
  let content: ReactNode;

  if (page === "linktree") content = <LinktreeSkeleton />;
  else if (page === "login" || page === "register" || page === "forgot-password" || page === "reset-password") content = <AuthPage page={page} />;
  else if (isPortal) content = <PortalShell admin={isAdmin}><PortalContent page={page} /></PortalShell>;
  else content = <PublicShell><PublicContent page={page} /></PublicShell>;

  return <div className="fixed inset-0 z-[9999] overflow-y-auto bg-white" role="status" aria-live="polite" aria-label={label}><span className="sr-only">{label}</span>{content}</div>;
}
