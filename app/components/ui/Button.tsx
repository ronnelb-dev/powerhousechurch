// app/components/ui/Button.tsx
// Single Button component used everywhere.
// All variants meet 44px minimum touch target.
// Loading state with accessible spinner.
// Never use ad-hoc button className strings in routes — always import this.

import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger" | "gold";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  isLoading?: boolean;
  leftIcon?:  React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-red-700 text-white border-transparent " +
    "hover:bg-red-800 active:bg-red-900 " +
    "focus:ring-red-400",

  ghost:
    "bg-white/10 text-white border-white/30 " +
    "hover:bg-white/20 active:bg-white/30 " +
    "focus:ring-white/40",

  outline:
    "bg-transparent text-red-700 border-red-300 " +
    "hover:bg-red-50 hover:border-red-400 active:bg-red-100 " +
    "focus:ring-red-300",

  danger:
    "bg-transparent text-red-700 border-red-200 " +
    "hover:bg-red-50 active:bg-red-100 " +
    "focus:ring-red-400",

  gold:
    "bg-yellow-400 text-red-900 border-transparent " +
    "hover:bg-yellow-300 active:bg-yellow-500 " +
    "focus:ring-yellow-300",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm min-h-[44px]",
  md: "px-5 py-3 text-base min-h-[48px]",
  lg: "px-7 py-4 text-base sm:text-lg min-h-[52px]",
};

export function Button({
  variant   = "primary",
  size      = "md",
  isLoading = false,
  leftIcon,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading}
      className={[
        "inline-flex items-center justify-center gap-2",
        "border rounded-xl font-sans font-bold tracking-wide",
        "transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "touch-manipulation", // Removes 300ms tap delay
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Loading…</span>
        </>
      ) : (
        <>
          {leftIcon && (
            <span className="shrink-0" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          {children}
        </>
      )}
    </button>
  );
}