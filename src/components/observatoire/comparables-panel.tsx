"use client";

import Link from "next/link";
import { Download, EyeOff, Layers, Map as MapIcon, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import { DistributionChart } from "@/components/charts";
import {
  formatArea,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { comparableStats, MIN_COMPARABLES, useComparables } from "./comparables-store";
import { comparablesToCsv, downloadCsv } from "./csv";
import { dvfTypeLabel } from "./comparables-cart";
import { RealDataNotice } from "./data-notice";

export function ComparablesPanel() {
  const { items, count, activeCount, hydrated, remove, clear, setExcluded } = useComparables();
  /**
   * Rien n'est verrouillé dans cette version : consulter, exclure, mesurer la
   * dispersion ET emporter en tableur sont tous libres. Le compte n'apparaîtra
   * que le jour où quelque chose devra survivre à l'appareil — retrouver une
   * sélection ailleurs, pas la télécharger ici.
   */
  const exportSelection = () => downloadCsv(comparablesToCsv(items), "corpusimmo-comparables");

  if (!hydrated) {
    return (
      <p className="text-sm text-ink-muted" aria-live="polite">
        Chargement de votre sélection…
      </p>
    );
  }

  if (count === 0) {
    return (
      <EmptyState
        icon={<Layers className="size-6" aria-hidden />}
        title="Aucun comparable sélectionné"
        description="Votre panier se remplit depuis l'observatoire ou depuis la recherche tabulaire. Il est conservé d'un écran à l'autre et d'une session à l'autre."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/observatoire">
                <MapIcon className="size-4" aria-hidden />
                Ouvrir l&apos;observatoire
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/observatoire/transactions">Rechercher des transactions</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const active = items.filter((item) => !item.excluded);
  const stats = comparableStats(active);
  const missing = Math.max(0, MIN_COMPARABLES - activeCount);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Comparables retenus",
            value: `${activeCount}`,
            hint: count > activeCount ? `${count - activeCount} exclus du calcul` : "Tous retenus",
          },
          {
            label: "Médiane €/m²",
            value: formatPricePerSqm(stats.median),
            hint:
              stats.min !== undefined && stats.max !== undefined
                ? `${formatPricePerSqm(stats.min)} → ${formatPricePerSqm(stats.max)}`
                : "Surfaces manquantes",
          },
          {
            label: "Dispersion",
            value: stats.dispersion !== undefined ? formatPercent(stats.dispersion, 0) : "–",
            hint: "Écart interquartile rapporté à la médiane",
          },
          {
            label: "Période couverte",
            value: stats.yearRange ? `${stats.yearRange[0]} → ${stats.yearRange[1]}` : "–",
            hint: `${formatArea(stats.totalArea)} de surface cumulée`,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-ink-subtle">{stat.label}</p>
            <p className="mt-1 text-xl font-semibold text-ink tnum">{stat.value}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      {missing > 0 && (
        <div className="rounded-md border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning-soft-fg">
          <p className="font-semibold">
            {missing} comparable{missing > 1 ? "s" : ""} manquant{missing > 1 ? "s" : ""}
          </p>
          <p className="mt-1">
            Le moteur d&apos;estimation exige au minimum {MIN_COMPARABLES} comparables retenus.
            C&apos;est une contrainte de secret statistique, pas un réglage. En dessous, aucune
            valeur n&apos;est produite.
          </p>
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-subtle">
        Cette sélection est conservée sur cet appareil, dans ce navigateur. Elle ne quitte pas votre
        machine et ne survivra pas à un changement d&apos;appareil.
      </p>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* --------------------------------------------------- distribution */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Distribution des €/m²</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pricesPerSqm.length > 0 ? (
              <DistributionChart
                values={stats.pricesPerSqm}
                highlight={stats.median}
                format={formatPricePerSqm}
                height={200}
              />
            ) : (
              <p className="text-sm text-ink-muted">
                Aucune des mutations retenues ne porte de surface bâtie exploitable : le prix au m²
                ne peut pas être calculé.
              </p>
            )}
            <RealDataNotice className="mt-3" />
          </CardContent>
        </Card>

        {/* --------------------------------------------------------- table */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Sélection courante · {formatNumber(count)}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportSelection}>
                  <Download className="size-4" aria-hidden />
                  Exporter en CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={clear}>
                  <Trash2 className="size-4" aria-hidden />
                  Vider la sélection
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Adresse</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell align="right">Surface</TableHeaderCell>
                    <TableHeaderCell align="right">Prix</TableHeaderCell>
                    <TableHeaderCell align="right">€/m²</TableHeaderCell>
                    <TableHeaderCell align="center">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(({ transaction, excluded }) => (
                    <TableRow key={transaction.id} className={cn(excluded && "opacity-55")}>
                      <TableCell>
                        <span className="block max-w-64 truncate text-sm">
                          {transaction.addressLabel ?? "Adresse non publiée"}
                        </span>
                        <span className="block text-xs text-ink-subtle">{transaction.city}</span>
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap text-sm">
                          {dvfTypeLabel(transaction.propertyType)}
                        </span>
                        {transaction.isMultiLot && (
                          <Badge tone="warning" size="sm" className="ml-2">
                            Multi-lots
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap tnum">
                          {formatMonthYear(transaction.date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tnum">{formatArea(transaction.builtArea)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium tnum">{formatPrice(transaction.price)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-accent-soft-fg tnum">
                          {formatPricePerSqm(transaction.pricePerSqm)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-pressed={excluded}
                            aria-label={
                              excluded
                                ? "Réintégrer ce comparable au calcul"
                                : "Exclure ce comparable du calcul"
                            }
                            title={excluded ? "Réintégrer" : "Exclure du calcul"}
                            onClick={() => setExcluded(transaction.id, !excluded)}
                          >
                            <EyeOff className="size-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Retirer du panier"
                            title="Retirer du panier"
                            onClick={() => remove(transaction.id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <ul className="space-y-2 md:hidden">
              {items.map(({ transaction, excluded }) => (
                <li
                  key={transaction.id}
                  className={cn(
                    "rounded-md border border-border bg-surface-2 p-3",
                    excluded && "opacity-55",
                  )}
                >
                  <p className="truncate text-sm font-medium text-ink">
                    {transaction.addressLabel ?? "Adresse non publiée"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {transaction.city} · {dvfTypeLabel(transaction.propertyType)} ·{" "}
                    {formatMonthYear(transaction.date)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs tnum">
                    <span className="font-semibold text-ink">{formatPrice(transaction.price)}</span>
                    <span className="text-ink-muted">{formatArea(transaction.builtArea)}</span>
                    <span className="font-medium text-accent-soft-fg">
                      {formatPricePerSqm(transaction.pricePerSqm)}
                    </span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExcluded(transaction.id, !excluded)}
                    >
                      {excluded ? "Réintégrer" : "Exclure"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(transaction.id)}>
                      <Trash2 className="size-4" aria-hidden />
                      Retirer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
