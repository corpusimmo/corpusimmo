import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps {
  className?: string;
  /** Adds hover elevation — only for cards that are actually clickable. */
  interactive?: boolean;
  children: ReactNode;
}

export function Card({ className, interactive = false, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-sm",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 ease-out " +
            "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md " +
            "focus-within:border-primary/50 focus-within:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SlotProps {
  className?: string;
  children: ReactNode;
}

export function CardHeader({ className, children }: SlotProps) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-0", className)}>{children}</div>;
}

export function CardTitle({
  className,
  children,
  as: Tag = "h3",
}: SlotProps & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Tag className={cn("text-base font-semibold text-ink", className)}>{children}</Tag>
  );
}

export function CardDescription({ className, children }: SlotProps) {
  return <p className={cn("text-sm text-ink-muted", className)}>{children}</p>;
}

export function CardContent({ className, children }: SlotProps) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: SlotProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-border-soft p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
