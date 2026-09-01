/**
 * LE BOGUE QUE CES TESTS VERROUILLENT.
 *
 * Une estimation commencée pour un bien, puis une seconde lancée depuis la
 * barre de recherche de l'accueil pour un AUTRE bien, repartait silencieusement
 * sur la PREMIÈRE adresse : le lien n'écrivait son adresse que si l'état n'en
 * portait aucune. Signalé en production, corrigé ici.
 *
 * La règle désormais : le lien exprime une intention explicite et récente, il
 * ne peut pas être ignoré ; la saisie en cours vaut cinq écrans, elle ne peut
 * pas être écrasée sans un mot. Quand les deux se contredisent, `resolveEntry`
 * remonte un conflit et le parcours pose la question.
 */

import { describe, expect, it } from "vitest";

import {
  ADDRESS_STEP,
  INITIAL_STATE,
  WIZARD_STEPS,
  hasProgress,
  isLastStep,
  nextStep,
  previousStep,
  resolveEntry,
  sameAddress,
  visibleSteps,
  type WizardState,
} from "./wizard-state";
import type { GeoAddress } from "@/types/geo";

function address(id: string, label: string): GeoAddress {
  return {
    id,
    label,
    kind: "housenumber",
    city: "Nantes",
    cityCode: "44109",
    departmentCode: "44",
    coordinates: { lat: 47.218, lng: -1.553 },
    score: 0.95,
  };
}

const PAIX = address("44109_1234_00008", "8 rue de la Paix, 44000 Nantes");
const CREBILLON = address("44109_2222_00012", "12 rue Crébillon, 44000 Nantes");

function link(addr: GeoAddress | null, usage?: string): URLSearchParams {
  const params = new URLSearchParams();
  if (addr) params.set("address", JSON.stringify(addr));
  if (usage) params.set("usage", usage);
  return params;
}

function draft(overrides: Partial<WizardState> = {}): WizardState {
  return { ...INITIAL_STATE, usage: "residential", type: "apartment", step: 3, ...overrides };
}

describe("resolveEntry", () => {
  it("part d'un parcours neuf quand il n'y a rien à reprendre", () => {
    const { state, conflict } = resolveEntry(null, link(PAIX));

    expect(conflict).toBeUndefined();
    expect(state.address).toEqual(PAIX);
    expect(state.addressLocked).toBe(true);
    expect(state.step).toBe(0);
  });

  it("demande quoi faire quand le lien apporte une AUTRE adresse", () => {
    const stored = draft({ address: PAIX, addressLocked: true });
    const { conflict } = resolveEntry(stored, link(CREBILLON));

    expect(conflict).toBeDefined();
    expect(conflict?.draft.address).toEqual(PAIX);
    expect(conflict?.fresh.address).toEqual(CREBILLON);
    // Le parcours neuf ne traîne rien de l'ancien.
    expect(conflict?.fresh.type).toBeNull();
    expect(conflict?.fresh.step).toBe(0);
  });

  it("ne demande rien quand le lien reprend la MÊME adresse", () => {
    const stored = draft({ address: PAIX, addressLocked: true });
    const { state, conflict } = resolveEntry(stored, link(PAIX));

    expect(conflict).toBeUndefined();
    expect(state.step).toBe(3);
    expect(state.type).toBe("apartment");
  });

  it("complète une saisie sans adresse au lieu de la jeter", () => {
    const stored = draft({ address: null, step: 1 });
    const { state, conflict } = resolveEntry(stored, link(PAIX));

    expect(conflict).toBeUndefined();
    expect(state.address).toEqual(PAIX);
    expect(state.addressLocked).toBe(true);
    expect(state.type).toBe("apartment");
  });

  it("ne laisse jamais le parcours sur une étape d'adresse devenue invisible", () => {
    const stored = draft({ address: null, step: ADDRESS_STEP });
    const { state } = resolveEntry(stored, link(PAIX));

    expect(state.addressLocked).toBe(true);
    expect(state.step).not.toBe(ADDRESS_STEP);
  });

  it("ignore un lien mal formé plutôt que de casser le parcours", () => {
    const params = new URLSearchParams();
    params.set("address", "{ceci n'est pas du JSON");
    const { state, conflict } = resolveEntry(null, params);

    expect(conflict).toBeUndefined();
    expect(state.address).toBeNull();
  });

  it("accepte l'usage passé par le lien et avance d'un pas", () => {
    const { state } = resolveEntry(null, link(null, "professional"));

    expect(state.usage).toBe("professional");
    expect(state.step).toBe(1);
  });

  it("refuse un usage inventé", () => {
    const { state } = resolveEntry(null, link(null, "industriel"));
    expect(state.usage).toBeNull();
  });

  it("ne réveille pas un conflit pour une saisie à peine ouverte", () => {
    const untouched = { ...INITIAL_STATE };
    const { conflict } = resolveEntry(untouched, link(CREBILLON));
    expect(conflict).toBeUndefined();
  });
});

describe("les étapes réellement posées", () => {
  it("compte six étapes quand l'adresse reste à demander", () => {
    expect(visibleSteps(INITIAL_STATE)).toHaveLength(WIZARD_STEPS.length);
  });

  it("en compte cinq quand l'adresse est déjà validée", () => {
    const state = { ...INITIAL_STATE, address: PAIX, addressLocked: true };
    const steps = visibleSteps(state);

    expect(steps).toHaveLength(WIZARD_STEPS.length - 1);
    expect(steps).not.toContain(ADDRESS_STEP);
  });

  it("saute l'étape d'adresse en avant comme en arrière", () => {
    const state = { ...INITIAL_STATE, address: PAIX, addressLocked: true, step: ADDRESS_STEP - 1 };
    const forward = nextStep(state);

    expect(forward).toBe(ADDRESS_STEP + 1);
    expect(previousStep({ ...state, step: forward })).toBe(ADDRESS_STEP - 1);
  });

  it("reconnaît la dernière étape dans les deux configurations", () => {
    const last = WIZARD_STEPS.length - 1;
    expect(isLastStep({ ...INITIAL_STATE, step: last })).toBe(true);
    expect(isLastStep({ ...INITIAL_STATE, address: PAIX, addressLocked: true, step: last })).toBe(
      true,
    );
    expect(isLastStep({ ...INITIAL_STATE, step: last - 1 })).toBe(false);
  });
});

describe("garde-fous", () => {
  it("compare les adresses par identifiant, puis par libellé", () => {
    expect(sameAddress(PAIX, { ...PAIX })).toBe(true);
    expect(sameAddress(PAIX, CREBILLON)).toBe(false);
    expect(sameAddress({ ...PAIX, id: "" }, { ...PAIX, id: "" })).toBe(true);
    expect(sameAddress(null, null)).toBe(true);
    expect(sameAddress(PAIX, null)).toBe(false);
  });

  it("ne voit de la progression que là où il y en a", () => {
    expect(hasProgress(null)).toBe(false);
    expect(hasProgress(INITIAL_STATE)).toBe(false);
    expect(hasProgress({ ...INITIAL_STATE, address: PAIX })).toBe(true);
    expect(hasProgress({ ...INITIAL_STATE, usage: "residential" })).toBe(true);
  });
});
