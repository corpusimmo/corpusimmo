"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * The whole row is the control, so the label is always clickable
 * without any id plumbing.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: ToggleProps) {
  const descriptionId = React.useId();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors duration-150",
        "hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-55",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span id={descriptionId} className="text-xs leading-relaxed text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5",
          "transition-colors duration-150 ease-out",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-surface shadow-sm transition-transform duration-150 ease-out",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  error?: string;
};

export function Checkbox({ label, error, className, id, ...props }: CheckboxProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* `-m-3 p-3` : la case ne dessine que 20×20 px, et rien au-dessus
          d'elle n'était cliquable. Le rembourrage étend la zone d'appui du
          label de 12 px sur les quatre côtés, la marge négative la reprend dans
          la mise en page : le dessin ne bouge pas, et le doigt qui vise haut
          coche quand même. On rembourre le LABEL plutôt que la case elle-même
          pour ne rien poser par-dessus l'input, qui garde ainsi son survol.
          Les cases du site sont séparées d'au moins 12 px, donc aucune zone
          n'en recouvre une autre. */}
      <label
        htmlFor={inputId}
        className="-m-3 flex cursor-pointer items-start gap-2.5 p-3 text-sm leading-relaxed text-ink"
      >
        <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
          <input
            {...props}
            id={inputId}
            type="checkbox"
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={error ? errorId : props["aria-describedby"]}
            className={cn(
              "peer size-5 cursor-pointer appearance-none rounded-xs border bg-surface shadow-xs",
              "transition-[background-color,border-color] duration-150 ease-out",
              "hover:border-border-strong",
              "checked:border-primary checked:bg-primary",
              "disabled:cursor-not-allowed disabled:opacity-55",
              error ? "border-danger" : "border-border-strong",
            )}
          />
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute size-3.5 text-primary-fg opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
          />
        </span>
        <span className="min-w-0">{label}</span>
      </label>

      {error ? (
        <p id={errorId} role="alert" className="pl-7.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
