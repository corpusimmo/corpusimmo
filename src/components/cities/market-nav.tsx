import Link from "next/link";
import { Coins, Percent, Tag } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * LES TROIS MARCHÉS D'UNE COMMUNE, EN TÊTE DE PAGE.
 *
 * Une page « prix immobilier » sert trois lectures qui n'ont pas la même
 * question : ce qu'un bien se VEND, ce qu'il se LOUE, ce qu'il RAPPORTE. Elles
 * vivaient dans le même long défilement, dans cet ordre, sans que rien ne
 * dise à celui qui cherche un rendement qu'il en existait un plus bas.
 *
 * ── DES ANCRES, PAS DES ONGLETS ────────────────────────────────────────────
 * Ce sélecteur ne masque rien. Trois raisons, et la première suffirait :
 *
 *   1. LE RÉFÉRENCEMENT. Du contenu masqué derrière un état React est du
 *      contenu que le moteur voit moins bien, et ces pages n'existent que
 *      pour être trouvées.
 *   2. LE JAVASCRIPT. La page entière est rendue sur le serveur, sans une
 *      ligne de script. Des onglets à état la feraient basculer côté client
 *      pour masquer ce qu'elle sait déjà afficher.
 *   3. LA LECTURE. Un rendement se juge avec le prix et le loyer sous les
 *      yeux, pas dans un onglet qui les cache.
 *
 * Le chiffre sous chaque libellé fait le reste du travail : il donne la
 * réponse courte avant même le clic, et il dit ce que la section contient.
 */

export interface MarketEntry {
  id: "vente" | "location" | "investissement";
  label: string;
  /** La réponse courte, celle qu'on lit sans descendre. */
  valeur: string;
  /** Ce que le chiffre mesure, en trois mots. */
  precision: string;
}

const ICONES = {
  vente: Tag,
  location: Coins,
  investissement: Percent,
} as const;

export function MarketNav({ entries }: { entries: MarketEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Les trois marchés de la commune"
      /* COLLANT EN HAUT, sous l'en-tête du site : sur une page de deux mille
         mots, un sélecteur qui disparaît au premier défilement ne sert qu'au
         premier écran. `top-16` est la hauteur de l'en-tête collant. */
      className="sticky top-16 z-30 -mx-4 border-y border-border bg-surface/95 px-4 py-2 backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border sm:px-2"
    >
      <ul className="flex gap-1 overflow-x-auto">
        {entries.map((entry) => {
          const Icone = ICONES[entry.id];
          return (
            <li key={entry.id} className="min-w-0 flex-1">
              <Link
                href={`#${entry.id}`}
                className={cn(
                  "flex min-w-0 flex-col gap-0.5 rounded-md px-3 py-2 transition-colors",
                  "hover:bg-surface-2 focus-visible:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <Icone aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{entry.label}</span>
                </span>
                <span className="truncate font-display text-lg font-semibold text-ink tnum">
                  {entry.valeur}
                </span>
                <span className="truncate text-[0.6875rem] text-ink-subtle">
                  {entry.precision}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
