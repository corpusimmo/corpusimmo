"use client";

import { cn } from "@/lib/utils/cn";

import { ZONING_CATEGORIES } from "./zoning";

/**
 * La légende du calque d'affectation du sol.
 *
 * Deux choses qu'elle doit dire, et que la carte seule ne dit pas :
 *
 *   · la SOURCE. « Usage observé, OpenStreetMap » — pas la règle d'urbanisme,
 *     pas l'usage déclaré au fisc. Le jour où le PLU s'ajoutera à côté, ces
 *     trois lectures devront rester distinctes dans la tête du lecteur, et ça
 *     commence par les nommer.
 *   · le BLANC. Une commune sans contributeur reste vide ; le vide n'est pas
 *     une affectation. Une teinte « non renseigné » ferait passer une absence
 *     de donnée pour une donnée — c'est exactement ce que ce produit refuse
 *     de faire ailleurs, et il n'y a pas de raison de commencer ici.
 */
export function ZoningLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-auto max-w-[15rem] rounded-md border border-border bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-ink">Affectation du sol</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {ZONING_CATEGORIES.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 text-[11px] text-ink-muted"
          >
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm border border-border-strong/40"
              style={{ backgroundColor: category.color }}
            />
            {category.label}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] leading-snug text-ink-subtle">
        Usage observé, relevé par les contributeurs OpenStreetMap. Une zone
        blanche n’est pas une zone sans affectation : personne n’y a encore
        contribué.
      </p>
    </div>
  );
}
