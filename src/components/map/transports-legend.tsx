"use client";

import { cn } from "@/lib/utils/cn";

import {
  AMENITY_CATEGORIES,
  TRANSPORT_LINES,
  TRANSPORT_STOPS,
} from "./transports";

/**
 * La légende du calque de transports et commodités.
 *
 * Trois choses qu'elle doit dire, et que la carte seule ne dit pas :
 *
 *   · la SOURCE. Ce sont des équipements relevés à la main par les
 *     contributeurs OpenStreetMap, pas un référentiel d'opérateur ni une base
 *     officielle d'équipements. Aucun horaire, aucune fréquence, aucune notion
 *     de desserte : un point dit « il y a un arrêt ici », rien de plus.
 *   · le VIDE. Un quartier sans point n'est pas un quartier sans commerce ni
 *     sans école ; c'est un quartier que personne n'a encore cartographié. La
 *     dire ici est la même exigence que sur le zonage : une absence de donnée
 *     ne doit jamais se lire comme une donnée.
 *   · le DOUBLON. Le champ qui devrait désigner un arrêt représentatif par
 *     grappe de quais est vide dans les tuiles servies, donc un même arrêt
 *     apparaît autant de fois qu'il a de quais. Compter les points ne compte
 *     pas les arrêts.
 *
 * Les trois blocs suivent l'ordre de lecture attendu : d'abord le réseau qui
 * structure, puis les points d'accès, puis le quotidien.
 */
export function TransportsLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-auto max-w-[15rem] rounded-md border border-border bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-ink">
        Transports et commodités
      </p>

      <ul className="mt-1.5 flex flex-col gap-1">
        {TRANSPORT_LINES.map((line) => (
          <li
            key={line.id}
            className="flex items-center gap-2 text-[11px] text-ink-muted"
          >
            <span
              aria-hidden="true"
              className="h-0 w-3 shrink-0 border-t-2"
              style={{
                borderColor: line.color,
                borderTopStyle: line.dashed ? "dashed" : "solid",
              }}
            />
            {line.label}
          </li>
        ))}

        {TRANSPORT_STOPS.map((group) => (
          <li
            key={group.id}
            className="flex items-center gap-2 text-[11px] text-ink-muted"
          >
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-border-strong/40"
              style={{ backgroundColor: group.color }}
            />
            {group.label}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10px] font-medium text-ink-muted">
        Commodités (à partir du quartier)
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {AMENITY_CATEGORIES.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 text-[11px] text-ink-muted"
          >
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-border-strong/40"
              style={{ backgroundColor: category.color }}
            />
            {category.label}
          </li>
        ))}
      </ul>

      <p className="mt-1.5 text-[10px] leading-snug text-ink-subtle">
        Équipements relevés par les contributeurs OpenStreetMap, sans horaires
        ni fréquence de desserte. Un secteur sans point n’est pas un secteur
        sans équipement : personne n’y a encore contribué. Un même arrêt peut
        compter plusieurs points, un par quai.
      </p>
    </div>
  );
}
