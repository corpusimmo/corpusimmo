"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDialog } from "./use-dialog";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** `right` becomes a bottom sheet under 768px — the mobile observatory lives on it. */
  side?: "right" | "bottom";
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const RIGHT_SIZES: Record<NonNullable<DrawerProps["size"]>, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-xl",
};

const BOTTOM_SIZES: Record<NonNullable<DrawerProps["size"]>, string> = {
  sm: "max-h-[45dvh]",
  md: "max-h-[68dvh]",
  lg: "max-h-[90dvh]",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  side = "right",
  size = "md",
  footer,
  children,
  className,
}: DrawerProps) {
  const { panelRef, mounted } = useDialog(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  if (!mounted || !open) return null;

  const isRight = side === "right";

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Panneau"}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col overflow-hidden border border-border bg-surface shadow-lg",
          // Mobile: bottom sheet in both cases.
          "animate-slide-up inset-x-0 bottom-0 rounded-t-xl",
          BOTTOM_SIZES[size],
          isRight &&
            // ≥768px: side sheet anchored right, full height.
            "md:animate-slide-right md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-full md:rounded-none md:rounded-l-xl " +
              RIGHT_SIZES[size],
          className,
        )}
      >
        {/* Grab handle: tells the thumb this sheet is a sheet. */}
        <div
          aria-hidden="true"
          className={cn("flex justify-center pt-2.5 pb-1", isRight && "md:hidden")}
        >
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>

        {title || description ? (
          <header
            className={cn(
              "flex items-start gap-4 border-b border-border-soft px-5 pb-4",
              isRight ? "pt-2 md:pt-5" : "pt-2",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {title ? (
                <h2 id={titleId} className="text-base font-semibold text-ink">
                  {title}
                </h2>
              ) : null}
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
        ) : null}

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm text-ink">
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border-soft bg-surface-2 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
