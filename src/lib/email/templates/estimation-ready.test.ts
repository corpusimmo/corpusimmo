import { describe, expect, it } from "vitest";

import { disclaimers } from "@/config/site";
import type { ValuationResult } from "@/types/valuation";

import { maskEmail } from "../types";
import { renderEstimationReadyEmail } from "./estimation-ready";

function makeValuation(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    id: "val-1",
    method: "comparison",
    status: "computed",
    createdAt: "2026-06-01T09:30:00.000Z",
    subject: {
      type: "apartment",
      address: {
        id: "44109_1234_00008",
        label: "8 Rue de la Paix, 44000 Nantes",
        kind: "housenumber",
        city: "Nantes",
        cityCode: "44109",
        departmentCode: "44",
        coordinates: { lat: 47.2184, lng: -1.5536 },
        score: 0.97,
      },
      features: { livingArea: 72 },
    },
    value: { low: 298_000, central: 331_000, high: 364_000 },
    pricePerSqm: 4598,
    confidence: { score: 74, level: "moderate", factors: [] },
    comparables: [],
    diagnostics: { radiusUsed: 800, candidatesFound: 143, rejected: [], retained: 12 },
    ...overrides,
  };
}

describe("e-mail « estimation prête »", () => {
  it("contient la fourchette, le lien et le disclaimer long", () => {
    const mail = renderEstimationReadyEmail({
      valuation: makeValuation(),
      firstName: "Mathieu",
      estimationUrl: "https://corpusimmo.test/estimation/val-1",
      pdfUrl: "https://corpusimmo.test/api/estimation/val-1/pdf",
    });

    expect(mail.subject).toContain("Votre estimation");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("Mathieu");
      expect(body).toContain("https://corpusimmo.test/estimation/val-1");
      expect(body).toContain(disclaimers.long);
    }
    expect(mail.html).toContain("https://corpusimmo.test/api/estimation/val-1/pdf");
    expect(mail.html).toContain("<!doctype html>");
    // Le texte brut doit se suffire à lui-même : ni balise, ni entité.
    expect(mail.text).not.toMatch(/<[a-z]/i);
  });

  it("reste lisible quand le moteur n'a pas conclu", () => {
    const mail = renderEstimationReadyEmail({
      valuation: makeValuation({ value: undefined, pricePerSqm: undefined }),
      firstName: "Mathieu",
      estimationUrl: "https://corpusimmo.test/estimation/val-1",
    });
    expect(mail.subject).toContain("disponible");
    expect(mail.text).toContain("non concluante");
    expect(mail.html).not.toContain("undefined");
  });

  it("échappe le HTML issu des données", () => {
    const mail = renderEstimationReadyEmail({
      valuation: makeValuation(),
      firstName: '<script>alert("x")</script>',
      estimationUrl: "https://corpusimmo.test/estimation/val-1",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("maskEmail", () => {
  it("ne laisse jamais l'adresse complète", () => {
    expect(maskEmail("mathieu@example.fr")).toBe("m***u@example.fr");
    expect(maskEmail("ab@example.fr")).toBe("a***@example.fr");
    expect(maskEmail("pas-une-adresse")).toBe("***");
  });
});
