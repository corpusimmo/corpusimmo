import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";
import { Spinner } from "./spinner";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full bg-surface text-ink-subtle shadow-xs [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Une erreur est survenue",
  description = "Impossible de charger ces données pour le moment. Réessayez dans un instant.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-6 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-surface text-danger shadow-xs"
      >
        <AlertTriangle className="size-5" />
      </span>
      <p className="text-sm font-semibold text-danger-soft-fg">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-danger-soft-fg/85">
        {description}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          <RotateCw className="size-4" aria-hidden="true" />
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Chargement…", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}
