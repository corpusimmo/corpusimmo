"use client";

/**
 * Filter bar for the DVF map.
 *
 * Desktop: one horizontal row, always visible — filtering is the main verb of
 * the observatory, not a settings panel.
 * Mobile (<768 px): a single "Filtres" button opening a bottom `Drawer`,
 * because six controls in a row on a phone is six controls nobody uses.
 *
 * The period selector reflects how DVF actually ships: twice a year, ~6 months
 * behind, so the most recent millésime is partial and is labelled as such.
 */

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { DvfPropertyType, DvfQueryFilters } from "@/types/dvf";
import { Badge, Button, Drawer, Field, Select } from "@/components/ui";
import { isPartialYear } from "@/lib/dvf/coverage";
import { cn } from "@/lib/utils/cn";
import { PROPERTY_TYPE_LABELS } from "./transaction-card";

/** Types a buyer or a seller actually reasons about. */
const TYPE_OPTIONS: DvfPropertyType[] = ["apartment", "house", "land", "commercial"];

const PRICE_STEPS = [50_000, 100_000, 150_000, 200_000, 300_000, 400_000, 600_000, 1_000_000];
const AREA_STEPS = [20, 30, 40, 60, 80, 100, 150, 200];

export interface MapFiltersProps {
  value: DvfQueryFilters;
  onChange: (next: DvfQueryFilters) => void;
  /** Shown next to the reset action so the effect of a filter is visible. */
  resultCount?: number;
  /** Oldest millésime worth offering; defaults to five years back. */
  firstYear?: number;
  latestYear?: number;
  /** Densité d'affichage — jamais un univers. Voir `DvfMap`. */
  density?: "standard" | "dense";
  className?: string;
}

export function MapFilters({
  value,
  onChange,
  resultCount,
  firstYear,
  latestYear,
  density = "standard",
  className,
}: MapFiltersProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const maxYear = latestYear ?? new Date().getUTCFullYear();
  const minYear = firstYear ?? maxYear - 4;
  const years = React.useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const activeCount = countActive(value);

  const patch = (next: Partial<DvfQueryFilters>): void => onChange({ ...value, ...next });

  const toggleType = (type: DvfPropertyType): void => {
    const current = value.propertyTypes ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    // An empty selection means "no filter", which is what the API expects.
    patch({ propertyTypes: next.length > 0 ? next : undefined });
  };

  const reset = (): void => onChange({ limit: value.limit });

  const controls = (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-subtle">
          Type de bien
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((type) => {
            const active = value.propertyTypes?.includes(type) ?? false;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => toggleType(type)}
                className={cn(
                  "min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors md:min-h-9",
                  active
                    ? "border-primary bg-primary text-primary-fg shadow-xs"
                    : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
                )}
              >
                {PROPERTY_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Période" htmlFor="filter-year-min" className="min-w-40">
        <div className="flex items-center gap-2">
          <Select
            id="filter-year-min"
            value={value.yearMin ?? ""}
            onChange={(event) => patch({ yearMin: toNumber(event.target.value) })}
            aria-label="Année minimum"
          >
            <option value="">Depuis</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <span aria-hidden="true" className="text-ink-subtle">
            →
          </span>
          <Select
            value={value.yearMax ?? ""}
            onChange={(event) => patch({ yearMax: toNumber(event.target.value) })}
            aria-label="Année maximum"
          >
            <option value="">Jusqu’à</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
                {isPartialYear(year) ? " (partiel)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label="Prix" htmlFor="filter-price-min" className="min-w-40">
        <div className="flex items-center gap-2">
          <Select
            id="filter-price-min"
            value={value.priceMin ?? ""}
            onChange={(event) => patch({ priceMin: toNumber(event.target.value) })}
            aria-label="Prix minimum"
          >
            <option value="">Min</option>
            {PRICE_STEPS.map((step) => (
              <option key={step} value={step}>
                {compactEuro(step)}
              </option>
            ))}
          </Select>
          <span aria-hidden="true" className="text-ink-subtle">
            →
          </span>
          <Select
            value={value.priceMax ?? ""}
            onChange={(event) => patch({ priceMax: toNumber(event.target.value) })}
            aria-label="Prix maximum"
          >
            <option value="">Max</option>
            {PRICE_STEPS.map((step) => (
              <option key={step} value={step}>
                {compactEuro(step)}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label="Surface" htmlFor="filter-area-min" className="min-w-40">
        <div className="flex items-center gap-2">
          <Select
            id="filter-area-min"
            value={value.areaMin ?? ""}
            onChange={(event) => patch({ areaMin: toNumber(event.target.value) })}
            aria-label="Surface minimum"
          >
            <option value="">Min</option>
            {AREA_STEPS.map((step) => (
              <option key={step} value={step}>
                {step} m²
              </option>
            ))}
          </Select>
          <span aria-hidden="true" className="text-ink-subtle">
            →
          </span>
          <Select
            value={value.areaMax ?? ""}
            onChange={(event) => patch({ areaMax: toNumber(event.target.value) })}
            aria-label="Surface maximum"
          >
            <option value="">Max</option>
            {AREA_STEPS.map((step) => (
              <option key={step} value={step}>
                {step} m²
              </option>
            ))}
          </Select>
        </div>
      </Field>
    </>
  );

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop bar */}
      <div
        className={cn(
          "hidden items-end gap-4 rounded-lg border border-border bg-surface px-4 py-3 shadow-xs md:flex",
          density === "dense" && "gap-3 px-3 py-2",
        )}
      >
        {controls}
        <div className="ml-auto flex items-center gap-3 pb-1">
          {resultCount !== undefined ? (
            <span className="tnum whitespace-nowrap text-xs text-ink-muted">
              {resultCount} vente{resultCount > 1 ? "s" : ""}
            </span>
          ) : null}
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X aria-hidden="true" className="size-4" />
              Réinitialiser
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mobile trigger */}
      <div className="flex items-center gap-2 md:hidden">
        <Button variant="secondary" size="md" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filtres
          {activeCount > 0 ? (
            <Badge tone="primary" size="sm">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
        {resultCount !== undefined ? (
          <span className="tnum text-xs text-ink-muted">
            {resultCount} vente{resultCount > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="bottom"
        title="Filtrer les ventes"
        description="Les résultats se mettent à jour immédiatement sur la carte."
        footer={
          <div className="flex w-full gap-2">
            <Button variant="outline" fullWidth onClick={reset}>
              Réinitialiser
            </Button>
            <Button fullWidth onClick={() => setDrawerOpen(false)}>
              Voir {resultCount !== undefined ? `${resultCount} vente${resultCount > 1 ? "s" : ""}` : "les résultats"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">{controls}</div>
      </Drawer>
    </div>
  );
}

function countActive(filters: DvfQueryFilters): number {
  let count = 0;
  if (filters.propertyTypes?.length) count += 1;
  if (filters.yearMin !== undefined || filters.yearMax !== undefined) count += 1;
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) count += 1;
  if (filters.areaMin !== undefined || filters.areaMax !== undefined) count += 1;
  if (filters.pricePerSqmMin !== undefined || filters.pricePerSqmMax !== undefined) count += 1;
  return count;
}

function toNumber(value: string): number | undefined {
  if (value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function compactEuro(value: number): string {
  return value >= 1_000_000
    ? `${value / 1_000_000} M€`
    : `${Math.round(value / 1000)} k€`;
}
