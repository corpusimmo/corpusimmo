"use client";

import { Info, MapPin } from "lucide-react";
import { AddressAutocomplete } from "@/components/map/address-autocomplete";
import { LazyDvfMap } from "@/components/map/map-loader";
import { Field } from "@/components/ui";
import type { StepProps } from "../wizard-state";

export function StepAddress({ state, errors, update }: StepProps) {
  const address = state.address;

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Adresse du bien"
        htmlFor="wizard-address"
        required
        hint="Commencez à taper, puis choisissez une proposition. Nous utilisons ce point exact pour chercher les ventes alentour."
        error={errors.address}
      >
        <AddressAutocomplete
          id="wizard-address"
          value={address}
          onSelect={(next) => update({ address: next })}
          size="lg"
          placeholder="12 rue de la Paix, 44000 Nantes"
        />
      </Field>

      {address ? (
        <div className="animate-fade-up flex flex-col gap-3">
          <div
            className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-4 py-3"
          >
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{address.label}</p>
              <p className="text-xs text-ink-muted">
                Commune de {address.city}, code INSEE {address.cityCode}
              </p>
            </div>
          </div>

          {/* `transactions={[]}` keeps this map purely confirmatory: no DVF
              request is fired just to show the user their own pin. */}
          <div className="overflow-hidden rounded-lg border border-border">
            <LazyDvfMap
              className="h-56 w-full sm:h-64"
              initialCenter={address.coordinates}
              initialZoom={15}
              transactions={[]}
              subject={{ point: address.coordinates, label: address.label, radius: 500 }}
            />
          </div>
          <p
            className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted"
          >
            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            Le repère doit se trouver sur votre bien. Si ce n’est pas le cas, affinez l’adresse
            ci-dessus : la précision du point change les ventes retenues.
          </p>
        </div>
      ) : (
        <p
          className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm text-ink-muted"
        >
          Sélectionnez une adresse pour afficher son emplacement sur la carte.
        </p>
      )}
    </div>
  );
}
