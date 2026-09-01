import { describe, expect, it } from "vitest";

import type { ProjectIntent } from "@/types/property";

import {
  INTENT_SCORE_ORDER,
  LEAD_SCORE_MAX_POINTS,
  leadTemperature,
  scoreLead,
  type LeadScoreInput,
} from "./score";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function baseInput(overrides: Partial<LeadScoreInput> = {}): LeadScoreInput {
  return {
    intent: "selling_considering",
    consents: { estimationDelivery: true, professionalContact: false },
    contact: {},
    features: {},
    createdAt: NOW.toISOString(),
    now: NOW,
    ...overrides,
  };
}

describe("scoreLead — bornes", () => {
  it("reste dans [0, 100] pour le pire et le meilleur cas", () => {
    const worst = scoreLead(
      baseInput({
        intent: "curiosity",
        consents: { estimationDelivery: true, professionalContact: false },
        createdAt: "2020-01-01T00:00:00.000Z",
      }),
    );
    expect(worst.score).toBe(0);

    const best = scoreLead(
      baseInput({
        intent: "selling_under_3m",
        consents: { estimationDelivery: true, professionalContact: true, marketing: true },
        contact: { phone: "06 12 34 56 78", lastName: "Dupont" },
        features: { livingArea: 78, rooms: 3, condition: "good" },
        verifiedValue: 1_450_000,
      }),
    );
    expect(best.score).toBe(100);
  });

  it("ne descend jamais sous 0 ni au-dessus de 100 sur un balayage complet", () => {
    for (const intent of INTENT_SCORE_ORDER) {
      for (const professionalContact of [true, false]) {
        for (const value of [undefined, 0, 50_000, 400_000, 9_000_000]) {
          const { score } = scoreLead(
            baseInput({
              intent,
              consents: { estimationDelivery: true, professionalContact },
              verifiedValue: value,
            }),
          );
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isInteger(score)).toBe(true);
        }
      }
    }
  });
});

describe("scoreLead — monotonie sur l'intention", () => {
  it("croît strictement de la curiosité à la vente sous 3 mois", () => {
    const scores = INTENT_SCORE_ORDER.map((intent) => scoreLead(baseInput({ intent })).score);
    for (let i = 1; i < scores.length; i += 1) {
      const previous = scores[i - 1];
      const current = scores[i];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(current as number).toBeGreaterThan(previous as number);
    }
  });

  it("une vente sous 3 mois vaut nettement plus qu'une simple curiosité", () => {
    const hot = scoreLead(baseInput({ intent: "selling_under_3m" })).score;
    const cold = scoreLead(baseInput({ intent: "curiosity" })).score;
    expect(hot - cold).toBe(LEAD_SCORE_MAX_POINTS.intent);
  });

  it("toutes les intentions du contrat sont couvertes", () => {
    const all: ProjectIntent[] = [
      "curiosity",
      "buying",
      "selling_considering",
      "selling_under_3m",
      "selling_under_6m",
      "inheritance",
      "investment",
      "other",
    ];
    expect([...INTENT_SCORE_ORDER].sort()).toEqual([...all].sort());
  });
});

describe("scoreLead — consentement", () => {
  it("le consentement au contact professionnel ajoute exactement sa bande", () => {
    const without = scoreLead(baseInput()).score;
    const withConsent = scoreLead(
      baseInput({ consents: { estimationDelivery: true, professionalContact: true } }),
    ).score;
    expect(withConsent - without).toBe(LEAD_SCORE_MAX_POINTS.professionalContact);
  });

  it("le refus du contact professionnel coûte un quart du score maximal", () => {
    const best = scoreLead(
      baseInput({
        intent: "selling_under_3m",
        consents: { estimationDelivery: true, professionalContact: false },
        contact: { phone: "0612345678", lastName: "Dupont" },
        features: { livingArea: 78, rooms: 3, condition: "good" },
        verifiedValue: 2_000_000,
      }),
    );
    expect(best.score).toBe(75);
    // 75 reste « chaud » : c'est volontaire, la bande consentement ne doit pas
    // écraser un signal d'intention maximal — mais l'écart reste net.
    expect(leadTemperature(best.score)).toBe("hot");
    const withConsent = scoreLead(
      baseInput({
        intent: "selling_under_3m",
        consents: { estimationDelivery: true, professionalContact: true },
        contact: { phone: "0612345678", lastName: "Dupont" },
        features: { livingArea: 78, rooms: 3, condition: "good" },
        verifiedValue: 2_000_000,
      }),
    );
    expect(withConsent.score).toBe(100);
  });

  it("le consentement marketing n'influence pas le score", () => {
    const a = scoreLead(
      baseInput({ consents: { estimationDelivery: true, professionalContact: true } }),
    ).score;
    const b = scoreLead(
      baseInput({
        consents: { estimationDelivery: true, professionalContact: true, marketing: true },
      }),
    ).score;
    expect(a).toBe(b);
  });
});

describe("scoreLead — complétude, valeur, fraîcheur", () => {
  it("un téléphone exploitable ajoute des points, un numéro tronqué non", () => {
    const none = scoreLead(baseInput()).score;
    const short = scoreLead(baseInput({ contact: { phone: "06 12" } })).score;
    const full = scoreLead(baseInput({ contact: { phone: "+33 6 12 34 56 78" } })).score;
    expect(short).toBe(none);
    expect(full).toBeGreaterThan(none);
  });

  it("la valeur estimée est monotone par paliers", () => {
    const values = [undefined, 100_000, 200_000, 400_000, 700_000, 1_200_000];
    const scores = values.map((v) => scoreLead(baseInput({ verifiedValue: v })).score);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i] as number).toBeGreaterThanOrEqual(scores[i - 1] as number);
    }
  });

  it("un lead vieux de six mois perd toute sa bande de fraîcheur", () => {
    const fresh = scoreLead(baseInput()).score;
    const stale = scoreLead(baseInput({ createdAt: "2025-12-01T12:00:00.000Z" })).score;
    expect(fresh - stale).toBe(LEAD_SCORE_MAX_POINTS.freshness);
  });
});

describe("scoreLead — breakdown", () => {
  it("expose cinq lignes lisibles dont la somme vaut le score", () => {
    const result = scoreLead(
      baseInput({
        intent: "selling_under_6m",
        consents: { estimationDelivery: true, professionalContact: true },
        contact: { phone: "0612345678" },
        verifiedValue: 420_000,
      }),
    );
    expect(result.breakdown).toHaveLength(5);
    for (const item of result.breakdown) {
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.points).toBeGreaterThanOrEqual(0);
    }
    const sum = result.breakdown.reduce((total, item) => total + item.points, 0);
    expect(sum).toBe(result.score);
  });
});

describe("leadTemperature", () => {
  it("classe les scores en trois bandes", () => {
    expect(leadTemperature(10)).toBe("cold");
    expect(leadTemperature(44)).toBe("cold");
    expect(leadTemperature(45)).toBe("warm");
    expect(leadTemperature(69)).toBe("warm");
    expect(leadTemperature(70)).toBe("hot");
    expect(leadTemperature(100)).toBe("hot");
  });
});
