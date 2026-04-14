import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-red-700 text-white border-transparent hover:bg-red-800 focus:ring-red-400",
  ghost:   "bg-white/10 text-white border-white/30 hover:bg-white/20 focus:ring-white/40",
  outline: "bg-transparent text-red-700 border-red-300 hover:bg-red-50 focus:ring-red-300",
  danger:  "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 focus:ring-red-400",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={[
        "inline-flex items-center justify-center gap-2",
        "border rounded-lg font-sans font-bold tracking-wide",
        "transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
    >
      {isLoading && (
        <svg
          className="animate-spin w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      )}
      {!isLoading && leftIcon && (
        <span aria-hidden="true">{leftIcon}</span>
      )}
      {children}
    </button>
  );
}