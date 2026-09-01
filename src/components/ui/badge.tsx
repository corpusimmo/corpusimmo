import type { ReactNode } from "react";
import { MODULE_STATUS_LABELS, type ModuleStatus } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-2 text-ink-muted",
  primary: "border-transparent bg-primary-soft text-primary-soft-fg",
  accent: "border-transparent bg-accent-soft text-accent-soft-fg",
  success: "border-transparent bg-success-soft text-success-soft-fg",
  warning: "border-transparent bg-warning-soft text-warning-soft-fg",
  danger: "border-transparent bg-danger-soft text-danger-soft-fg",
  info: "border-transparent bg-info-soft text-info-soft-fg",
};

const SIZES: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "h-5 gap-1 px-2 text-[0.6875rem]",
  md: "h-6 gap-1.5 px-2.5 text-xs",
};

export function Badge({ tone = "neutral", size = "md", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-medium whitespace-nowrap",
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<ModuleStatus, BadgeTone> = {
  live: "success",
  beta: "info",
  preview: "neutral",
};

/**
 * The honesty badge: every module says out loud whether it is real,
 * partial, or still a credible interface over nothing.
 */
export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: ModuleStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONES[status]} size={size} className={className}>
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          status === "live" && "bg-success",
          status === "beta" && "bg-info",
          status === "preview" && "bg-ink-subtle",
        )}
      />
      {MODULE_STATUS_LABELS[status]}
    </Badge>
  );
}
