"use client";

import type { ReactNode } from "react";
import { ChoiceCard, ChoiceGroup, Field, Input, Select, Toggle } from "@/components/ui";
import {
  PROPERTY_CONDITION_LABELS,
  PROPERTY_TYPE_LABELS,
  type OutdoorFeature,
  type PropertyCondition,
  type PropertyType,
} from "@/types/property";
import {
  OTHER_PROPERTY_TYPES,
  type BuildableAnswer,
  type StepProps,
  type WizardFeatures,
} from "../wizard-state";

const OUTDOOR_LABELS: Record<OutdoorFeature, string> = {
  none: "Aucun",
  balcony: "Balcon",
  terrace: "Terrasse",
  garden: "Jardin",
};

const BUILDABLE: { id: BuildableAnswer; title: string; description: string }[] = [
  { id: "yes", title: "Oui", description: "Le terrain est constructible." },
  { id: "no", title: "Non", description: "Terrain non constructible à ma connaissance." },
  {
    id: "unknown",
    title: "Je ne sais pas",
    description: "Réponse parfaitement valable : nous n’inventerons rien.",
  },
];

function NumberField({
  id,
  label,
  unit,
  hint,
  error,
  required,
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder,
}: {
  id: string;
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          placeholder={placeholder}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
          className={unit ? "pr-14" : undefined}
        />
        {unit ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-subtle"
          >
            {unit}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-sm font-semibold text-ink">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function StepFeatures({ state, errors, update, updateFeatures }: StepProps) {
  const f = state.features;
  const set = (patch: Partial<WizardFeatures>) => updateFeatures(patch);

  const conditionField = (
    <Field label="État général" htmlFor="feat-condition" hint="Tel que vous le décririez à un visiteur.">
      <Select
        id="feat-condition"
        value={f.condition}
        onChange={(event) => set({ condition: event.target.value as PropertyCondition | "" })}
      >
        <option value="">Non précisé</option>
        {(Object.keys(PROPERTY_CONDITION_LABELS) as PropertyCondition[]).map((key) => (
          <option key={key} value={key}>
            {PROPERTY_CONDITION_LABELS[key]}
          </option>
        ))}
      </Select>
    </Field>
  );

  const outdoorField = (
    <Field label="Extérieur" htmlFor="feat-outdoor">
      <Select
        id="feat-outdoor"
        value={f.outdoor}
        onChange={(event) => set({ outdoor: event.target.value as OutdoorFeature | "" })}
      >
        <option value="">Non précisé</option>
        {(Object.keys(OUTDOOR_LABELS) as OutdoorFeature[]).map((key) => (
          <option key={key} value={key}>
            {OUTDOOR_LABELS[key]}
          </option>
        ))}
      </Select>
    </Field>
  );

  if (state.type === "apartment") {
    return (
      <div className="flex flex-col gap-8">
        <Group title="Surfaces et distribution">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="feat-living-area"
              label="Surface habitable"
              unit="m²"
              required
              placeholder="72"
              value={f.livingArea}
              onChange={(value) => set({ livingArea: value })}
              error={errors.livingArea}
              hint="Surface loi Carrez si vous l’avez sous la main."
            />
            <NumberField
              id="feat-rooms"
              label="Pièces principales"
              required
              placeholder="3"
              value={f.rooms}
              onChange={(value) => set({ rooms: value })}
              error={errors.rooms}
              hint="Hors cuisine, salle de bains et dégagements."
            />
            <NumberField
              id="feat-bedrooms"
              label="Chambres"
              placeholder="2"
              value={f.bedrooms}
              onChange={(value) => set({ bedrooms: value })}
              error={errors.bedrooms}
            />
            <NumberField
              id="feat-floor"
              label="Étage"
              placeholder="3"
              value={f.floor}
              onChange={(value) => set({ floor: value })}
              hint="0 pour un rez-de-chaussée."
            />
          </div>
        </Group>

        <Group title="Équipements">
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={f.hasElevator}
              onChange={(value) => set({ hasElevator: value })}
              label="Ascenseur"
              description="Dans l’immeuble."
            />
            <Toggle
              checked={f.hasParking}
              onChange={(value) => set({ hasParking: value })}
              label="Stationnement"
              description="Place, box ou garage vendu avec le bien."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {outdoorField}
            {conditionField}
          </div>
        </Group>
      </div>
    );
  }

  if (state.type === "house") {
    return (
      <div className="flex flex-col gap-8">
        <Group title="Surfaces et distribution">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="feat-living-area"
              label="Surface habitable"
              unit="m²"
              required
              placeholder="118"
              value={f.livingArea}
              onChange={(value) => set({ livingArea: value })}
              error={errors.livingArea}
            />
            <NumberField
              id="feat-land-area"
              label="Surface du terrain"
              unit="m²"
              placeholder="450"
              value={f.landArea}
              onChange={(value) => set({ landArea: value })}
              error={errors.landArea}
              hint="Laissez vide si vous ne la connaissez pas."
            />
            <NumberField
              id="feat-rooms"
              label="Pièces principales"
              required
              placeholder="5"
              value={f.rooms}
              onChange={(value) => set({ rooms: value })}
              error={errors.rooms}
            />
            <NumberField
              id="feat-bedrooms"
              label="Chambres"
              placeholder="3"
              value={f.bedrooms}
              onChange={(value) => set({ bedrooms: value })}
              error={errors.bedrooms}
            />
          </div>
        </Group>

        <Group title="Équipements">
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={f.hasGarage}
              onChange={(value) => set({ hasGarage: value })}
              label="Garage"
              description="Fermé, attenant ou indépendant."
            />
            <Toggle
              checked={f.hasParking}
              onChange={(value) => set({ hasParking: value })}
              label="Stationnement extérieur"
              description="Place privative, cour, allée."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {outdoorField}
            {conditionField}
          </div>
        </Group>
      </div>
    );
  }

  if (state.type === "land") {
    return (
      <div className="flex flex-col gap-8">
        <Group title="Le terrain">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="feat-land-area"
              label="Surface du terrain"
              unit="m²"
              required
              placeholder="620"
              value={f.landArea}
              onChange={(value) => set({ landArea: value })}
              error={errors.landArea}
              hint="Telle qu’indiquée sur votre acte ou au cadastre."
            />
          </div>
        </Group>

        <Group title="Constructibilité">
          <div>
            <ChoiceGroup label="Le terrain est-il constructible ?" columns={3}>
              {BUILDABLE.map((option) => (
                <ChoiceCard
                  key={option.id}
                  selected={f.buildable === option.id}
                  title={option.title}
                  description={option.description}
                  onSelect={() => set({ buildable: option.id })}
                />
              ))}
            </ChoiceGroup>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            La constructibilité dépend du plan local d’urbanisme de votre commune. Si vous
            l’ignorez, laissez « je ne sais pas » : nous ne le devinerons pas à votre place.
          </p>
        </Group>
      </div>
    );
  }

  // "Autre" — we ask for the precise nature rather than guessing a category.
  return (
    <div className="flex flex-col gap-8">
      <Group title="Nature du bien">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Type précis"
            htmlFor="feat-other-type"
            required
            error={errors.otherType}
            hint="Nous adapterons les ventes comparables à cette catégorie."
          >
            <Select
              id="feat-other-type"
              value={state.otherType ?? ""}
              invalid={Boolean(errors.otherType)}
              onChange={(event) =>
                update({ otherType: (event.target.value || null) as PropertyType | null })
              }
            >
              <option value="">Choisissez…</option>
              {OTHER_PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROPERTY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <NumberField
            id="feat-living-area"
            label="Surface"
            unit="m²"
            required
            placeholder="240"
            value={f.livingArea}
            onChange={(value) => set({ livingArea: value })}
            error={errors.livingArea}
          />
        </div>
      </Group>

      <Group title="État">
        <div className="grid gap-4 sm:grid-cols-2">
          {conditionField}
        </div>
        <p className="text-xs leading-relaxed text-ink-muted">
          Les biens atypiques comptent peu de ventes comparables dans DVF. L’estimation sera
          d’autant plus large — et pourra ne pas aboutir. Nous vous le dirons franchement.
        </p>
      </Group>
    </div>
  );
}
