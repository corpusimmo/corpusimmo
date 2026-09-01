"use client";

import { AlertTriangle } from "lucide-react";
import { AddressAutocomplete } from "@/components/map/address-autocomplete";
import { Card, CardContent, CardHeader, CardTitle, Field, Input, Select } from "@/components/ui";
import { PROPERTY_CONDITION_LABELS, PROPERTY_TYPE_LABELS } from "@/types/property";
import type { PropertyCondition, PropertyType } from "@/types/property";
import type { useSubjectDraft } from "./subject-store";

/**
 * The property under study. Shared by the valuation entry screen and the
 * comparison workbench so a pro never types the same building twice.
 */

const SUBJECT_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "building",
  "land",
  "retail",
  "office",
  "business_premises",
];

const CONDITIONS: PropertyCondition[] = [
  "to_renovate",
  "refresh_needed",
  "good",
  "very_good",
  "new",
];

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function SubjectPanel({
  subject,
  setSubject,
  setFeatures,
  title = "Bien étudié",
  description,
  idPrefix = "subject",
}: {
  subject: ReturnType<typeof useSubjectDraft>["subject"];
  setSubject: ReturnType<typeof useSubjectDraft>["setSubject"];
  setFeatures: ReturnType<typeof useSubjectDraft>["setFeatures"];
  title?: string;
  description?: string;
  idPrefix?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-sm text-ink-muted">
          {description ??
            "Toute modification relance le calcul. L'adresse est nécessaire : elle fixe le point depuis lequel les distances aux comparables sont mesurées."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label
            htmlFor={`${idPrefix}-address`}
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Adresse
          </label>
          <AddressAutocomplete
            id={`${idPrefix}-address`}
            value={subject.address}
            onSelect={(address) => setSubject({ address })}
            placeholder="12 rue Crébillon, 44000 Nantes"
            size="md"
          />
          {!subject.address && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning-soft-fg">
              <AlertTriangle className="size-3.5" aria-hidden />
              Renseignez l&apos;adresse du bien pour lancer la valorisation.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type de bien" htmlFor={`${idPrefix}-type`}>
            <Select
              id={`${idPrefix}-type`}
              value={subject.type}
              onChange={(event) => setSubject({ type: event.currentTarget.value as PropertyType })}
            >
              {SUBJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROPERTY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Surface habitable (m²)" htmlFor={`${idPrefix}-area`}>
            <Input
              id={`${idPrefix}-area`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={subject.features.livingArea ?? ""}
              onChange={(event) =>
                setFeatures({ livingArea: toNumber(event.currentTarget.value) })
              }
            />
          </Field>

          <Field label="Pièces" htmlFor={`${idPrefix}-rooms`}>
            <Input
              id={`${idPrefix}-rooms`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={subject.features.rooms ?? ""}
              onChange={(event) => setFeatures({ rooms: toNumber(event.currentTarget.value) })}
            />
          </Field>

          <Field label="Étage" htmlFor={`${idPrefix}-floor`}>
            <Input
              id={`${idPrefix}-floor`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={subject.features.floor ?? ""}
              onChange={(event) => setFeatures({ floor: toNumber(event.currentTarget.value) })}
            />
          </Field>

          <Field label="Année de construction" htmlFor={`${idPrefix}-year`}>
            <Input
              id={`${idPrefix}-year`}
              type="number"
              inputMode="numeric"
              min={1700}
              max={new Date().getFullYear()}
              step={1}
              value={subject.features.constructionYear ?? ""}
              onChange={(event) =>
                setFeatures({ constructionYear: toNumber(event.currentTarget.value) })
              }
            />
          </Field>

          <Field label="État" htmlFor={`${idPrefix}-condition`}>
            <Select
              id={`${idPrefix}-condition`}
              value={subject.features.condition ?? ""}
              onChange={(event) =>
                setFeatures({
                  condition:
                    event.currentTarget.value === ""
                      ? undefined
                      : (event.currentTarget.value as PropertyCondition),
                })
              }
            >
              <option value="">Non renseigné</option>
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {PROPERTY_CONDITION_LABELS[condition]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
