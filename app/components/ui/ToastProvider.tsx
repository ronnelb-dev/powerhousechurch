import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "~/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  message: string;
  tone?: ToastTone;
  title?: string;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ durationMs = 3600, tone = "info", ...toast }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, durationMs, tone, ...toast }]);

      window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const toneClasses: Record<ToastTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-[var(--border)] bg-white text-[var(--foreground)]",
  };

  const accentClasses: Record<ToastTone, string> = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-[var(--primary)]",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto overflow-hidden rounded-2xl border shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm",
        toneClasses[toast.tone ?? "info"],
      )}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn("mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full", accentClasses[toast.tone ?? "info"])}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {toast.title ? (
            <p className="text-sm font-semibold">{toast.title}</p>
          ) : null}
          <p className="text-sm leading-6">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-current/60 transition-colors hover:bg-black/5 hover:text-current"
          aria-label="Dismiss notification"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}

export function useToastEffect(
  toast: ToastInput | null | undefined,
  deps: readonly unknown[],
) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!toast) {
      return;
    }

    showToast(toast);
  }, [showToast, toast, ...deps]);
}
