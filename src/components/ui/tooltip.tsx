"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface TooltipProps {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}

const SIDES: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export function Tooltip({ content, side = "top", children, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);

  // Touch devices get no tooltip at all: a bubble you cannot dismiss is a trap.
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHoverCapable(query.matches);
    const onChange = (event: MediaQueryListEvent) => setHoverCapable(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const visible = open && hoverCapable;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      aria-describedby={visible ? id : undefined}
    >
      {children}

      {visible ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "animate-fade-in pointer-events-none absolute z-50 w-max max-w-60",
            "rounded-sm bg-surface-inverted px-2.5 py-1.5",
            "text-xs leading-snug font-medium text-ink-inverted shadow-md",
            SIDES[side],
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
