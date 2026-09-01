"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { AddressAutocomplete } from "@/components/map/address-autocomplete";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import { haversineMeters } from "@/lib/geo/distance";
import {
  formatArea,
  formatDistance,
  formatMonthYear,
  formatNumber,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import type { DvfQueryFilters, DvfResult, DvfTransaction } from "@/types/dvf";
import type { GeoAddress } from "@/types/geo";
import { cn } from "@/lib/utils/cn";
import { ComparableToggle, ComparableToggleIcon } from "./comparable-toggle";
import { downloadCsv, toCsv } from "./csv";
import { dvfTypeLabel } from "./dvf-labels";
import { DvfFilters } from "./dvf-filters";
import { RealDataNotice } from "./data-notice";

type SortKey = "date" | "price" | "area" | "pricePerSqm" | "distance" | "type";
type SortDirection = "asc" | "desc";

const RADIUS_OPTIONS = [500, 1000, 2000, 5000];
const PAGE_SIZE = 25;
const DEFAULT_FILTERS: DvfQueryFilters = { limit: 1500 };

function buildQuery(address: GeoAddress, radius: number, filters: DvfQueryFilters): string {
  const params = new URLSearchParams();
  params.set("lat", address.coordinates.lat.toFixed(6));
  params.set("lng", address.coordinates.lng.toFixed(6));
  params.set("radius", String(radius));
  if (filters.propertyTypes?.length) params.set("types", filters.propertyTypes.join(","));
  if (filters.yearMin !== undefined) params.set("yearMin", String(filters.yearMin));
  if (filters.yearMax !== undefined) params.set("yearMax", String(filters.yearMax));
  if (filters.priceMin !== undefined) params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set("priceMax", String(filters.priceMax));
  if (filters.areaMin !== undefined) params.set("areaMin", String(filters.areaMin));
  if (filters.areaMax !== undefined) params.set("areaMax", String(filters.areaMax));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  return params.toString();
}

export function TransactionsExplorer() {
  const [address, setAddress] = useState<GeoAddress | null>(null);
  const [radius, setRadius] = useState(1000);
  const [filters, setFilters] = useState<DvfQueryFilters>(DEFAULT_FILTERS);

  const [rows, setRows] = useState<DvfTransaction[]>([]);
  const [result, setResult] = useState<DvfResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  /**
   * `docs/architecture-site.md` §6 : chercher, trier et filtrer est libre ;
   * EMPORTER demande un compte. Le bouton reste donc actif et cliquable — il
   * ouvre une invitation, jamais un cul-de-sac.
   */

  const search = useCallback(async () => {
    if (!address) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/dvf/transactions?${buildQuery(address, radius, filters)}`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
            ? (payload as { error: { message: string } }).error.message
            : "Le service DVF est momentanément indisponible.";
        setErrorMessage(message);
        setStatus("error");
        return;
      }

      const payload = (await response.json()) as DvfResult;
      setResult(payload);
      setRows(payload.transactions);
      setPage(0);
      setStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMessage("La requête n'a pas abouti. Vérifiez votre connexion et réessayez.");
      setStatus("error");
    }
  }, [address, radius, filters]);

  // Re-run whenever the query changes; the address is the trigger that matters.
  useEffect(() => {
    if (!address) return;
    void search();
    return () => abortRef.current?.abort();
  }, [address, radius, filters, search]);

  const sorted = useMemo(() => {
    const origin = address?.coordinates;
    const withDistance = rows.map((transaction) => ({
      transaction,
      distance: origin ? haversineMeters(origin, transaction.coordinates) : undefined,
    }));

    const factor = sortDirection === "asc" ? 1 : -1;
    return withDistance.sort((a, b) => {
      switch (sortKey) {
        case "price":
          return (a.transaction.price - b.transaction.price) * factor;
        case "area":
          return ((a.transaction.builtArea ?? 0) - (b.transaction.builtArea ?? 0)) * factor;
        case "pricePerSqm":
          return ((a.transaction.pricePerSqm ?? 0) - (b.transaction.pricePerSqm ?? 0)) * factor;
        case "distance":
          return ((a.distance ?? 0) - (b.distance ?? 0)) * factor;
        case "type":
          return a.transaction.propertyType.localeCompare(b.transaction.propertyType) * factor;
        case "date":
        default:
          return a.transaction.date.localeCompare(b.transaction.date) * factor;
      }
    });
  }, [rows, sortKey, sortDirection, address]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "distance" || key === "area" ? "asc" : "desc");
    }
    setPage(0);
  };

  const sortState = (key: SortKey): "asc" | "desc" | false =>
    sortKey === key ? sortDirection : false;

  const runExport = () => {
    const header = [
      "Type",
      "Date",
      "Prix (€)",
      "Surface (m²)",
      "Prix au m² (€)",
      "Pièces",
      "Adresse",
      "Commune",
      "Code INSEE",
      "Distance (m)",
      "Multi-lots",
      "Source",
    ];
    const body = sorted.map(({ transaction, distance }) => [
      dvfTypeLabel(transaction.propertyType),
      transaction.date,
      transaction.price,
      transaction.builtArea,
      transaction.pricePerSqm,
      transaction.rooms,
      transaction.addressLabel,
      transaction.city,
      transaction.cityCode,
      distance !== undefined ? Math.round(distance) : undefined,
      transaction.isMultiLot ? "oui" : "non",
      transaction.source,
    ]);

    downloadCsv(
      toCsv([header, ...body]),
      `corpusimmo-transactions-${address?.cityCode ?? "export"}`,
    );
  };

  const exportCsv = runExport;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
        <div>
          <label htmlFor="tx-address" className="mb-1.5 block text-sm font-medium text-ink">
            Adresse ou commune
          </label>
          <AddressAutocomplete
            id="tx-address"
            value={address}
            onSelect={setAddress}
            placeholder="12 rue Crébillon, 44000 Nantes"
            size="md"
          />
        </div>

        <Field label="Rayon" htmlFor="tx-radius">
          <Select
            id="tx-radius"
            value={radius}
            onChange={(event) => setRadius(Number(event.currentTarget.value))}
          >
            {RADIUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value < 1000 ? `${value} m` : `${value / 1000} km`}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-2">
          <Button onClick={() => void search()} disabled={!address || status === "loading"}>
            <Search className="size-4" aria-hidden />
            Rechercher
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={sorted.length === 0}
          >
            <Download className="size-4" aria-hidden />
            CSV
          </Button>
        </div>
      </div>

      <DvfFilters value={filters} onChange={setFilters} onReset={() => setFilters(DEFAULT_FILTERS)} />

      {/* ---------------------------------------------------------- states */}
      {status === "idle" && (
        <EmptyState
          icon={<Search className="size-6" aria-hidden />}
          title="Commencez par une adresse"
          description="Saisissez une adresse ou une commune : la recherche interroge les mutations DVF géolocalisées dans le rayon choisi."
        />
      )}

      {status === "loading" && <LoadingState label="Interrogation des fichiers DVF…" />}

      {status === "error" && (
        <ErrorState
          title="Recherche impossible"
          description={errorMessage ?? undefined}
          onRetry={() => void search()}
        />
      )}

      {status === "ready" && sorted.length === 0 && (
        <EmptyState
          title="Aucune mutation trouvée"
          description="Élargissez le rayon, la période, ou retirez les filtres de prix et de surface."
          action={
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Réinitialiser les filtres
            </Button>
          }
        />
      )}

      {/* ---------------------------------------------------------- results */}
      {status === "ready" && sorted.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <p className="text-ink-muted">
              <strong className="font-semibold text-ink tnum">{formatNumber(sorted.length)}</strong>{" "}
              mutations · rayon {formatDistance(radius)} autour de{" "}
              <span className="text-ink">{address?.label}</span>
            </p>
            {result?.truncated && (
              <Badge tone="warning" size="sm">
                Résultat plafonné
              </Badge>
            )}
            {result?.communes && result.communes.length > 0 && (
              <span className="text-xs text-ink-subtle">
                {result.communes.length} commune{result.communes.length > 1 ? "s" : ""} consultée
                {result.communes.length > 1 ? "s" : ""}
              </span>
            )}
            <RealDataNotice className="w-full" />
          </div>

          {/* Desktop: dense sortable table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell sortable sorted={sortState("type")} onSort={() => onSort("type")}>
                    Type
                  </TableHeaderCell>
                  <TableHeaderCell sortable sorted={sortState("date")} onSort={() => onSort("date")}>
                    Date
                  </TableHeaderCell>
                  <TableHeaderCell
                    align="right"
                    sortable
                    sorted={sortState("price")}
                    onSort={() => onSort("price")}
                  >
                    Prix
                  </TableHeaderCell>
                  <TableHeaderCell
                    align="right"
                    sortable
                    sorted={sortState("area")}
                    onSort={() => onSort("area")}
                  >
                    Surface
                  </TableHeaderCell>
                  <TableHeaderCell
                    align="right"
                    sortable
                    sorted={sortState("pricePerSqm")}
                    onSort={() => onSort("pricePerSqm")}
                  >
                    €/m²
                  </TableHeaderCell>
                  <TableHeaderCell>Adresse</TableHeaderCell>
                  <TableHeaderCell
                    align="right"
                    sortable
                    sorted={sortState("distance")}
                    onSort={() => onSort("distance")}
                  >
                    Distance
                  </TableHeaderCell>
                  <TableHeaderCell align="center">Comparable</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map(({ transaction, distance }) => (
                  <TableRow key={transaction.id}>
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
                      <span className="whitespace-nowrap font-medium tnum">
                        {formatPrice(transaction.price)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="whitespace-nowrap tnum">
                        {formatArea(transaction.builtArea)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="whitespace-nowrap font-medium text-accent-soft-fg tnum">
                        {formatPricePerSqm(transaction.pricePerSqm)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-72 truncate text-sm">
                        {transaction.addressLabel ?? "Adresse non publiée"}
                      </span>
                      <span className="block text-xs text-ink-subtle">{transaction.city}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="whitespace-nowrap tnum">{formatDistance(distance)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <ComparableToggleIcon transaction={transaction} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: the same rows, stacked — a 8-column table is unusable at 375px */}
          <ul className="space-y-2 md:hidden">
            {pageRows.map(({ transaction, distance }) => (
              <li key={transaction.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {transaction.addressLabel ?? "Adresse non publiée"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {transaction.city} · {dvfTypeLabel(transaction.propertyType)} ·{" "}
                      {formatMonthYear(transaction.date)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-subtle tnum">
                    {formatDistance(distance)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-subtle">Prix</dt>
                    <dd className="font-semibold text-ink tnum">{formatPrice(transaction.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Surface</dt>
                    <dd className="font-semibold text-ink tnum">
                      {formatArea(transaction.builtArea)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">€/m²</dt>
                    <dd className="font-semibold text-accent-soft-fg tnum">
                      {formatPricePerSqm(transaction.pricePerSqm)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <ComparableToggle transaction={transaction} fullWidth />
                </div>
              </li>
            ))}
          </ul>

          {/* ------------------------------------------------------ paging */}
          <nav
            aria-label="Pagination des mutations"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <p className="text-sm text-ink-muted tnum">
              Page {page + 1} sur {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Suivant
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </nav>
        </div>
      )}

      <p className={cn("text-xs text-ink-subtle", status === "idle" && "hidden")}>
        L&apos;export CSV reprend l&apos;intégralité des lignes chargées, dans l&apos;ordre de tri
        courant.
      </p>
    </div>
  );
}
