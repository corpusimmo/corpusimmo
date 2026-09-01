"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ChoiceCardProps {
  selected?: boolean;
  icon?: ReactNode;
  title: string;
  description?: string;
  onSelect: () => void;
  className?: string;
}

/** Big tappable card of the estimator wizard — target ≥ 44px by construction. */
export function ChoiceCard({
  selected = false,
  icon,
  title,
  description,
  onSelect,
  className,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-lg border p-4 text-left",
        "transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out",
        "active:translate-y-px",
        selected
          ? "border-primary bg-primary-soft shadow-sm"
          : "border-border bg-surface shadow-xs hover:border-border-strong hover:bg-surface-2 hover:shadow-sm",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md transition-colors duration-150 [&_svg]:size-5",
            selected
              ? "bg-primary text-primary-fg"
              : "bg-surface-2 text-ink-muted group-hover:text-ink",
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-sm font-semibold",
            selected ? "text-primary-soft-fg" : "text-ink",
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="text-xs leading-relaxed text-ink-muted">{description}</span>
        ) : null}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-150",
          selected
            ? "border-primary bg-primary text-primary-fg"
            : "border-border-strong bg-surface text-transparent",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    </button>
  );
}

export interface ChoiceGroupProps {
  label?: string;
  columns?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function ChoiceGroup({
  label,
  columns = 2,
  children,
  className,
}: ChoiceGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-3", className)}
    >
      {label ? <p className="text-sm font-medium text-ink">{label}</p> : null}
      <div className={cn("grid gap-3", COLUMNS[columns])}>{children}</div>
    </div>
  );
}
