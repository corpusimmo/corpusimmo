"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDialog } from "./use-dialog";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const SIZES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
}: ModalProps) {
  const { panelRef, mounted } = useDialog(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "animate-zoom-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden",
          "rounded-t-xl border border-border bg-surface shadow-lg sm:rounded-xl",
          SIZES[size],
          className,
        )}
      >
        <header className="flex items-start gap-4 border-b border-border-soft px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm text-ink sm:px-6">
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border-soft bg-surface-2 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
