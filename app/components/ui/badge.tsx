import { cn } from "~/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]",
  secondary:
    "border-transparent bg-[var(--muted)] text-[var(--muted-foreground)]",
  outline: "border-[var(--border)] text-[var(--foreground)]",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em]",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
