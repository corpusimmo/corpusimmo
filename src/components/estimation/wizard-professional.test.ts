import { describe, expect, it } from "vitest";

import { INITIAL_STATE, validateStep, type WizardState } from "./wizard-state";

/**
 * Le parcours tertiaire, verrouillé.
 *
 * Ce qu'on protège ici est un bug vécu en production : la validation exigeait
 * une occupation que l'écran n'affichait pas. La personne voyait « Indiquez si
 * le bien est occupé ou libre » sans aucun champ pour répondre, et le parcours
 * s'arrêtait là, définitivement.
 *
 * La règle qui ne doit plus jamais se rompre : **toute erreur produite par
 * `validateStep` doit correspondre à un champ que l'étape affiche.**
 */

const FEATURES_STEP = 3;

function pro(type: WizardState["type"], features: Partial<WizardState["features"]> = {}): WizardState {
  return {
    ...INITIAL_STATE,
    step: FEATURES_STEP,
    usage: "professional",
    type,
    features: { ...INITIAL_STATE.features, ...features },
  };
}

describe("étape « caractéristiques », branche professionnelle", () => {
  for (const type of ["office", "retail", "business_premises"] as const) {
    it(`réclame l'occupation pour « ${type} », que l'écran affiche`, () => {
      const errors = validateStep(FEATURES_STEP, pro(type, { livingArea: "240" }));
      expect(errors.occupancy).toBeDefined();
    });

    it(`accepte « ${type} » libre, sans loyer`, () => {
      const errors = validateStep(
        FEATURES_STEP,
        pro(type, { livingArea: "240", occupancy: "vacant" }),
      );
      expect(errors).toEqual({});
    });

    it(`réclame le loyer pour « ${type} » déclaré occupé`, () => {
      const occupe = validateStep(
        FEATURES_STEP,
        pro(type, { livingArea: "240", occupancy: "occupied" }),
      );
      expect(occupe.annualRent).toBeDefined();

      const renseigne = validateStep(
        FEATURES_STEP,
        pro(type, { livingArea: "240", occupancy: "occupied", annualRent: "48000" }),
      );
      expect(renseigne).toEqual({});
    });
  }

  it("ne réclame JAMAIS d'occupation pour un terrain professionnel", () => {
    // Un foncier n'a pas de locataire. C'est le cas qui bloquait le parcours :
    // l'écran « terrain » n'a pas de question d'occupation, et n'en aura pas.
    const errors = validateStep(FEATURES_STEP, pro("land", { landArea: "1200" }));
    expect(errors.occupancy).toBeUndefined();
    expect(errors).toEqual({});
  });

  it("ne réclame pas de surface utile à un terrain professionnel", () => {
    const errors = validateStep(FEATURES_STEP, pro("land", { landArea: "1200" }));
    expect(errors.livingArea).toBeUndefined();
  });
});
