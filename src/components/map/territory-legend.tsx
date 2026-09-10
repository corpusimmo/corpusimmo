"use client";

import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

import type { TerritoryScale } from "./territories";

/**
 * LA LÉGENDE DES APLATS NATIONAUX — celle qui manquait.
 *
 * Avant le zoom 13, la carte ne montre pas des ventes mais des régions puis
 * des départements, peints du plus abordable au plus cher. C'est la PREMIÈRE
 * chose que voit un visiteur, et rien ne disait ce que le bleu voulait dire :
 * il fallait deviner qu'un aplat sombre était cher, et un territoire blanc
 * restait sans explication.
 *
 * ELLE EST HORIZONTALE, ET C'EST DÉLIBÉRÉ. Les autres légendes du produit
 * énumèrent des catégories, donc une par ligne. Celle-ci porte une rampe
 * continue : une barre lue de gauche à droite dit l'ordre mieux que cinq
 * lignes, et tient dans le bandeau de commandes sans ouvrir de panneau.
 *
 * LE VIDE EST NOMMÉ. Un territoire sous le seuil d'effectif n'est pas
 * « pas cher », il est tu : le secret statistique interdit d'en publier la
 * médiane. La pastille rayée le dit, parce qu'une absence de couleur passe
 * autrement pour une absence de marché.
 */
export function TerritoryLegend({
  scale,
  className,
}: {
  scale: TerritoryScale | null;
  className?: string;
}) {
  if (!scale) return null;

  const first = scale.breaks[0];
  const last = scale.breaks[scale.breaks.length - 1];
  if (first === undefined || last === undefined) return null;

  return (
    <div
      className={cn("flex shrink-0 items-center gap-2.5", className)}
      role="img"
      aria-label={`Légende : prix médian au m² par territoire, de moins de ${formatNumber(first)} à plus de ${formatNumber(last)} euros`}
    >
      <span className="shrink-0 text-[11px] font-medium text-ink">
        Prix médian
      </span>

      <span aria-hidden="true" className="flex flex-col gap-0.5">
        <span className="flex overflow-hidden rounded-sm">
          {scale.colors.map((color) => (
            <span
              key={color}
              className="h-2 w-7"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <span className="flex justify-between text-[10px] text-ink-subtle tnum">
          <span>{formatNumber(first)}</span>
          <span>{formatNumber(last)} €/m²</span>
        </span>
      </span>

      {/* Le seuil d'effectif, dit sur la carte plutôt que dans une note de bas
          de page : c'est là qu'on voit le trou. */}
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-ink-subtle">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-sm border border-border-strong/60 bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--border-strong)_3px_4px)]"
        />
        trop peu de ventes
      </span>
    </div>
  );
}
