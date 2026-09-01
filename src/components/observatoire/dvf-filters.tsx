"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import type { DvfPropertyType, DvfQueryFilters } from "@/types/dvf";
import { cn } from "@/lib/utils/cn";

/**
 * Pro filter bar over `DvfQueryFilters`.
 *
 * The type list is exactly what DVF's `type_local` can distinguish — including
 * "Local industriel, commercial ou assimilé". We do not split commerce from
 * industry, because the source does not.
 */

export const DVF_TYPE_OPTIONS: { value: DvfPropertyType; label: string; hint?: string }[] = [
  { value: "apartment", label: "Appartements" },
  { value: "house", label: "Maisons" },
  { value: "commercial", label: "Locaux commerciaux / industriels", hint: "type_local « Local industriel, commercial ou assimilé »" },
  { value: "land", label: "Terrains" },
  { value: "dependency", label: "Dépendances" },
];

/** Rows fetched per view. More density = more rows, at the cost of latency. */
export const DENSITY_OPTIONS = [
  { value: 400, label: "Standard" },
  { value: 1200, label: "Dense" },
  { value: 2500, label: "Maximale" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DvfFilters({
  value,
  onChange,
  onReset,
  className,
  compact = false,
}: {
  value: DvfQueryFilters;
  onChange: (next: DvfQueryFilters) => void;
  onReset: () => void;
  className?: string;
  /** Compact drops the price/area block, for narrow side panels. */
  compact?: boolean;
}) {
  const selectedTypes = value.propertyTypes ?? [];

  const toggleType = (type: DvfPropertyType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    // An empty list would mean "nothing"; the API reads absent as "everything".
    onChange({ ...value, propertyTypes: next.length === 0 ? undefined : next });
  };

  const activeCount =
    (value.propertyTypes ? 1 : 0) +
    (value.yearMin || value.yearMax ? 1 : 0) +
    (value.priceMin || value.priceMax ? 1 : 0) +
    (value.areaMin || value.areaMax ? 1 : 0);

  return (
    <section
      aria-label="Filtres des mutations"
      className={cn("rounded-lg border border-border bg-surface p-4", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="size-4 text-ink-subtle" aria-hidden />
          Filtres
          {activeCount > 0 && (
            <Badge tone="accent" size="sm">
              {activeCount}
            </Badge>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          Réinitialiser
        </Button>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Type de local
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DVF_TYPE_OPTIONS.map((option) => {
            const active = selectedTypes.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                title={option.hint}
                onClick={() => toggleType(option.value)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-soft-fg"
                    : "border-border bg-surface-2 text-ink-muted hover:border-border-strong hover:text-ink",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <Field label="Année min." htmlFor="filter-year-min">
          <Select
            id="filter-year-min"
            value={value.yearMin ?? ""}
            onChange={(event) =>
              onChange({ ...value, yearMin: toNumber(event.currentTarget.value) })
            }
          >
            <option value="">Toutes</option>
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Année max." htmlFor="filter-year-max">
          <Select
            id="filter-year-max"
            value={value.yearMax ?? ""}
            onChange={(event) =>
              onChange({ ...value, yearMax: toNumber(event.currentTarget.value) })
            }
          >
            <option value="">Toutes</option>
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Field>

        {!compact && (
          <>
            <Field label="Prix min. (€)" htmlFor="filter-price-min">
              <Input
                id="filter-price-min"
                type="number"
                inputMode="numeric"
                min={0}
                step={10_000}
                placeholder="0"
                value={value.priceMin ?? ""}
                onChange={(event) =>
                  onChange({ ...value, priceMin: toNumber(event.currentTarget.value) })
                }
              />
            </Field>

            <Field label="Prix max. (€)" htmlFor="filter-price-max">
              <Input
                id="filter-price-max"
                type="number"
                inputMode="numeric"
                min={0}
                step={10_000}
                placeholder="–"
                value={value.priceMax ?? ""}
                onChange={(event) =>
                  onChange({ ...value, priceMax: toNumber(event.currentTarget.value) })
                }
              />
            </Field>

            <Field label="Surface min. (m²)" htmlFor="filter-area-min">
              <Input
                id="filter-area-min"
                type="number"
                inputMode="numeric"
                min={0}
                step={5}
                placeholder="0"
                value={value.areaMin ?? ""}
                onChange={(event) =>
                  onChange({ ...value, areaMin: toNumber(event.currentTarget.value) })
                }
              />
            </Field>

            <Field label="Surface max. (m²)" htmlFor="filter-area-max">
              <Input
                id="filter-area-max"
                type="number"
                inputMode="numeric"
                min={0}
                step={5}
                placeholder="–"
                value={value.areaMax ?? ""}
                onChange={(event) =>
                  onChange({ ...value, areaMax: toNumber(event.currentTarget.value) })
                }
              />
            </Field>

            <Field label="€/m² min." htmlFor="filter-sqm-min">
              <Input
                id="filter-sqm-min"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="0"
                value={value.pricePerSqmMin ?? ""}
                onChange={(event) =>
                  onChange({ ...value, pricePerSqmMin: toNumber(event.currentTarget.value) })
                }
              />
            </Field>

            <Field label="€/m² max." htmlFor="filter-sqm-max">
              <Input
                id="filter-sqm-max"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="–"
                value={value.pricePerSqmMax ?? ""}
                onChange={(event) =>
                  onChange({ ...value, pricePerSqmMax: toNumber(event.currentTarget.value) })
                }
              />
            </Field>
          </>
        )}

        <Field label="Densité affichée" htmlFor="filter-density" hint="Nombre de mutations chargées par vue">
          <Select
            id="filter-density"
            value={value.limit ?? DENSITY_OPTIONS[1]?.value ?? 1200}
            onChange={(event) =>
              onChange({ ...value, limit: toNumber(event.currentTarget.value) })
            }
          >
            {DENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} · {option.value} lignes
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </section>
  );
}
