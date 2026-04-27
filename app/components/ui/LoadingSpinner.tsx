import { cn } from "~/lib/utils";

interface LoadingSpinnerProps {
  isLoading?: boolean;
  fullScreen?: boolean;
  label?: string;
  className?: string;
  spinnerClassName?: string;
}

export function LoadingSpinner({
  isLoading = true,
  fullScreen = true,
  label = "Loading",
  className,
  spinnerClassName,
}: LoadingSpinnerProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen &&
          "fixed inset-0 z-[9999] bg-black/40 pointer-events-auto",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className={cn(
          "h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin",
          spinnerClassName,
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
