import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ValuationResult } from "@/types/valuation";

import { POST } from "./route";

/**
 * CE FICHIER DÉCRIT LA ROUTE AVEC UNE BASE. Le comportement sans base est dans
 * `route.test.ts`, et il reste le contrat d'un dépôt au `.env` vide.
 *
 * `@/lib/db` et `@/lib/auth/current-user` sont simulés : ils importent
 * `server-only`, qui refuse de se charger sous Vitest, et surtout aucun test ne
 * doit écrire dans la vraie base de développement.
 */
const db = vi.hoisted(() => ({
  recordConsents: vi.fn(),
  recordLead: vi.fn(),
  listEstimations: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUserId: vi.fn() }));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth/current-user", () => session);

const FAKE_URL = "postgresql://exemple:motdepasse@localhost:5432/corpusimmo";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const ESTIMATION_ROW_ID = "55555555-5555-4555-8555-555555555555";
const LEAD_ID = "66666666-6666-4666-8666-666666666666";

/** L'heure de Postgres. Elle n'a rien à voir avec celle que le client enverra. */
const DB_DATE = new Date("2026-03-04T10:11:12.000Z");
/** L'heure que le client prétend, et qui ne doit jamais ressortir nulle part. */
const CLIENT_DATE = "1999-01-01T00:00:00.000Z";

function jsonRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function makeValuation(): ValuationResult {
  return {
    id: "val-persistance-1",
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
    // Une villa à deux millions déclarée dans le corps de la requête : c'est
    // exactement ce que le score ne doit pas croire.
    value: { low: 1_900_000, central: 2_000_000, high: 2_100_000 },
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
  consents: { estimationDelivery: true, professionalContact: false },
  // Un horodatage posé par le client, à l'endroit où il serait le plus tentant
  // de le lire.
  collectedAt: CLIENT_DATE,
  valuation: makeValuation(),
};

function consentRow(purpose: string, granted: boolean) {
  return {
    id: `id-${purpose}`,
    purpose,
    granted,
    collectedAt: DB_DATE,
    source: "estimation",
    version: 1,
    email: "mathieu@example.fr",
    userId: USER_ID,
  };
}

/** Les décisions telles qu'elles sont parties vers le registre. */
function writtenDecisions(): { purpose: string; granted: boolean; source: string }[] {
  const [rows] = db.recordConsents.mock.calls[0] as [
    { purpose: string; granted: boolean; source: string }[],
  ];
  return rows;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", FAKE_URL);

  session.currentUserId.mockResolvedValue(USER_ID);
  db.listEstimations.mockResolvedValue([]);
  db.recordConsents.mockResolvedValue({
    stored: true,
    value: [
      consentRow("estimation_delivery", true),
      consentRow("professional_contact", false),
      consentRow("marketing", false),
    ],
  });
  db.recordLead.mockResolvedValue({
    stored: true,
    value: {
      leadId: LEAD_ID,
      contactId: "77777777-7777-4777-8777-777777777777",
      createdAt: DB_DATE,
      status: "new",
      score: 0,
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/leads, avec une base", () => {
  it("répond 201 seulement parce que la demande existe vraiment", async () => {
    const response = await POST(jsonRequest(validBody, "198.51.100.1"));
    expect(response.status).toBe(201);

    const payload = await response.json();
    expect(payload.persistence).toBe("stored");
    expect(payload.lead.id).toBe(LEAD_ID);
    expect(payload.consents).toEqual({ recorded: true, count: 3 });
  });

  it("enregistre les trois décisions, refus compris", async () => {
    await POST(jsonRequest(validBody, "198.51.100.2"));

    expect(writtenDecisions()).toEqual([
      expect.objectContaining({ purpose: "estimation_delivery", granted: true }),
      expect.objectContaining({ purpose: "professional_contact", granted: false }),
      expect.objectContaining({ purpose: "marketing", granted: false }),
    ]);
    for (const decision of writtenDecisions()) {
      expect(decision.source).toBe("estimation");
    }
  });

  it("horodate côté serveur et ignore la date envoyée par le client", async () => {
    const response = await POST(jsonRequest(validBody, "198.51.100.3"));
    const payload = await response.json();

    expect(payload.lead.collectedAt).toBe(DB_DATE.toISOString());
    expect(payload.lead.collectedAt).not.toBe(CLIENT_DATE);

    // Et rien de ce qui part vers le registre ne porte de date.
    const serialised = JSON.stringify(db.recordConsents.mock.calls[0]);
    expect(serialised).not.toContain("1999");
    expect(serialised).not.toContain("collectedAt");
  });

  it("ne compte pas la valeur déclarée dans le corps de la requête", async () => {
    // Rien en base : la villa à deux millions du corps ne vaut aucun point.
    db.listEstimations.mockResolvedValue([]);

    const response = await POST(jsonRequest(validBody, "198.51.100.4"));
    const payload = await response.json();

    const band = payload.lead.breakdown.find(
      (item: { label: string }) => item.label === "Valeur estimée du bien",
    );
    expect(band.points).toBe(0);

    // La fiche du prospect ne recopie pas davantage la fourchette déclarée.
    const [lead] = db.recordLead.mock.calls[0] as [Record<string, unknown>];
    expect(lead.estimatedLow).toBeUndefined();
    expect(lead.estimatedHigh).toBeUndefined();
    expect(lead.estimationId).toBeNull();
  });

  it("compte la valeur quand elle est relue en base, et sur la valeur de la base", async () => {
    db.listEstimations.mockResolvedValue([
      {
        id: ESTIMATION_ROW_ID,
        engineId: "val-persistance-1",
        value: { low: 520_000, central: 570_000, high: 620_000 },
      },
    ]);

    const response = await POST(jsonRequest(validBody, "198.51.100.5"));
    const payload = await response.json();

    const band = payload.lead.breakdown.find(
      (item: { label: string }) => item.label === "Valeur estimée du bien",
    );
    // 570 000 € vaut 6 points, 2 000 000 € en vaudrait 10 : c'est bien la
    // valeur de la base qui a été comptée.
    expect(band.points).toBe(6);

    const [lead] = db.recordLead.mock.calls[0] as [Record<string, unknown>];
    expect(lead.estimatedLow).toBe(520_000);
    expect(lead.estimatedHigh).toBe(620_000);
    // NOTRE identifiant de ligne, jamais celui du moteur : la colonne est une
    // clé étrangère.
    expect(lead.estimationId).toBe(ESTIMATION_ROW_ID);
  });

  it("ne relit aucune estimation pour un visiteur sans compte", async () => {
    session.currentUserId.mockResolvedValue(null);

    const response = await POST(jsonRequest(validBody, "198.51.100.6"));
    const payload = await response.json();

    expect(db.listEstimations).not.toHaveBeenCalled();
    const band = payload.lead.breakdown.find(
      (item: { label: string }) => item.label === "Valeur estimée du bien",
    );
    expect(band.points).toBe(0);
    expect(response.status).toBe(201);
  });

  it("ne ment pas quand la base tombe : 202, rien de conservé, et le score rendu quand même", async () => {
    db.recordConsents.mockResolvedValue({ stored: false, reason: "failed" });
    db.recordLead.mockResolvedValue({ stored: false, reason: "failed" });

    const response = await POST(jsonRequest(validBody, "198.51.100.7"));
    expect(response.status).toBe(202);

    const payload = await response.json();
    expect(payload.persistence).toBe("none");
    expect(payload.consents.recorded).toBe(false);
    expect(payload.lead.id).toBeUndefined();
    // Le service rendu, lui, ne bouge pas.
    expect(payload.lead.score).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(payload.lead.collectedAt))).toBe(false);
  });

  it("annonce « partial » quand le registre a écrit mais pas la demande", async () => {
    db.recordLead.mockResolvedValue({ stored: false, reason: "failed" });

    const response = await POST(jsonRequest(validBody, "198.51.100.8"));
    expect(response.status).toBe(202);

    const payload = await response.json();
    expect(payload.persistence).toBe("partial");
    expect(payload.consents.recorded).toBe(true);
  });

  it("range l'adresse en minuscules et ne la journalise jamais en clair", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(jsonRequest(validBody, "198.51.100.9"));

    const [lead] = db.recordLead.mock.calls[0] as [{ contact: { email: string } }];
    expect(lead.contact.email).toBe("mathieu@example.fr");

    const logged = info.mock.calls.flat().join(" ");
    expect(logged).not.toContain("mathieu@example.fr");
    expect(logged).toContain("m***u@example.fr");
  });
});
