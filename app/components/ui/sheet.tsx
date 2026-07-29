import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

import { cn } from "~/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const root = rootRef.current;
    const returnFocusElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "header, main, footer, body > a[href='#main-content']",
      ),
    );
    const backgroundState = backgroundElements.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab" || !root) {
        return;
      }

      const focusableElements = Array.from(
        root.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hidden && element.offsetParent !== null);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => {
      const initialFocusElement =
        root?.querySelector<HTMLElement>("[data-sheet-autofocus]") ??
        root?.querySelector<HTMLElement>(focusableSelector);
      initialFocusElement?.focus();
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      backgroundState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
      });
      window.removeEventListener("keydown", onKeyDown);
      returnFocusElement?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[60]" data-sheet-root>
      <button
        type="button"
        className="absolute inset-0 bg-[#2c1814]/55 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
        aria-hidden="true"
      />
      {children}
    </div>,
    document.body,
  );
}

export function SheetContent({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "absolute right-0 top-0 h-full w-full max-w-[min(24rem,100vw)] overflow-y-auto border-l border-white/10 bg-[var(--card)]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-7",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>
  );
}

export function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "font-serif text-xl font-semibold text-[var(--foreground)] sm:text-2xl",
        className,
      )}
      {...props}
    />
  );
}
