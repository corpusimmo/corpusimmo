"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import type { DvfTransaction } from "@/types/dvf";
import { useComparables } from "./comparables-store";

/**
 * The single affordance that turns a DVF row into a comparable.
 *
 * Same component on the map list, in the transactions table and in the
 * comparables screen — so the "+ Ajouter" → "✓ Comparable" state can never
 * drift between screens.
 */
export function ComparableToggle({
  transaction,
  size = "sm",
  fullWidth,
  className,
}: {
  transaction: DvfTransaction;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}) {
  const { has, toggle, isFull } = useComparables();
  const selected = has(transaction.id);
  const blocked = !selected && isFull;

  return (
    <Button
      variant={selected ? "accent" : "outline"}
      size={size}
      fullWidth={fullWidth}
      className={className}
      disabled={blocked}
      aria-pressed={selected}
      title={
        blocked
          ? "Le panier de comparables est plein. Retirez une ligne pour en ajouter une autre."
          : undefined
      }
      onClick={() => toggle(transaction)}
    >
      {selected ? (
        <>
          <Check className="size-4" aria-hidden />
          Comparable
        </>
      ) : (
        <>
          <Plus className="size-4" aria-hidden />
          Ajouter aux comparables
        </>
      )}
    </Button>
  );
}

/** Icon-only variant for dense table rows. */
export function ComparableToggleIcon({ transaction }: { transaction: DvfTransaction }) {
  const { has, toggle, isFull } = useComparables();
  const selected = has(transaction.id);
  const blocked = !selected && isFull;
  const label = selected
    ? "Retirer des comparables"
    : "Ajouter aux comparables";

  return (
    <Button
      variant={selected ? "accent" : "ghost"}
      size="icon"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      disabled={blocked}
      onClick={() => toggle(transaction)}
    >
      {selected ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
    </Button>
  );
}
