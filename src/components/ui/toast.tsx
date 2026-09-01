"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ToastTone = "neutral" | "success" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends Required<Pick<ToastInput, "title" | "tone">> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

const TONE_STYLES: Record<ToastTone, { accent: string; icon: ReactNode }> = {
  neutral: { accent: "bg-primary", icon: <Info className="size-4.5 text-primary" /> },
  success: {
    accent: "bg-success",
    icon: <CheckCircle2 className="size-4.5 text-success" />,
  },
  danger: {
    accent: "bg-danger",
    icon: <AlertCircle className="size-4.5 text-danger" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "neutral",
      };
      setItems((previous) => [...previous, item].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Bottom-centre on mobile, bottom-right from `sm`. */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:p-0"
      >
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              className="animate-fade-up pointer-events-auto relative flex w-full max-w-sm gap-3 overflow-hidden rounded-lg border border-border bg-surface p-3.5 pl-4 shadow-lg sm:w-80"
            >
              <span
                aria-hidden="true"
                className={cn("absolute inset-y-0 left-0 w-1", tone.accent)}
              />
              <span aria-hidden="true" className="mt-px shrink-0">
                {tone.icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                {item.description ? (
                  <p className="text-xs leading-relaxed text-ink-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Fermer la notification"
                className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-sm text-ink-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider> (mounted in the root layout).");
  }
  return context;
}
