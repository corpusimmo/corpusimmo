import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ValuationResult } from "@/types/valuation";

import { POST } from "./route";

function jsonRequest(body: unknown, ip = "203.0.113.10"): Request {
  return new Request("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function makeValuation(): ValuationResult {
  return {
    id: "val-lead-1",
    method: "comparison",
    status: "computed",
    createdAt: new Date().toISOString(),
    subject: {
      type: "house",
      address: {
        id: "44109_1234_00008",
        label: "8 Rue de la Paix, 44000 Nantes",
        kind: "housenumber",
        postcode: "44000",
        city: "Nantes",
        cityCode: "44109",
        departmentCode: "44",
        coordinates: { lat: 47.2184, lng: -1.5536 },
        score: 0.97,
      },
      features: { livingArea: 118, rooms: 5, condition: "good" },
    },
    intent: "selling_under_3m",
    value: { low: 520_000, central: 570_000, high: 620_000 },
    confidence: { score: 78, level: "high", factors: [] },
    comparables: [],
    diagnostics: { radiusUsed: 800, candidatesFound: 90, rejected: [], retained: 14 },
  };
}

const validBody = {
  contact: {
    firstName: "Mathieu",
    lastName: "Guicheteau",
    email: "Mathieu@Example.FR",
    phone: "06 12 34 56 78",
  },
  consents: { estimationDelivery: true, professionalContact: true },
  valuation: makeValuation(),
};

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("refuse une demande sans consentement à la livraison de l'estimation", async () => {
    const response = await POST(
      jsonRequest({ ...validBody, consents: { estimationDelivery: false } }, "203.0.113.1"),
    );
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("validation_failed");
  });

  it("refuse une adresse e-mail invalide", async () => {
    const response = await POST(
      jsonRequest(
        { ...validBody, contact: { ...validBody.contact, email: "pas-une-adresse" } },
        "203.0.113.2",
      ),
    );
    expect(response.status).toBe(400);
  });

  it("n'active JAMAIS le contact professionnel par défaut", async () => {
    const response = await POST(
      jsonRequest(
        {
          contact: { firstName: "Mathieu", email: "mathieu@example.fr" },
          consents: { estimationDelivery: true },
          valuation: makeValuation(),
        },
        "203.0.113.3",
      ),
    );
    expect(response.status).toBe(202);

    const payload = await response.json();
    const labels: string[] = payload.lead.breakdown.map(
      (item: { label: string }) => item.label,
    );
    expect(labels).toContain("Refuse le contact professionnel");
  });

  it("honore un consentement professionnel explicitement accordé et l'horodate", async () => {
    const response = await POST(jsonRequest(validBody, "203.0.113.4"));
    expect(response.status).toBe(202);

    const payload = await response.json();
    expect(Number.isNaN(Date.parse(payload.lead.collectedAt))).toBe(false);
    expect(payload.lead.temperature).toBe("hot");

    const labels: string[] = payload.lead.breakdown.map(
      (item: { label: string }) => item.label,
    );
    expect(labels).toContain("Accepte d'être contacté par un professionnel");
  });

  it("ne journalise jamais l'e-mail en clair", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(jsonRequest(validBody, "203.0.113.5"));

    const logged = info.mock.calls.flat().join(" ");
    expect(logged).not.toContain("mathieu@example.fr");
    expect(logged).toContain("m***u@example.fr");
  });

  it("accepte un lead sans estimation jointe, sans envoyer d'e-mail", async () => {
    const response = await POST(
      jsonRequest(
        {
          contact: { firstName: "Mathieu", email: "mathieu@example.fr" },
          consents: { estimationDelivery: true },
          propertyType: "apartment",
          city: "Nantes",
          cityCode: "44109",
          intent: "selling_under_6m",
        },
        "203.0.113.7",
      ),
    );
    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.email.delivered).toBe(false);
  });

  it("annonce honnêtement qu'aucune donnée n'est conservée", async () => {
    const response = await POST(jsonRequest(validBody, "203.0.113.8"));
    const payload = await response.json();
    expect(payload.persistence).toBe("none");
  });

  it("limite le débit par adresse IP", async () => {
    const responses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const response = await POST(
        jsonRequest(
          {
            contact: { firstName: "Mathieu", email: "mathieu@example.fr" },
            consents: { estimationDelivery: true },
            propertyType: "apartment",
            city: "Nantes",
            cityCode: "44109",
          },
          "203.0.113.99",
        ),
      );
      responses.push(response.status);
    }
    expect(responses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
