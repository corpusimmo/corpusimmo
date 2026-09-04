import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

/**
 * Trois modules simulés, et aucun n'est du décor :
 *  - `@/lib/auth` et `@/lib/access/ledger` lisent des cookies de requête, ce
 *    qu'un test hors serveur Next ne peut pas fournir ;
 *  - `@/lib/db` importe `server-only` et, surtout, ne doit jamais être la vraie
 *    base de développement.
 */
const db = vi.hoisted(() => ({ recordConsents: vi.fn() }));
const session = vi.hoisted(() => ({ currentUserId: vi.fn() }));
const auth = vi.hoisted(() => ({ auth: vi.fn(), isAuthConfigured: true }));
const ledger = vi.hoisted(() => ({ grantAccess: vi.fn() }));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth/current-user", () => session);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/access/ledger", () => ledger);

const FAKE_URL = "postgresql://exemple:motdepasse@localhost:5432/corpusimmo";
const DB_DATE = new Date("2026-03-04T10:11:12.000Z");
const SLUG = "rentabilite-locative";

function request(body: unknown, ip: string): Request {
  return new Request(`http://localhost:3000/api/outils/${SLUG}/acces`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ slug: SLUG }) };

function decisions(): Record<string, unknown>[] {
  const [rows] = db.recordConsents.mock.calls[0] as [Record<string, unknown>[]];
  return rows;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", FAKE_URL);

  auth.auth.mockResolvedValue({ user: { email: "Mathieu@Example.FR", name: "Mathieu" } });
  session.currentUserId.mockResolvedValue("44444444-4444-4444-8444-444444444444");
  ledger.grantAccess.mockResolvedValue({
    granted: true,
    alreadyOwned: false,
    quota: { limit: 2, used: 1, remaining: 1, renewsAt: null },
  });
  db.recordConsents.mockResolvedValue({
    stored: true,
    value: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        purpose: "marketing",
        granted: false,
        collectedAt: DB_DATE,
        source: `outil:${SLUG}`,
        version: 1,
        email: "mathieu@example.fr",
        userId: "44444444-4444-4444-8444-444444444444",
      },
    ],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/outils/[slug]/acces", () => {
  it("enregistre la case décochée comme un REFUS, pas comme une absence", async () => {
    const response = await POST(request({ newsletter: false }, "198.51.100.20"), context);
    expect(response.status).toBe(200);

    expect(decisions()[0]).toMatchObject({
      purpose: "marketing",
      granted: false,
      source: `outil:${SLUG}`,
      // L'adresse part telle que la session la donne : la mise en minuscules
      // est faite une seule fois, par `normaliseEmail`, juste avant l'écriture
      // (voir `src/lib/db/scopes.ts`).
      email: "Mathieu@Example.FR",
      userId: "44444444-4444-4444-8444-444444444444",
    });

    const payload = await response.json();
    expect(payload.newsletter).toMatchObject({
      granted: false,
      consentRecorded: true,
      // Rien n'a été envoyé à la liste de diffusion, et la réponse le dit.
      subscribed: false,
    });
  });

  it("enregistre l'accord quand la case est cochée", async () => {
    const response = await POST(request({ newsletter: true }, "198.51.100.21"), context);
    expect(response.status).toBe(200);

    expect(decisions()[0]).toMatchObject({ purpose: "marketing", granted: true });
  });

  it("traite un corps sans la case comme un refus, jamais comme un accord", async () => {
    await POST(request({}, "198.51.100.22"), context);
    expect(decisions()[0]).toMatchObject({ granted: false });
  });

  it("n'invente aucune date : le registre est horodaté par Postgres", async () => {
    await POST(request({ newsletter: true }, "198.51.100.23"), context);

    const serialised = JSON.stringify(db.recordConsents.mock.calls[0]);
    expect(serialised).not.toContain("collectedAt");
  });

  it("ouvre l'outil quand même si le registre est indisponible", async () => {
    db.recordConsents.mockResolvedValue({ stored: false, reason: "failed" });

    const response = await POST(request({ newsletter: true }, "198.51.100.24"), context);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.granted).toBe(true);
    // La réponse n'affirme pas une conservation qui n'a pas eu lieu.
    expect(payload.newsletter.consentRecorded).toBe(false);
  });

  it("n'écrit aucune ligne pour un outil qui n'existe pas", async () => {
    const response = await POST(request({ newsletter: true }, "198.51.100.25"), {
      params: Promise.resolve({ slug: "outil-fantome" }),
    });
    expect(response.status).toBe(404);
    expect(db.recordConsents).not.toHaveBeenCalled();
  });
});
