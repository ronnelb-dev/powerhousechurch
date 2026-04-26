import { useEffect } from "react";

import { cn } from "~/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-[#2c1814]/55 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-label="Close menu overlay"
      />
      {children}
    </div>
  );
}

export function SheetContent({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "absolute right-0 top-0 h-full w-full max-w-sm border-l border-white/10 bg-[var(--card)]/95 p-6 shadow-2xl backdrop-blur-xl",
        className,
      )}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}
