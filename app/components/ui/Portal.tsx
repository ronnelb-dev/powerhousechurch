import { cn } from "~/lib/utils";

export function PortalPage({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("max-w-6xl p-4 sm:p-5 md:p-6", className)}
      {...props}
    />
  );
}

export function PortalHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm font-sans leading-6 text-gray-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function PortalSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("rounded-lg border border-gray-200 bg-white p-5", className)}
      {...props}
    />
  );
}

export function PortalPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-gray-200 bg-gray-50 p-4", className)}
      {...props}
    />
  );
}

export function PortalSectionHeading({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 font-sans text-lg font-bold text-gray-900">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm font-sans leading-6 text-gray-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function portalButtonClasses({
  variant = "primary",
  className,
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
} = {}) {
  const variants = {
    primary: "bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-400",
    secondary:
      "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-950 focus:ring-gray-300",
    danger:
      "border border-red-200 bg-white text-red-700 hover:bg-red-50 focus:ring-red-300",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-950 focus:ring-gray-300",
  };

  return cn(
    "inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-sans font-bold transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    className,
  );
}
