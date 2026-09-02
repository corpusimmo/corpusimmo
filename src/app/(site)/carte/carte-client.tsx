"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Crosshair, Loader2, SlidersHorizontal, ZoomIn } from "lucide-react";
import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import { AddressAutocomplete } from "@/components/map/address-autocomplete";
import type { DvfMapState } from "@/components/map/dvf-map";
import { LazyDvfMap } from "@/components/map/map-loader";
import { TransactionCard } from "@/components/map/transaction-card";
import { Badge, Button, Drawer, Field, Input, Select, Skeleton } from "@/components/ui";
import { median } from "@/lib/valuation/stats";
import { formatNumber, formatPrice, formatPricePerSqm } from "@/lib/utils/format";
import type { DvfPropertyType, DvfQueryFilters, DvfResult, DvfTransaction } from "@/types/dvf";
import type { GeoAddress, LatLng } from "@/types/geo";
import { readUrlTarget } from "./url-target";

/** Zoomed-out France: the map says "zoom in" rather than pretending to know
 *  which city interests you. */
const FRANCE_CENTER: LatLng = { lat: 46.7, lng: 2.4 };
const FRANCE_ZOOM = 5.4;

const DEFAULT_FILTERS: DvfQueryFilters = { limit: 400 };

/**
 * Les familles proposées en un clic au-dessus de la carte.
 *
 * Le TERTIAIRE manquait, alors que la donnée était là depuis le début : DVF
 * publie `type_local` avec la valeur « Local industriel, commercial ou
 * assimilé », que notre pipeline normalise en `commercial` et que le tiroir de
 * filtres proposait déjà. Seules les pastilles l'ignoraient — on téléchargeait
 * la donnée sans jamais l'exposer.
 *
 * `dependency` couvre garages, caves et annexes : elles faussent une médiane au
 * m² si on les mélange au reste, d'où une pastille à part plutôt qu'un
 * regroupement.
 */
const TYPE_CHIPS: {
  id: string;
  label: string;
  types?: DvfPropertyType[];
  /** La silhouette du type, tirée de la même bibliothèque que les fiches outils. */
  icon?: AssetIconName;
}[] = [
  { id: "all", label: "Toutes" },
  { id: "apartment", label: "Appartement", types: ["apartment"], icon: "apartment" },
  { id: "house", label: "Maison", types: ["house"], icon: "house" },
  { id: "commercial", label: "Local pro", types: ["commercial"], icon: "retail" },
  { id: "land", label: "Terrain", types: ["land"], icon: "land" },
  { id: "dependency", label: "Dépendance", types: ["dependency"], icon: "parking" },
];

// Le type vient de la carte : c'est elle qui produit ces états.
type MapState = DvfMapState;

interface DraftFilters {
  period: string;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
}

const EMPTY_DRAFT: DraftFilters = {
  period: "all",
  priceMin: "",
  priceMax: "",
  areaMin: "",
  areaMax: "",
};

function toNumber(value: string): number | undefined {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : undefined;
}

