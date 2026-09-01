import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_VERSION } from "@/lib/consent/consent";

import {
  accountId,
  CONSENT_REGISTRY_VERSION,
  saveConsents,
  saveLead,
  verifiedEstimation,
} from "./persistence";

/**
 * La base est simulée module par module : aucun test ne doit toucher la vraie
 * `DATABASE_URL` de l'environnement, et `@/lib/db` importe `server-only`, qui
 * refuse de se charger sous Vitest.
 */
const db = vi.hoisted(() => ({
  recordConsents: vi.fn(),
  recordLead: vi.fn(),
  listEstimations: vi.fn(),
}));

vi.mock("@/lib/db", () => db);

const FAKE_URL = "postgresql://exemple:motdepasse@localhost:5432/corpusimmo";
/** La date que seule Postgres a le droit de poser. */
const DB_DATE = new Date("2026-03-04T10:11:12.000Z");

function storedConsent(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    purpose: "marketing",
    granted: true,
    collectedAt: DB_DATE,
    source: "newsletter",
    version: CONSENT_REGISTRY_VERSION,
    email: "mathieu@example.fr",
    userId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", FAKE_URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("la version du périmètre de consentement", () => {
  it("suit exactement celle du bandeau, sinon un accord couvrirait un autre périmètre", () => {
    expect(CONSENT_REGISTRY_VERSION).toBe(CONSENT_VERSION);
  });
});

describe("saveConsents", () => {
  it("n'invente aucune date et laisse Postgres la poser", async () => {
    db.recordConsents.mockResolvedValue({ stored: true, value: [storedConsent()] });

    const outcome = await saveConsents([{ purpose: "marketing", granted: true }], {
      source: "newsletter",
      email: "Mathieu@Example.FR",
    });

    expect(outcome.recorded).toBe(true);
    const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows).toHaveLength(1);
    // Aucune clé de date, sous aucun nom : la colonne vaut `now()` côté base.
    expect(Object.keys(rows[0] ?? {})).not.toContain("collectedAt");
    expect(JSON.stringify(rows[0])).not.toContain("2026");
    // Et c'est bien la date de la base qui ressort.
    if (outcome.recorded) expect(outcome.collectedAt).toEqual(DB_DATE);
  });

  it("écrit un refus comme une décision, pas comme une absence", async () => {
    db.recordConsents.mockResolvedValue({
      stored: true,
      value: [storedConsent({ granted: false, purpose: "marketing" })],
    });

    await saveConsents([{ purpose: "marketing", granted: false }], {
      source: "outil:tri-de-projet",
      email: "mathieu@example.fr",
    });

    const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      purpose: "marketing",
      granted: false,
      source: "outil:tri-de-projet",
      version: CONSENT_REGISTRY_VERSION,
    });
  });

  it("écrit les trois décisions d'un formulaire en une seule fois", async () => {
    db.recordConsents.mockResolvedValue({
      stored: true,
      value: [storedConsent(), storedConsent(), storedConsent()],
    });

    const outcome = await saveConsents(
      [
        { purpose: "estimation_delivery", granted: true },
        { purpose: "professional_contact", granted: false },
        { purpose: "marketing", granted: false },
      ],
      { source: "estimation", email: "mathieu@example.fr" },
    );

    expect(db.recordConsents).toHaveBeenCalledTimes(1);
    expect(outcome.recorded && outcome.count).toBe(3);
  });

  it("ne touche pas la base quand il n'y en a pas, et le dit", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const outcome = await saveConsents([{ purpose: "analytics", granted: false }], {
      source: "bandeau-cookies",
    });

    expect(outcome).toEqual({ recorded: false, reason: "not_configured" });
    expect(db.recordConsents).not.toHaveBeenCalled();
  });

  it("rend un échec de base sans jamais lever", async () => {
    db.recordConsents.mockResolvedValue({ stored: false, reason: "failed" });

    const outcome = await saveConsents([{ purpose: "analytics", granted: true }], {
      source: "bandeau-cookies",
    });

    expect(outcome).toEqual({ recorded: false, reason: "failed" });
  });
});

describe("saveLead", () => {
  it("rend l'identifiant de la demande quand elle est écrite", async () => {
    db.recordLead.mockResolvedValue({
      stored: true,
      value: {
        leadId: "22222222-2222-4222-8222-222222222222",
        contactId: "33333333-3333-4333-8333-333333333333",
        createdAt: DB_DATE,
        status: "new",
        score: 61,
      },
    });

    const outcome = await saveLead({
      contact: { email: "mathieu@example.fr", firstName: "Mathieu" },
      source: "estimation",
      score: 61,
    });

    expect(outcome).toMatchObject({ stored: true, leadId: "22222222-2222-4222-8222-222222222222" });
    // Aucune date passée à la couche d'accès : elle appartient au serveur.
    expect(db.recordLead.mock.calls[0]).toHaveLength(1);
  });

  it("dégrade sans lever quand la base refuse", async () => {
    db.recordLead.mockResolvedValue({ stored: false, reason: "failed" });

    const outcome = await saveLead({
      contact: { email: "mathieu@example.fr", firstName: "Mathieu" },
      source: "estimation",
      score: 12,
    });

    expect(outcome).toEqual({ stored: false, reason: "failed" });
  });
});

describe("verifiedEstimation", () => {
  const userId = "44444444-4444-4444-8444-444444444444";

  it("retrouve l'estimation par son identifiant de moteur et rend NOTRE identifiant de ligne", async () => {
    db.listEstimations.mockResolvedValue([
      { id: "ligne-2", engineId: "val-2", value: { low: 1, central: 2, high: 3 } },
      { id: "ligne-1", engineId: "val-1", value: { low: 100, central: 200, high: 300 } },
    ]);

    const found = await verifiedEstimation("val-1", userId);

    expect(found).toEqual({
      estimationId: "ligne-1",
      value: { low: 100, central: 200, high: 300 },
    });
  });

  it("rend null quand l'estimation n'est pas la nôtre", async () => {
    db.listEstimations.mockResolvedValue([{ id: "ligne-2", engineId: "val-2", value: null }]);
    expect(await verifiedEstimation("val-inconnue", userId)).toBeNull();
  });

  it("rend null sans lever quand la lecture échoue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db.listEstimations.mockRejectedValue(new Error("connexion perdue"));

    expect(await verifiedEstimation("val-1", userId)).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  it("ne lit rien sans base", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await verifiedEstimation("val-1", userId)).toBeNull();
    expect(db.listEstimations).not.toHaveBeenCalled();
  });
});

describe("accountId", () => {
  it("rend null sans base, sans même charger la session", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await accountId()).toBeNull();
  });
});
