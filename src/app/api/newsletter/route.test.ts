import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const db = vi.hoisted(() => ({ recordConsents: vi.fn() }));

vi.mock("@/lib/db", () => db);

const FAKE_URL = "postgresql://exemple:motdepasse@localhost:5432/corpusimmo";
const DB_DATE = new Date("2026-03-04T10:11:12.000Z");

function jsonRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost:3000/api/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", FAKE_URL);
  db.recordConsents.mockResolvedValue({
    stored: true,
    value: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        purpose: "marketing",
        granted: true,
        collectedAt: DB_DATE,
        source: "newsletter",
        version: 1,
        email: "mathieu@example.fr",
        userId: null,
      },
    ],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/newsletter", () => {
  it("enregistre le consentement à la lettre d'information, horodaté par la base", async () => {
    const response = await POST(
      jsonRequest({ email: "Mathieu@Example.FR", consent: true }, "203.0.113.201"),
    );
    expect(response.status).toBe(202);

    const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      purpose: "marketing",
      granted: true,
      source: "newsletter",
      // L'adresse est rangée en minuscules, comme partout ailleurs.
      email: "mathieu@example.fr",
    });
    expect(Object.keys(rows[0] ?? {})).not.toContain("collectedAt");

    const payload = await response.json();
    expect(payload.consent.recorded).toBe(true);
    expect(payload.collectedAt).toBe(DB_DATE.toISOString());
  });

  it("distingue la preuve conservée de l'inscription à la liste de diffusion", async () => {
    const response = await POST(
      jsonRequest({ email: "mathieu@example.fr", consent: true }, "203.0.113.202"),
    );

    const payload = await response.json();
    // Aucune liste n'est configurée dans cet environnement : rien n'est
    // synchronisé, et pourtant la décision, elle, est bien conservée.
    expect(payload.subscribed).toBe(false);
    expect(payload.consent.recorded).toBe(true);
  });

  it("n'affirme aucune conservation quand il n'y a pas de base", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await POST(
      jsonRequest({ email: "mathieu@example.fr", consent: true }, "203.0.113.203"),
    );
    expect(response.status).toBe(202);

    const payload = await response.json();
    expect(payload.consent.recorded).toBe(false);
    expect(db.recordConsents).not.toHaveBeenCalled();
  });

  it("n'écrit rien quand la case n'est pas cochée : ce n'est pas une décision, c'est un formulaire incomplet", async () => {
    const response = await POST(
      jsonRequest({ email: "mathieu@example.fr", consent: false }, "203.0.113.204"),
    );
    expect(response.status).toBe(400);
    expect(db.recordConsents).not.toHaveBeenCalled();
  });

  it("ne journalise jamais l'adresse en clair", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(jsonRequest({ email: "mathieu@example.fr", consent: true }, "203.0.113.205"));

    const logged = info.mock.calls.flat().join(" ");
    expect(logged).not.toContain("mathieu@example.fr");
    expect(logged).toContain("m***u@example.fr");
  });
});
