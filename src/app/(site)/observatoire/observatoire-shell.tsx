"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Map as MapIcon, Table2 } from "lucide-react";

import { ComparablesCart } from "@/components/observatoire/comparables-cart";
import { ComparablesProvider, useComparables } from "@/components/observatoire/comparables-store";
import { cn } from "@/lib/utils/cn";

/**
 * Le chrome de l'observatoire.
 *
 * `data-density="compact"` : ces trois écrans sont denses — tableaux, filtres,
 * carte, statistiques — et resserrent donc leur géométrie. Ce n'est PAS un
 * second thème ni un second univers : aucune couleur ne change, aucun composant
 * n'est dupliqué, et l'ensemble vit sous le même en-tête et le même pied de
 * page que le reste du site.
 */
export function ObservatoireShell({ children }: { children: ReactNode }) {
  return (
    <div data-density="compact" className="min-h-full bg-canvas pb-28 text-ink lg:pb-24">
      {/*
       * Le panier vit ICI, au-dessus des trois écrans : c'est ce qui lui permet
       * de survivre à la navigation entre la carte, la recherche tabulaire et
       * la sélection.
       */}
      <ComparablesProvider>
        <ObservatoireTabs />
        {children}
        <ComparablesCart />
      </ComparablesProvider>
    </div>
  );
}

interface ObservatoireTab {
  href: string;
  label: string;
  icon: typeof MapIcon;
  /** Affiche le compteur du panier. */
  counter?: boolean;
}

const TABS: ObservatoireTab[] = [
  { href: "/observatoire", label: "Carte et indicateurs", icon: MapIcon },
  { href: "/observatoire/transactions", label: "Rechercher une transaction", icon: Table2 },
  { href: "/observatoire/comparables", label: "Mes comparables", icon: Layers, counter: true },
];

/**
 * La barre locale des trois écrans.
 *
 * Le menu du site les liste déjà, mais un outil dense a besoin de son propre
 * repère : on passe de la carte au tableau des dizaines de fois par session, et
 * remonter dans l'en-tête à chaque fois est une friction inutile.
 */
function ObservatoireTabs() {
  const pathname = usePathname() ?? "";
  const { count, hydrated } = useComparables();

  return (
    <nav aria-label="Écrans de l'observatoire" className="border-b border-border bg-surface">
      {/* Le défilement est INTERNE : à 375 px la barre glisse, la page non. */}
      <ul className="scroll-slim mx-auto flex w-full max-w-[1560px] gap-1 overflow-x-auto px-4 md:px-6 lg:px-8">
        {TABS.map(({ href, label, icon: Icon, counter }) => {
          const active = pathname === href;

          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm transition-colors",
                  active
                    ? "border-accent font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", active ? "text-accent" : "text-ink-subtle")}
                  aria-hidden
                />
                <span className="whitespace-nowrap">{label}</span>
                {counter && hydrated && count > 0 && (
                  <span className="tnum rounded-xs bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent-soft-fg">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
