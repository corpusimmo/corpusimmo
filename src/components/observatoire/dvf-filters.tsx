"use client";

import { useId, useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import type { DvfPropertyType, DvfQueryFilters } from "@/types/dvf";
import { cn } from "@/lib/utils/cn";

/**
 * La barre de filtres de l'observatoire, en deux étages.
 *
 * Le premier étage tient sur une ligne et reste toujours visible : le type de
 * local, qui est le filtre qu'on touche à chaque visite. Le second (période,
 * prix, surface, densité) se replie, parce que huit champs numériques ouverts
 * en permanence poussaient la carte sous le pli de l'écran, et une carte qu'on
 * ne voit pas au chargement est une carte qu'on ne consulte pas.
 *
 * Le second étage s'ouvre tout seul quand un de ses critères est actif : un
 * filtre invisible qui retire des ventes serait une source de confusion.
 *
 * La liste des types est exactement ce que le `type_local` de DVF distingue,
 * « Local industriel, commercial ou assimilé » compris. On ne sépare pas le
 * commerce de l'industrie, parce que la source ne le fait pas.
 */

export const DVF_TYPE_OPTIONS: {
  value: DvfPropertyType;
  label: string;
  icon: AssetIconName;
  hint?: string;
}[] = [
  { value: "apartment", label: "Appartements", icon: "apartment" },
  { value: "house", label: "Maisons", icon: "house" },
  {
    value: "commercial",
    label: "Locaux commerciaux / industriels",
    icon: "retail",
    hint: "type_local « Local industriel, commercial ou assimilé »",
  },
  { value: "land", label: "Terrains", icon: "land" },
  { value: "dependency", label: "Dépendances", icon: "parking" },
];

/** Lignes chargées par vue. Plus de densité, c'est plus de lignes, au prix de la latence. */
export const DENSITY_OPTIONS = [
  { value: 400, label: "Standard" },
  { value: 1200, label: "Dense" },
  { value: 2500, label: "Maximale" },
];

const DEFAULT_DENSITY = DENSITY_OPTIONS[1]?.value ?? 1200;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Vrai dès qu'un critère du second étage retire des ventes ou change la densité. */
function hasDetailedCriteria(value: DvfQueryFilters): boolean {
  return (
    value.yearMin !== undefined ||
    value.yearMax !== undefined ||
    value.priceMin !== undefined ||
    value.priceMax !== undefined ||
    value.areaMin !== undefined ||
    value.areaMax !== undefined ||
    value.pricePerSqmMin !== undefined ||
    value.pricePerSqmMax !== undefined ||
    (value.limit !== undefined && value.limit !== DEFAULT_DENSITY)
  );
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
  /** Compact retire le bloc prix et surface, pour les panneaux étroits. */
  compact?: boolean;
}) {
  const panelId = useId();
  const detailed = hasDetailedCriteria(value);
  const [open, setOpen] = useState(detailed);
  // Un critère posé de l'extérieur (une URL, une reprise) rouvre l'étage, mais
  // ne l'empêche pas de se replier ensuite : le compteur du titre continue de
  // dire qu'un filtre agit.
  const [lastDetailed, setLastDetailed] = useState(detailed);
  if (detailed !== lastDetailed) {
    setLastDetailed(detailed);
    if (detailed) setOpen(true);
  }

  const selectedTypes = value.propertyTypes ?? [];

  const toggleType = (type: DvfPropertyType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    // Une liste vide voudrait dire « rien » ; l'API lit l'absence comme « tout ».
    onChange({ ...value, propertyTypes: next.length === 0 ? undefined : next });
  };

  const activeCount =
    (value.propertyTypes ? 1 : 0) +
    (value.yearMin || value.yearMax ? 1 : 0) +
    (value.priceMin || value.priceMax ? 1 : 0) +
    (value.areaMin || value.areaMax ? 1 : 0) +
    (value.pricePerSqmMin || value.pricePerSqmMax ? 1 : 0);

  return (
    <section
      aria-label="Filtres des mutations"
      className={cn("rounded-lg border border-border bg-surface", className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="size-4 text-ink-subtle" aria-hidden />
          Filtres
          {activeCount > 0 && (
            <Badge tone="accent" size="sm">
              {activeCount}
            </Badge>
          )}
        </h2>

        <div role="group" aria-label="Type de local" className="flex flex-wrap gap-2">
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
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-3 text-xs font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-soft-fg"
                    : "border-border bg-surface-2 text-ink-muted hover:border-border-strong hover:text-ink",
                )}
              >
                <AssetTypeIcon name={option.icon} className="size-4" strokeWidth={2.5} />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden />
              Réinitialiser
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Replier les critères" : "Période, prix, surface"}
            <ChevronDown
              aria-hidden
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      {open && (
        <div
          id={panelId}
          className={cn(
            "grid gap-3 border-t border-border-soft px-4 py-4",
            compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
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

          <Field
            label="Densité affichée"
            htmlFor="filter-density"
            hint="Nombre de mutations chargées par vue"
          >
            <Select
              id="filter-density"
              value={value.limit ?? DEFAULT_DENSITY}
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
      )}
    </section>
  );
}
