"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Scale, X } from "lucide-react";
import { AddressAutocomplete } from "@/components/map/address-autocomplete";
import { LazyDvfMap } from "@/components/map/map-loader";
import type { DvfMapState } from "@/components/map/dvf-map";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { computeMarketStats } from "@/lib/dvf/aggregate";
import {
  formatArea,
  formatDistance,
  formatMonthYear,
  formatNumber,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import { haversineMeters } from "@/lib/geo/distance";
import type { DvfQueryFilters, DvfResult, DvfTransaction } from "@/types/dvf";
import type { GeoAddress } from "@/types/geo";
import { cn } from "@/lib/utils/cn";
import { ComparableToggle } from "./comparable-toggle";
import { useComparables } from "./comparables-store";
import { dvfTypeLabel } from "./comparables-cart";
import { DvfFilters } from "./dvf-filters";
import { RealDataNotice } from "./data-notice";

/** Nantes — the reference market used across the product's copy. */
const DEFAULT_CENTER = { lat: 47.2173, lng: -1.5534 };
const DEFAULT_FILTERS: DvfQueryFilters = { limit: 1200 };
/** Rendering thousands of side-panel rows helps nobody; the map already shows them. */
const LIST_CAP = 80;

export function ObservatoireWorkspace() {
  const [filters, setFilters] = useState<DvfQueryFilters>(DEFAULT_FILTERS);
  const [address, setAddress] = useState<GeoAddress | null>(null);
  const [result, setResult] = useState<DvfResult | null>(null);
  const [state, setState] = useState<DvfMapState>("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { ids, count: basketCount } = useComparables();

  const onDataChange = useCallback(
    (next: DvfResult | null, nextState: DvfMapState) => {
      setResult(next);
      setState(nextState);
    },
    [],
  );

  const center = address?.coordinates ?? DEFAULT_CENTER;
  const transactions = useMemo(() => result?.transactions ?? [], [result]);

  const stats = useMemo(() => computeMarketStats(transactions), [transactions]);

  const sorted = useMemo(() => {
    const origin = address?.coordinates;
    return [...transactions]
      .sort((a, b) => {
        if (origin) {
          return (
            haversineMeters(origin, a.coordinates) - haversineMeters(origin, b.coordinates)
          );
        }
        return b.date.localeCompare(a.date);
      })
      .slice(0, LIST_CAP);
  }, [transactions, address]);

  const selected = useMemo(
    () => transactions.find((t) => t.id === selectedId) ?? null,
    [transactions, selectedId],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_auto] lg:items-end">
        <div>
          <label
            htmlFor="observatoire-address"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Centrer sur une adresse ou une commune
          </label>
          <AddressAutocomplete
            id="observatoire-address"
            value={address}
            onSelect={setAddress}
            placeholder="12 rue Crébillon, 44000 Nantes"
            size="md"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {address && (
            <Button variant="ghost" size="sm" onClick={() => setAddress(null)}>
              <X className="size-4" aria-hidden />
              Retirer le point d&apos;étude
            </Button>
          )}
          {/*
            Vers `/observatoire/comparables`, PAS vers la valorisation du
            workspace : l'observatoire est public, et envoyer un visiteur sans
            session sur un écran protégé produirait une redirection sèche vers
            `/connexion`. La sélection publique montre déjà les statistiques ;
            c'est depuis elle que la porte du compte se présente, expliquée.
          */}
          <Button variant={basketCount > 0 ? "primary" : "outline"} size="sm" asChild>
            <Link href="/observatoire/comparables">
              <Scale className="size-4" aria-hidden />
              Analyser les comparables ({basketCount})
            </Link>
          </Button>
        </div>
      </div>

      <DvfFilters
        value={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* --------------------------------------------------------- map */}
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <LazyDvfMap
            key={`${center.lat.toFixed(5)},${center.lng.toFixed(5)}`}
            className="h-[58vh] min-h-[380px] w-full lg:h-[calc(100vh-21rem)]"
            initialCenter={center}
            initialZoom={address ? 15 : 13}
            filters={filters}
            subject={address ? { point: address.coordinates, label: address.label, radius: 500 } : null}
            selectedId={selectedId}
            onSelect={(transaction) => setSelectedId(transaction?.id ?? null)}
            comparableIds={ids}
            onDataChange={onDataChange}
            density="dense"
          />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-sm">
            <span className="text-ink-muted">
              <strong className="font-semibold text-ink tnum">{formatNumber(stats.count)}</strong>{" "}
              mutations affichées
            </span>
            {stats.medianPricePerSqm !== undefined && (
              <span className="text-ink-muted">
                Médiane{" "}
                <strong className="font-semibold text-ink tnum">
                  {formatPricePerSqm(stats.medianPricePerSqm)}
                </strong>
              </span>
            )}
            {stats.medianPrice !== undefined && (
              <span className="text-ink-muted">
                Prix médian{" "}
                <strong className="font-semibold text-ink tnum">
                  {formatPrice(stats.medianPrice)}
                </strong>
              </span>
            )}
            {stats.yearRange && (
              <span className="text-ink-muted tnum">
                {stats.yearRange[0]} → {stats.yearRange[1]}
              </span>
            )}
            {result?.truncated && (
              <Badge tone="warning" size="sm">
                Résultat tronqué — affinez les filtres
              </Badge>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------- panel */}
        <aside
          aria-label="Mutations de la vue courante"
          className="flex max-h-[calc(100vh-21rem)] min-h-[380px] flex-col overflow-hidden rounded-lg border border-border bg-surface"
        >
          <div className="shrink-0 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Mutations de la vue</h2>
            <RealDataNotice className="mt-1" />
          </div>

          {selected && (
            <div className="shrink-0 border-b border-border bg-surface-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {selected.addressLabel ?? "Adresse non publiée"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {selected.city} · {dvfTypeLabel(selected.propertyType)} ·{" "}
                    {formatMonthYear(selected.date)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Fermer le détail"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-ink-subtle">Prix</dt>
                  <dd className="font-semibold text-ink tnum">{formatPrice(selected.price)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Surface</dt>
                  <dd className="font-semibold text-ink tnum">{formatArea(selected.builtArea)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">€/m²</dt>
                  <dd className="font-semibold text-accent-soft-fg tnum">
                    {formatPricePerSqm(selected.pricePerSqm)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <ComparableToggle transaction={selected} fullWidth />
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
            {state === "loading" && <LoadingState label="Chargement des mutations…" />}

            {state === "error" && (
              <ErrorState
                title="Données indisponibles"
                description="Le service DVF n'a pas répondu. Réessayez dans quelques instants ou déplacez la carte."
              />
            )}

            {state === "ready" && sorted.length === 0 && (
              <EmptyState
                icon={<MapPin className="size-6" aria-hidden />}
                title="Aucune mutation dans cette vue"
                description="Élargissez l'emprise de la carte ou assouplissez les filtres."
              />
            )}

            {state === "ready" && sorted.length > 0 && (
              <ul className="divide-y divide-border-soft">
                {sorted.map((transaction) => (
                  <TransactionListItem
                    key={transaction.id}
                    transaction={transaction}
                    origin={address?.coordinates}
                    active={transaction.id === selectedId}
                    onFocus={() => setSelectedId(transaction.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {state === "ready" && transactions.length > LIST_CAP && (
            <p className="shrink-0 border-t border-border px-4 py-2 text-xs text-ink-subtle">
              {formatNumber(LIST_CAP)} mutations listées sur {formatNumber(transactions.length)}.
              Zoomez pour affiner la sélection.
            </p>
          )}
        </aside>
      </div>

      {state === "ready" && transactions.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-ink-muted">
              Aucune mutation ne correspond à cette vue. L&apos;observatoire interroge les
              fichiers DVF géolocalisés commune par commune : un zoom trop large ou une commune
              non couverte (Alsace-Moselle, Mayotte) peut expliquer l&apos;absence de résultat.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TransactionListItem({
  transaction,
  origin,
  active,
  onFocus,
}: {
  transaction: DvfTransaction;
  origin?: { lat: number; lng: number };
  active: boolean;
  onFocus: () => void;
}) {
  const distance = origin ? haversineMeters(origin, transaction.coordinates) : undefined;

  return (
    <li className={cn("p-3 transition-colors", active ? "bg-surface-3" : "hover:bg-surface-2")}>
      <button
        type="button"
        onClick={onFocus}
        className="block w-full text-left"
        aria-label={`Voir ${transaction.addressLabel ?? "cette mutation"} sur la carte`}
      >
        <p className="truncate text-sm font-medium text-ink">
          {transaction.addressLabel ?? "Adresse non publiée"}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {dvfTypeLabel(transaction.propertyType)} · {formatMonthYear(transaction.date)}
          {distance !== undefined && ` · ${formatDistance(distance)}`}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs tnum">
          <span className="font-semibold text-ink">{formatPrice(transaction.price)}</span>
          <span className="text-ink-muted">{formatArea(transaction.builtArea)}</span>
          <span className="font-medium text-accent-soft-fg">
            {formatPricePerSqm(transaction.pricePerSqm)}
          </span>
          {transaction.isMultiLot && (
            <Badge tone="warning" size="sm">
              Multi-lots
            </Badge>
          )}
        </p>
      </button>
      <div className="mt-2">
        <ComparableToggle transaction={transaction} fullWidth />
      </div>
    </li>
  );
}
