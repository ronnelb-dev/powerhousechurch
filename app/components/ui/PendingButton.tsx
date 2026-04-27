import { cn } from "~/lib/utils";

interface PendingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isPending?: boolean;
  pendingText?: string;
  spinnerClassName?: string;
}

export function PendingButton({
  children,
  className,
  disabled,
  isPending = false,
  pendingText,
  spinnerClassName,
  ...props
}: PendingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isPending}
      aria-busy={isPending}
      className={cn(className, "inline-flex items-center justify-center gap-2")}
    >
      {isPending ? (
        <>
          <span
            className={cn(
              "h-4 w-4 animate-spin rounded-full border-2 border-current/35 border-t-current",
              spinnerClassName,
            )}
            aria-hidden="true"
          />
          <span>{pendingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
