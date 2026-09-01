"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { AddressAutocomplete } from "@/components/map/address-autocomplete";
import { Button } from "@/components/ui";
import { buildEstimatorHref } from "@/components/estimation/wizard-state";
import type { GeoAddress } from "@/types/geo";

/**
 * Le champ d'adresse de l'accueil.
 *
 * Il n'estime rien : il transporte une adresse déjà résolue — code INSEE
 * compris — vers l'estimateur, qui n'aura donc pas à re-géocoder. Le parcours
 * démarre malgré tout à sa première question, l'usage : connaître l'adresse ne
 * dit pas si le bien est un logement ou un local, et choisir à la place de la
 * personne reviendrait à choisir sa méthode d'estimation.
 */
export function HeroAddressSearch() {
  const router = useRouter();
  const [address, setAddress] = useState<GeoAddress | null>(null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        router.push(buildEstimatorHref(address));
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="flex-1">
        <AddressAutocomplete
          value={address}
          onSelect={setAddress}
          size="lg"
          placeholder="12 rue Crébillon, 44000 Nantes"
        />
      </div>
      <Button type="submit" size="lg" className="shrink-0">
        Estimer ce bien
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </form>
  );
}
