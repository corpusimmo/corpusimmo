"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: string;
  badge?: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Accessible name of the tablist. */
  label?: string;
}

/**
 * Roving tabindex + automatic activation (arrows move and select).
 * Convention for panels: `id="panel-<tabId>"` and `aria-labelledby="tab-<tabId>"`.
 */
export function Tabs({ items, value, onChange, className, label }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = items.findIndex((item) => item.id === value);
    if (currentIndex < 0 || items.length === 0) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % items.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    const next = items[nextIndex];
    if (!next) return;

    event.preventDefault();
    onChange(next.id);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        "scroll-slim relative flex items-center gap-1 overflow-x-auto border-b border-border",
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium",
              "transition-colors duration-150 ease-out",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors after:duration-150",
              selected
                ? "text-ink after:bg-primary"
                : "text-ink-muted after:bg-transparent hover:text-ink",
            )}
          >
            {item.label}
            {item.badge ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums",
                  selected
                    ? "bg-primary-soft text-primary-soft-fg"
                    : "bg-surface-2 text-ink-muted",
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