export function CarteClient() {
  const [center, setCenter] = useState<LatLng | null>(null);
  const [zoom, setZoom] = useState(FRANCE_ZOOM);
  const [address, setAddress] = useState<GeoAddress | null>(null);
  /**
   * L'URL est lue une fois monté (`?commune=` ou `?lat=&lng=&zoom=`, voir
   * `url-target.ts`), et la carte n'est créée qu'après : la clé du composant
   * porte le centre, la créer avant reviendrait à la détruire aussitôt.
   */
  const [urlRead, setUrlRead] = useState(false);

  useEffect(() => {
    const target = readUrlTarget(window.location.search);
    if (target) {
      setCenter(target.center);
      setZoom(target.zoom);
      if (target.address) setAddress(target.address);
    }
    setUrlRead(true);
  }, []);

  // La barre flottante n'existe que sous 1024 px : c'est la seule largeur où
  // les commandes de la carte doivent lui céder le haut de l'écran.
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [filters, setFilters] = useState<DvfQueryFilters>(DEFAULT_FILTERS);
  const [typeChip, setTypeChip] = useState("all");
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);
  const [appliedDraft, setAppliedDraft] = useState<DraftFilters>(EMPTY_DRAFT);

  const [result, setResult] = useState<DvfResult | null>(null);
  const [mapState, setMapState] = useState<MapState>("loading");
  const [selected, setSelected] = useState<DvfTransaction | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Vrai sous 1024 px, où la page superpose sa propre barre à la carte. */
  const [compact, setCompact] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Stable callbacks: the map re-subscribes whenever these change identity.
  const handleData = useCallback((next: DvfResult | null, state: MapState) => {
    setMapState(state);
    if (state !== "loading") setResult(state === "ready" ? next : null);
  }, []);

  const handleSelect = useCallback((transaction: DvfTransaction | null) => {
    setSelected(transaction);
  }, []);

  const handleAddress = (next: GeoAddress | null) => {
    setAddress(next);
    if (!next) return;
    setLocationError(null);
    setCenter(next.coordinates);
    setZoom(next.kind === "municipality" ? 13 : 16);
  };

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Votre navigateur ne permet pas la géolocalisation.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        setZoom(15);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError("Nous n’avons pas pu accéder à votre position. Utilisez la recherche.");
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  const applyTypeChip = (chip: { id: string; types?: DvfPropertyType[] }) => {
    setTypeChip(chip.id);
    setFilters((current) => {
      const next: DvfQueryFilters = { ...current };
      if (chip.types) next.propertyTypes = chip.types;
      else delete next.propertyTypes;
      return next;
    });
  };

  const applyDraft = () => {
    const currentYear = new Date().getFullYear();
    const years: Record<string, number | undefined> = {
      all: undefined,
      "2": currentYear - 2,
      "5": currentYear - 5,
      "10": currentYear - 10,
    };

    setFilters((current) => {
      const next: DvfQueryFilters = { ...current };
      const yearMin = years[draft.period];
      if (yearMin !== undefined) next.yearMin = yearMin;
      else delete next.yearMin;

      const priceMin = toNumber(draft.priceMin);
      const priceMax = toNumber(draft.priceMax);
      const areaMin = toNumber(draft.areaMin);
      const areaMax = toNumber(draft.areaMax);

      if (priceMin !== undefined) next.priceMin = priceMin;
      else delete next.priceMin;
      if (priceMax !== undefined) next.priceMax = priceMax;
      else delete next.priceMax;
      if (areaMin !== undefined) next.areaMin = areaMin;
      else delete next.areaMin;
      if (areaMax !== undefined) next.areaMax = areaMax;
      else delete next.areaMax;

      return next;
    });
    setAppliedDraft(draft);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setDraft(EMPTY_DRAFT);
    setAppliedDraft(EMPTY_DRAFT);
    setTypeChip("all");
    setFilters(DEFAULT_FILTERS);
    setFiltersOpen(false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedDraft.period !== "all") count += 1;
    if (appliedDraft.priceMin || appliedDraft.priceMax) count += 1;
    if (appliedDraft.areaMin || appliedDraft.areaMax) count += 1;
    return count;
  }, [appliedDraft]);

  const stats = useMemo(() => {
    if (!result) return null;
    const rows = result.transactions;
    const perSqm = rows
      .map((row) => row.pricePerSqm)
      .filter((value): value is number => value !== undefined);
    const years = rows.map((row) => row.year);

    return {
      count: rows.length,
      medianPricePerSqm: median(perSqm),
      medianPrice: median(rows.map((row) => row.price)),
      yearMin: years.length > 0 ? Math.min(...years) : undefined,
      yearMax: years.length > 0 ? Math.max(...years) : undefined,
      truncated: result.truncated,
    };
  }, [result]);

  const isEmpty = mapState === "ready" && result !== null && result.transactions.length === 0;
  const needsZoom = mapState === "ready" && result === null;

  const statsBar = (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-6 gap-y-2"
    >
      {mapState === "loading" ? (
        <>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-24" />
        </>
      ) : null}

      {mapState === "zoom" ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <ZoomIn aria-hidden="true" className="size-4" />
          Rapprochez-vous d’un quartier pour voir les ventes et leurs statistiques.
        </p>
      ) : null}

      {mapState === "error" ? (
        <p className="flex items-center gap-2 text-sm font-medium text-danger">
          <AlertTriangle aria-hidden="true" className="size-4" />
          Les transactions sont temporairement indisponibles.
        </p>
      ) : null}

      {mapState === "ready" && needsZoom ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <ZoomIn aria-hidden="true" className="size-4" />
          Zoomez sur un quartier pour afficher les ventes.
        </p>
      ) : null}

      {mapState === "ready" && stats ? (
        stats.count === 0 ? (
          <p className="text-sm text-ink-muted">
            Aucune vente ne correspond à ces filtres.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink">
              <span className="tnum font-semibold">{formatNumber(stats.count)}</span>{" "}
              <span className="text-ink-muted">vente{stats.count > 1 ? "s" : ""} affichée{stats.count > 1 ? "s" : ""}</span>
            </p>
            {stats.medianPricePerSqm !== undefined ? (
              <p className="text-sm text-ink">
                <span className="tnum font-semibold">
                  {formatPricePerSqm(stats.medianPricePerSqm)}
                </span>{" "}
                <span className="text-ink-muted">médian</span>
              </p>
            ) : null}
            {stats.medianPrice !== undefined ? (
              <p className="text-sm text-ink">
                <span className="tnum font-semibold">{formatPrice(stats.medianPrice)}</span>{" "}
                <span className="text-ink-muted">prix médian</span>
              </p>
            ) : null}
            {stats.yearMin !== undefined && stats.yearMax !== undefined ? (
              <p className="tnum text-sm text-ink-muted">
                {stats.yearMin === stats.yearMax
                  ? stats.yearMin
                  : `${stats.yearMin} – ${stats.yearMax}`}
              </p>
            ) : null}
            {stats.truncated ? (
              <Badge tone="warning" size="sm">
                Affichage tronqué, zoomez pour tout voir
              </Badge>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* Desktop toolbar */}
      <div className="hidden border-b border-border bg-surface lg:block">
        <div className="container-page flex flex-col gap-3 py-4">
          <div className="flex items-center gap-3">
            {/* `min-w-64` : les pastilles à leur droite ne se compriment pas,
                et sans plancher c'est le champ d'adresse qui s'écrasait. */}
            <div className="w-full min-w-64 max-w-md">
              <AddressAutocomplete
                id="observatory-search"
                value={address}
                onSelect={handleAddress}
                placeholder="Rechercher une adresse, une ville…"
              />
            </div>

            <div
              role="group"
              aria-label="Type de bien"
              className="flex items-center gap-1.5"
            >
              {TYPE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => applyTypeChip(chip)}
                  aria-pressed={typeChip === chip.id}
                  className={
                    typeChip === chip.id
                      ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary bg-primary-soft py-2 pl-3 pr-3.5 text-sm font-medium text-primary-soft-fg"
                      : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface py-2 pl-3 pr-3.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:border-border-strong hover:text-ink"
                  }
                >
                  {chip.icon ? (
                    <AssetTypeIcon name={chip.icon} className="size-4" strokeWidth={2.5} />
                  ) : null}
                  {chip.label}
                </button>
              ))}
            </div>

            <Button variant="secondary" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Filtres
              {activeFilterCount > 0 ? (
                <span className="tnum ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-fg">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <Button
              variant="ghost"
              onClick={locate}
              loading={locating}
              className="ml-auto"
            >
              <Crosshair aria-hidden="true" className="size-4" />
              Autour de moi
            </Button>
          </div>

          {statsBar}
        </div>
      </div>

      <div className="relative flex-1">
        <div className="absolute inset-0">
          {urlRead ? (
          <LazyDvfMap
            key={`${center?.lat ?? "fr"}-${center?.lng ?? "fr"}-${reloadKey}`}
            className="absolute inset-0 size-full"
            initialCenter={center ?? FRANCE_CENTER}
            initialZoom={center ? zoom : FRANCE_ZOOM}
            filters={filters}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onDataChange={handleData}
            // La recherche flottante et ses deux boutons occupent le haut de
            // l'écran étroit : sans ce décalage, les commandes de la carte se
            // retrouveraient dessous. Au large, la barre est hors de la carte.
            chromeOffset={compact ? "8.5rem" : undefined}
          />
          ) : null}
        </div>

        {/* Mobile: floating search + actions over a full-screen map. */}
        <div
          className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2 lg:hidden"
        >
          <div
            className="pointer-events-auto rounded-xl border border-border bg-surface p-2 shadow-lg"
          >
            <AddressAutocomplete
              id="observatory-search-mobile"
              value={address}
              onSelect={handleAddress}
              placeholder="Rechercher une adresse…"
            />
          </div>
          <div className="pointer-events-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Filtres
              {activeFilterCount > 0 ? (
                <span className="tnum ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-fg">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={locate}
              loading={locating}
            >
              <Crosshair aria-hidden="true" className="size-4" />
              Autour de moi
            </Button>
          </div>
        </div>

        {/* Mobile stats strip */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 lg:hidden">
          <div
            className="pointer-events-auto rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
          >
            {statsBar}
          </div>
        </div>

        {/* Non-blocking overlays for the states the map cannot express itself. */}
        {mapState === "loading" ? (
          <div
            className="pointer-events-none absolute left-1/2 top-4 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-ink-muted shadow-md lg:flex"
          >
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Chargement des ventes…
          </div>
        ) : null}

        {mapState === "error" ? (
          <div
            className="absolute left-1/2 top-4 z-10 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-danger bg-surface p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-ink">
                  Les transactions sont temporairement indisponibles.
                </p>
                <p className="text-xs leading-relaxed text-ink-muted">
                  La source DVF ne répond pas. Nous préférons ne rien afficher plutôt que des
                  données approximatives.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="w-fit"
                >
                  Réessayer
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {isEmpty ? (
          <div
            className="absolute left-1/2 top-4 z-10 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-border bg-surface p-4 text-center shadow-lg"
          >
            <p className="text-sm font-semibold text-ink">Aucune vente ne correspond</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Aucune mutation enregistrée dans cette zone avec ces filtres.
            </p>
            <Button size="sm" variant="ghost" onClick={resetFilters} className="mt-2">
              Réinitialiser les filtres
            </Button>
          </div>
        ) : null}

        {locationError ? (
          <p
            role="status"
            className="absolute inset-x-3 bottom-24 z-10 mx-auto w-fit rounded-full bg-surface px-4 py-2 text-xs text-ink-muted shadow-md lg:bottom-4"
          >
            {locationError}
          </p>
        ) : null}
      </div>

      {/* Detail : side sheet on desktop, bottom sheet on mobile. */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Vente enregistrée"
        side="right"
        size="sm"
      >
        {selected ? (
          <TransactionCard transaction={selected} />
        ) : null}
      </Drawer>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrer les ventes"
        description="Les filtres s’appliquent à la zone affichée sur la carte."
        side="right"
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={resetFilters}>
              Réinitialiser
            </Button>
            <Button onClick={applyDraft} className="ml-auto">
              Afficher les résultats
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div
            role="group"
            aria-label="Type de bien"
            className="flex flex-wrap gap-2 lg:hidden"
          >
            {TYPE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => applyTypeChip(chip)}
                aria-pressed={typeChip === chip.id}
                className={
                  typeChip === chip.id
                    ? "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary-soft pl-3 pr-4 text-sm font-medium text-primary-soft-fg"
                    : "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface pl-3 pr-4 text-sm font-medium text-ink-muted"
                }
              >
                {chip.icon ? (
                  <AssetTypeIcon name={chip.icon} className="size-4" strokeWidth={2.5} />
                ) : null}
                {chip.label}
              </button>
            ))}
          </div>

          <Field label="Période" htmlFor="filter-period">
            <Select
              id="filter-period"
              value={draft.period}
              onChange={(event) => setDraft({ ...draft, period: event.target.value })}
            >
              <option value="all">Tout l’historique disponible</option>
              <option value="2">2 dernières années</option>
              <option value="5">5 dernières années</option>
              <option value="10">10 dernières années</option>
            </Select>
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-ink">Prix de vente</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum" htmlFor="filter-price-min">
                <Input
                  id="filter-price-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={10000}
                  placeholder="0 €"
                  value={draft.priceMin}
                  onChange={(event) => setDraft({ ...draft, priceMin: event.target.value })}
                />
              </Field>
              <Field label="Maximum" htmlFor="filter-price-max">
                <Input
                  id="filter-price-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={10000}
                  placeholder="Sans limite"
                  value={draft.priceMax}
                  onChange={(event) => setDraft({ ...draft, priceMax: event.target.value })}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-ink">Surface bâtie</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum" htmlFor="filter-area-min">
                <Input
                  id="filter-area-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0 m²"
                  value={draft.areaMin}
                  onChange={(event) => setDraft({ ...draft, areaMin: event.target.value })}
                />
              </Field>
              <Field label="Maximum" htmlFor="filter-area-max">
                <Input
                  id="filter-area-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Sans limite"
                  value={draft.areaMax}
                  onChange={(event) => setDraft({ ...draft, areaMax: event.target.value })}
                />
              </Field>
            </div>
          </fieldset>

          <p className="text-xs leading-relaxed text-ink-muted">
            Les surfaces et les prix proviennent des mutations DVF. Une vente groupée de plusieurs
            lots peut afficher un prix au m² peu représentatif : elle est signalée dans son détail.
          </p>
        </div>
      </Drawer>
    </div>
  );
}
