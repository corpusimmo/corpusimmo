"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import {
  formatArea,
  formatDistance,
  formatMonthYear,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import type { Comparable } from "@/types/valuation";

const TYPE_LABELS: Record<string, string> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  dependency: "Dépendance",
  other: "Autre",
};

/**
 * Combien de ventes on montre avant de demander. Douze, c'est un écran : assez
 * pour juger de la matière, pas assez pour faire défiler cent lignes avant la
 * méthode. Le reste s'ouvre d'un clic, et se replie de même.
 */
const PREVIEW_ROWS = 12;

/**
 * Mobile reads as a list of cards, desktop as a table. Same data, two shapes :
 * a squeezed table on a 375px screen is unreadable.
 *
 * Les cent vingt ventes d'un centre-ville sont toutes là, mais pas toutes
 * ouvertes : un résultat qui fait quatorze mille pixels de haut enterre la
 * méthode et le niveau de confiance, qui sont ce qu'on demande de lire.
 */
export function ComparablesList({ comparables }: { comparables: Comparable[] }) {
  const rows = comparables.filter((comparable) => !comparable.excluded);
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, rows.length - PREVIEW_ROWS);
  const visible = expanded || hidden === 0 ? rows : rows.slice(0, PREVIEW_ROWS);

  return (
    <section
      aria-labelledby="comparables-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="comparables-title" className="text-xl font-semibold text-ink">
          Les ventes qui ont servi au calcul
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Ces mutations ont été réellement enregistrées par la DGFiP. Elles sont triées par poids
          dans le calcul : les plus proches, les plus récentes et les plus ressemblantes d’abord.
        </p>
      </div>

      {/* Mobile */}
      <ul className="flex flex-col gap-3 md:hidden">
        {visible.map((comparable) => {
          const t = comparable.transaction;
          return (
            <li
              key={t.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {t.addressLabel ?? t.city}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {TYPE_LABELS[t.propertyType] ?? t.propertyType}, {formatMonthYear(t.date)}
                  </p>
                </div>
                <p className="tnum shrink-0 text-sm font-semibold text-ink">{formatPrice(t.price)}</p>
              </div>
              <dl className="tnum grid grid-cols-3 gap-2 border-t border-border-soft pt-3 text-xs">
                <div>
                  <dt className="text-ink-subtle">Surface</dt>
                  <dd className="font-medium text-ink">{formatArea(t.builtArea)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">€ / m²</dt>
                  <dd className="font-medium text-ink">{formatPricePerSqm(t.pricePerSqm)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Distance</dt>
                  <dd className="font-medium text-ink">{formatDistance(comparable.distance)}</dd>
                </div>
              </dl>
              {t.isMultiLot ? (
                <Badge tone="warning" size="sm">
                  Vente groupée, prix au m² peu fiable
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Desktop */}
      <div
        className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block"
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Adresse</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell align="right">Distance</TableHeaderCell>
              <TableHeaderCell align="right">Date</TableHeaderCell>
              <TableHeaderCell align="right">Surface</TableHeaderCell>
              <TableHeaderCell align="right">Prix</TableHeaderCell>
              <TableHeaderCell align="right">€ / m²</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((comparable) => {
              const t = comparable.transaction;
              return (
                <TableRow key={t.id}>
                  {/* `min-w-56` : les colonnes chiffrées ne se coupent plus,
                      c'est donc l'adresse qui reçoit le jeu, et elle ne se
                      brise plus sur trois lignes. */}
                  <TableCell className="min-w-56">
                    <span className="font-medium text-ink">{t.addressLabel ?? "Adresse non publiée"}</span>
                    <span className="block text-xs text-ink-muted">
                      {t.postcode ? `${t.postcode} ` : ""}
                      {t.city}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {TYPE_LABELS[t.propertyType] ?? t.propertyType}
                    {t.isMultiLot ? (
                      <span className="block text-xs text-warning-soft-fg">Vente groupée</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-right">
                    {formatDistance(comparable.distance)}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-right">
                    {formatMonthYear(t.date)}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-right">
                    {formatArea(t.builtArea)}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-right font-medium">
                    {formatPrice(t.price)}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-right">
                    {formatPricePerSqm(t.pricePerSqm)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {hidden > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tnum text-sm text-ink-muted">
            {expanded
              ? `${rows.length} ventes affichées.`
              : `${PREVIEW_ROWS} ventes affichées sur ${rows.length}, les plus pesantes dans le calcul.`}
          </p>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Replier la liste" : `Voir les ${hidden} autres ventes`}
            <ChevronDown
              aria-hidden="true"
              className={expanded ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"}
            />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
