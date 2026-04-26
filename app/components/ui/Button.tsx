import { forwardRef } from "react";

import { cn } from "~/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_18px_45px_-24px_rgba(146,48,52,0.7)] hover:bg-[color-mix(in_oklab,var(--primary)_88%,black)]",
  secondary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[color-mix(in_oklab,var(--accent)_88%,black)]",
  outline:
    "border border-[var(--border)] bg-white/70 text-[var(--foreground)] hover:border-[var(--ring)] hover:bg-[var(--muted)]",
  ghost:
    "text-[var(--foreground)] hover:bg-white/70",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-5 py-2.5",
  sm: "h-10 rounded-md px-4",
  lg: "h-12 rounded-xl px-6 text-base",
  icon: "h-11 w-11",
};

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[0.08em] uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      className={buttonVariants({ variant, size, className })}
      ref={ref}
      {...props}
    />
  ),
);

Button.displayName = "Button";
