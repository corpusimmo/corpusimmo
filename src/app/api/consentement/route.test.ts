import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const db = vi.hoisted(() => ({ recordConsents: vi.fn() }));
const session = vi.hoisted(() => ({ currentUserId: vi.fn() }));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth/current-user", () => session);

const FAKE_URL = "postgresql://exemple:motdepasse@localhost:5432/corpusimmo";
const DB_DATE = new Date("2026-03-04T10:11:12.000Z");
const CLIENT_DATE = "1999-01-01T00:00:00.000Z";

function jsonRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost:3000/api/consentement", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function row(granted: boolean) {
  return {
    id: "88888888-8888-4888-8888-888888888888",
    purpose: "analytics",
    granted,
    collectedAt: DB_DATE,
    source: "bandeau-cookies",
    version: 1,
    email: null,
    userId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", FAKE_URL);
  session.currentUserId.mockResolvedValue(null);
  db.recordConsents.mockResolvedValue({ stored: true, value: [row(true)] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/consentement", () => {
  it("enregistre un refus comme une décision, pas comme un silence", async () => {
    db.recordConsents.mockResolvedValue({ stored: true, value: [row(false)] });

    const response = await POST(jsonRequest({ analytics: false }, "192.0.2.1"));
    expect(response.status).toBe(201);

    const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      purpose: "analytics",
      granted: false,
      source: "bandeau-cookies",
    });

    const payload = await response.json();
    expect(payload.consent).toMatchObject({ granted: false, recorded: true });
  });

  it("horodate côté serveur et n'accepte aucune date du navigateur", async () => {
    const response = await POST(
      jsonRequest({ analytics: true, collectedAt: CLIENT_DATE, at: 915148800000 }, "192.0.2.2"),
    );

    const payload = await response.json();
    expect(payload.consent.collectedAt).toBe(DB_DATE.toISOString());

    const serialised = JSON.stringify(db.recordConsents.mock.calls[0]);
    expect(serialised).not.toContain("1999");
    expect(serialised).not.toContain("915148800000");
    expect(serialised).not.toContain("collectedAt");
  });

  it("ne prétend rien avoir gardé quand il n'y a pas de base", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await POST(jsonRequest({ analytics: true }, "192.0.2.3"));
    // 202 et non 201 : le choix est reçu et déjà appliqué côté navigateur, mais
    // aucune ligne n'existe.
    expect(response.status).toBe(202);

    const payload = await response.json();
    expect(payload.consent.recorded).toBe(false);
    // Surtout pas une date de repli, qui ressemblerait à une preuve.
    expect(payload.consent.collectedAt).toBeNull();
    expect(db.recordConsents).not.toHaveBeenCalled();
  });

  it("ne ment pas davantage quand la base refuse l'écriture", async () => {
    db.recordConsents.mockResolvedValue({ stored: false, reason: "failed" });

    const response = await POST(jsonRequest({ analytics: false }, "192.0.2.4"));
    expect(response.status).toBe(202);

    const payload = await response.json();
    expect(payload.consent).toMatchObject({ granted: false, recorded: false, collectedAt: null });
  });

  it("rattache la ligne au compte quand la personne est connectée", async () => {
    session.currentUserId.mockResolvedValue("44444444-4444-4444-8444-444444444444");

    await POST(jsonRequest({ analytics: true }, "192.0.2.5"));

    const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({ userId: "44444444-4444-4444-8444-444444444444" });
    // Le bandeau ne demande aucune adresse : il n'en invente pas non plus.
    expect(rows[0]?.email).toBeNull();
  });

  it("n'accepte ni adresse ni finalité venues du corps de la requête", async () => {
    await POST(
      jsonRequest(
        { analytics: true, email: "victime@example.fr", purpose: "marketing", version: 99 },
        "192.0.2.6",
      ),
    );

    const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({ purpose: "analytics", email: null, version: 1 });
  });

  it("refuse un choix absent ou mal formé", async () => {
    const missing = await POST(jsonRequest({}, "192.0.2.7"));
    expect(missing.status).toBe(400);

    const wrong = await POST(jsonRequest({ analytics: "oui" }, "192.0.2.8"));
    expect(wrong.status).toBe(400);

    const payload = await wrong.json();
    expect(payload.error.code).toBe("validation_failed");
    expect(db.recordConsents).not.toHaveBeenCalled();
  });

  it("limite le débit par adresse IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const response = await POST(jsonRequest({ analytics: true }, "192.0.2.99"));
      statuses.push(response.status);
    }
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
  });
});
