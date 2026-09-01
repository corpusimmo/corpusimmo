import type { ReactNode } from "react";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const CONTROL_BASE =
  "w-full rounded-md border border-border bg-surface text-sm text-ink shadow-xs " +
  "placeholder:text-ink-subtle " +
  "transition-[border-color,background-color,box-shadow] duration-150 ease-out " +
  "hover:border-border-strong " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted disabled:shadow-none " +
  "read-only:bg-surface-2";

const CONTROL_INVALID = "border-danger hover:border-danger";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={cn(CONTROL_BASE, "h-11 px-3.5", invalid && CONTROL_INVALID, className)}
    />
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      aria-invalid={invalid || props["aria-invalid"]}
      className={cn(
        CONTROL_BASE,
        "min-h-24 resize-y px-3.5 py-2.5 leading-relaxed",
        invalid && CONTROL_INVALID,
        className,
      )}
    />
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label + hint + error around any control.
 * Hint and error get predictable ids (`{htmlFor}-hint` / `{htmlFor}-error`)
 * so the control can point at them with `aria-describedby`.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
            <span className="sr-only"> (obligatoire)</span>
          </>
        ) : null}
      </label>

      {hint ? (
        <p
          id={htmlFor ? `${htmlFor}-hint` : undefined}
          className="text-xs leading-relaxed text-ink-muted"
        >
          {hint}
        </p>
      ) : null}

      {children}

      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
