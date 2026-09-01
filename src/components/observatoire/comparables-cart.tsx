"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layers, Scale, Trash2, X } from "lucide-react";
import { Badge, Button, Drawer, EmptyState } from "@/components/ui";
import {
  formatArea,
  formatMonthYear,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import { comparableStats, MIN_COMPARABLES, useComparables } from "./comparables-store";
import { dvfTypeLabel } from "./dvf-labels";

/**
 * Ré-export historique : une douzaine d'écrans importent `dvfTypeLabel` depuis
 * ce module. La définition vit désormais dans `dvf-labels.ts`, pour que
 * l'export CSV puisse l'utiliser sans tirer un composant client.
 */
export { dvfTypeLabel };

/** Screens where the basket IS the content — a floating copy would be noise. */
const HIDDEN_ON = ["/observatoire/comparables"];

export function ComparablesCart() {
  const { items, count, activeCount, hydrated, source, failed, remove, clear } = useComparables();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  if (!hydrated || count === 0) return null;
  if (HIDDEN_ON.some((href) => pathname === href)) return null;

  const stats = comparableStats(items.filter((i) => !i.excluded));
  const missing = Math.max(0, MIN_COMPARABLES - activeCount);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:inset-x-auto sm:right-6 sm:justify-end md:bottom-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-12 w-full max-w-md items-center gap-3 rounded-lg border border-border bg-surface-inverted px-4 text-left text-ink-inverted shadow-lg transition-transform hover:-translate-y-0.5 sm:w-auto"
        >
          <Layers className="size-5 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              Comparables sélectionnés · {count}
            </span>
            <span className="block truncate text-xs text-ink-inverted/70">
              {missing > 0
                ? `Encore ${missing} pour lancer un calcul (minimum ${MIN_COMPARABLES})`
                : stats.median !== undefined
                  ? `Médiane ${formatPricePerSqm(stats.median)}`
                  : "Surfaces non renseignées"}
            </span>
          </span>
          <span className="shrink-0 rounded-sm bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg">
            Ouvrir
          </span>
        </button>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={`Comparables sélectionnés · ${count}`}
        description={
          /*
           * Le panier suit la navigation dans les deux cas. Ce qui change est
           * jusqu'où : d'un écran à l'autre quand il tient dans le navigateur,
           * d'un appareil à l'autre quand il est rattaché à un compte. Le dire
           * ici évite d'avoir à ouvrir « Mes comparables » pour le savoir.
           */
          source === "account"
            ? "Votre panier suit la navigation, et il est rattaché à votre compte."
            : "Votre panier suit la navigation, dans ce navigateur."
        }
        size="md"
        footer={
          <div className="space-y-2">
            {failed && (
              <p role="status" className="text-xs text-warning-soft-fg">
                Votre compte n&apos;a pas pu être joint&nbsp;: vos dernières modifications ne sont
                pas enregistrées.
              </p>
            )}
            {missing > 0 && (
              <p className="text-xs text-warning-soft-fg">
                Le moteur exige au moins {MIN_COMPARABLES} comparables retenus (secret
                statistique). Il en manque {missing}.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {/*
                Le panier emmène vers l'écran qui porte la sélection entière —
                statistiques, dispersion, export. Pas vers un atelier de
                valorisation : il n'existe pas encore, et un bouton qui promet
                un écran absent coûte plus cher que pas de bouton du tout.
              */}
              <Button onClick={() => router.push("/observatoire/comparables")}>
                <Scale className="size-4" aria-hidden />
                Voir la sélection
              </Button>
              <Button variant="ghost" onClick={clear}>
                <Trash2 className="size-4" aria-hidden />
                Vider
              </Button>
            </div>
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            title="Panier vide"
            description="Ajoutez des transactions depuis l'observatoire ou la recherche tabulaire."
          />
        ) : (
          <ul className="space-y-2">
            {items.map(({ transaction }) => (
              <li
                key={transaction.id}
                className="flex items-start gap-3 rounded-md border border-border bg-surface-2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {transaction.addressLabel ?? "Adresse non publiée"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {transaction.city} · {dvfTypeLabel(transaction.propertyType)} ·{" "}
                    {formatMonthYear(transaction.date)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink tnum">
                    <span className="font-semibold">{formatPrice(transaction.price)}</span>
                    <span className="text-ink-muted">{formatArea(transaction.builtArea)}</span>
                    <span className="text-accent-soft-fg">
                      {formatPricePerSqm(transaction.pricePerSqm)}
                    </span>
                    {transaction.isMultiLot && (
                      <Badge tone="warning" size="sm">
                        Multi-lots
                      </Badge>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(transaction.id)}
                  aria-label={`Retirer ${transaction.addressLabel ?? "cette transaction"} du panier`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
}
