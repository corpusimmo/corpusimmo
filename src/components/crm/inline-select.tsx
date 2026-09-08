"use client";

import { useTransition } from "react";

import { Select } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/**
 * Un sélecteur qui enregistre au changement, sans bouton. Pour l'étape d'un
 * contact, la colonne d'une opportunité, le responsable d'une fiche.
 */
export function InlineSelect({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => Promise<void>;
  label: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label={label}
      value={value}
      disabled={pending}
      className={cn("h-9 text-xs", className)}
      onChange={(event) => {
        const next = event.target.value;
        start(async () => {
          await onChange(next);
        });
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
