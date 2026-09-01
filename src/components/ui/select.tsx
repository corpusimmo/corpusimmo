import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

/**
 * Native `<select>` — no popover to reinvent, no mobile regression.
 * Only the chrome is ours.
 */
export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <span className="relative block w-full">
      <select
        {...props}
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          "h-11 w-full appearance-none rounded-md border border-border bg-surface pr-10 pl-3.5",
          "text-sm text-ink shadow-xs",
          "transition-[border-color,background-color,box-shadow] duration-150 ease-out",
          "hover:border-border-strong",
          "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted disabled:shadow-none",
          invalid && "border-danger hover:border-danger",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-subtle"
      />
    </span>
  );
}
