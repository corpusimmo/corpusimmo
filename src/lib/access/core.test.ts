import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  applyGrant,
  computeQuota,
  decodeGrants,
  encodeGrants,
  WEEKLY_LIMIT,
  WINDOW_SECONDS,
  type Grant,
} from "./core";

const KEY = "un-secret-de-test-assez-long-pour-etre-credible";
const NOW = new Date("2026-09-01T12:00:00.000Z");
const SECONDS = Math.floor(NOW.getTime() / 1000);

/** Un déblocage survenu il y a `days` jours. */
function daysAgo(slug: string, days: number): Grant {
  return { slug, at: SECONDS - days * 24 * 60 * 60 };
}

describe("signature du registre", () => {
  it("relit ce qu'il vient d'écrire", () => {
    const grants = [daysAgo("dcf", 1), daysAgo("wault", 2)];
    expect(decodeGrants(encodeGrants(grants, KEY), KEY)).toEqual(grants);
  });

  it("refuse une charge modifiée, même signée d'origine", () => {
    const [, signature] = encodeGrants([daysAgo("dcf", 1)], KEY).split(".");
    // On s'ajoute neuf outils en réécrivant la charge, signature conservée.
    const forged = Buffer.from(
      JSON.stringify({ g: Array.from({ length: 9 }, (_, i) => daysAgo(`outil-${i}`, 0)) }),
      "utf8",
    ).toString("base64url");

    expect(decodeGrants(`${forged}.${signature}`, KEY)).toEqual([]);
  });

  it("refuse un cookie signé d'un autre secret", () => {
    const cookie = encodeGrants([daysAgo("dcf", 1)], "un-autre-secret-tout-aussi-long-ici");
    expect(decodeGrants(cookie, KEY)).toEqual([]);
  });

  it("ignore une entrée dont le slug ne ressemble à rien", () => {
    const body = Buffer.from(
      JSON.stringify({ g: [{ slug: "../../etc/passwd", at: SECONDS }, daysAgo("dcf", 1)] }),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", KEY).update(body).digest("base64url");

    expect(decodeGrants(`${body}.${signature}`, KEY)).toEqual([daysAgo("dcf", 1)]);
  });

  it("traite un cookie absent ou informe comme un registre vide", () => {
    expect(decodeGrants(undefined, KEY)).toEqual([]);
    expect(decodeGrants("nimportequoi", KEY)).toEqual([]);
  });
});

describe("quota sur fenêtre glissante", () => {
  it("compte deux crédits à neuf", () => {
    expect(computeQuota([], NOW)).toMatchObject({ used: 0, remaining: WEEKLY_LIMIT, renewsAt: null });
  });

  it("épuise le quota au deuxième déblocage", () => {
    const quota = computeQuota([daysAgo("a", 1), daysAgo("b", 2)], NOW);
    expect(quota.used).toBe(2);
    expect(quota.remaining).toBe(0);
    // Le crédit se libère sept jours après le PLUS ANCIEN des deux.
    expect(quota.renewsAt?.getTime()).toBe((SECONDS - 2 * 86_400 + WINDOW_SECONDS) * 1000);
  });

  it("oublie ce qui date de plus de sept jours", () => {
    const quota = computeQuota([daysAgo("vieux", 8), daysAgo("recent", 1)], NOW);
    expect(quota.used).toBe(1);
    expect(quota.remaining).toBe(1);
  });

  it("ne compte pas un déblocage exactement à la limite", () => {
    // Sept jours pile : il sort de la fenêtre. La borne est stricte, sinon un
    // crédit resterait bloqué une seconde de plus sans raison lisible.
    expect(computeQuota([daysAgo("limite", 7)], NOW).used).toBe(0);
  });
});

describe("déblocage", () => {
  it("accorde tant qu'il reste un crédit", () => {
    const outcome = applyGrant([daysAgo("a", 1)], "dcf", NOW);
    expect(outcome.granted).toBe(true);
    if (outcome.granted) {
      expect(outcome.alreadyOwned).toBe(false);
      expect(outcome.grants.map((g) => g.slug)).toContain("dcf");
      expect(outcome.quota.remaining).toBe(0);
    }
  });

  it("refuse au-delà du quota", () => {
    const outcome = applyGrant([daysAgo("a", 1), daysAgo("b", 2)], "dcf", NOW);
    expect(outcome).toMatchObject({ granted: false, reason: "quota_exhausted" });
  });

  it("rouvre un outil déjà obtenu SANS consommer de crédit, même quota épuisé", () => {
    // La règle qui rend le quota vivable : on ne reprend pas ce qui a été donné.
    const grants = [daysAgo("dcf", 1), daysAgo("wault", 2)];
    const outcome = applyGrant(grants, "dcf", NOW);

    expect(outcome.granted).toBe(true);
    if (outcome.granted) {
      expect(outcome.alreadyOwned).toBe(true);
      expect(outcome.grants).toHaveLength(2);
    }
  });
});
