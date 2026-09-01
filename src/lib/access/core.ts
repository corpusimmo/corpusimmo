/**
 * Le RAISONNEMENT du verrou, sans le cookie.
 *
 * Signature, relecture défensive et calcul du quota vivent ici, sans
 * `next/headers` ni `server-only` — donc éprouvables directement. `ledger.ts`
 * n'est plus qu'une fine couche qui lit et écrit le cookie.
 *
 * La séparation n'est pas cosmétique : c'est ce qui permet de tester la
 * signature contre une tentative de forge, et la fenêtre glissante contre le
 * temps qui passe, sans monter une requête HTTP.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Un cookie n'est pas une base : au-delà, on ne garde que les plus récents. */
export const MAX_GRANTS = 40;

/**
 * LE QUOTA — deux outils par semaine GLISSANTE.
 *
 * Le parti est celui d'A.CRE : la bibliothèque est ouverte, pas illimitée. Ce
 * qu'on compte est le DÉBLOCAGE, jamais l'usage — rouvrir un outil déjà obtenu
 * ne consomme rien. Une porte, une unité.
 *
 * La fenêtre glisse et n'est pas calendaire : « lundi minuit » ferait affluer
 * tout le monde au même instant et punirait qui arrive un dimanche soir.
 */
export const WEEKLY_LIMIT = 2;
export const WINDOW_SECONDS = 7 * 24 * 60 * 60;

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

/** Un déblocage : l'outil, et QUAND il a été ouvert (secondes Unix). */
export interface Grant {
  slug: string;
  at: number;
}

export interface Quota {
  limit: number;
  /** Déblocages comptés dans les sept derniers jours. */
  used: number;
  remaining: number;
  /**
   * Quand un crédit se libère — la date du plus ancien déblocage compté, plus
   * sept jours. `null` tant que le quota n'est pas atteint.
   */
  renewsAt: Date | null;
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function encodeGrants(grants: Grant[], key: string): string {
  const body = Buffer.from(JSON.stringify({ g: grants }), "utf8").toString("base64url");
  return `${body}.${sign(body, key)}`;
}

/**
 * Un cookie illisible, falsifié ou d'une autre installation vaut « aucun
 * déblocage ».
 *
 * La signature est vérifiée AVANT toute lecture du contenu : se prononcer sur
 * une charge non authentifiée reviendrait à croire ce qu'un visiteur vient
 * d'écrire.
 */
export function decodeGrants(raw: string | undefined, key: string): Grant[] {
  if (!raw) return [];

  const [body, signature] = raw.split(".");
  if (!body || !signature) return [];

  const given = Buffer.from(signature, "base64url");
  const wanted = Buffer.from(sign(body, key), "base64url");
  // `timingSafeEqual` exige des longueurs égales ; une longueur différente est
  // déjà un échec, et la comparer révélerait la longueur attendue.
  if (given.length !== wanted.length) return [];
  if (!timingSafeEqual(given, wanted)) return [];

  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return [];
    const grants = (parsed as { g?: unknown }).g;
    if (!Array.isArray(grants)) return [];

    return grants
      .filter(
        (grant): grant is Grant =>
          typeof grant === "object" &&
          grant !== null &&
          typeof (grant as Grant).slug === "string" &&
          SLUG_PATTERN.test((grant as Grant).slug) &&
          typeof (grant as Grant).at === "number" &&
          Number.isFinite((grant as Grant).at),
      )
      .slice(-MAX_GRANTS);
  } catch {
    return [];
  }
}

export function computeQuota(grants: Grant[], now: Date): Quota {
  const cutoff = Math.floor(now.getTime() / 1000) - WINDOW_SECONDS;
  const recent = grants.filter((grant) => grant.at > cutoff).sort((a, b) => a.at - b.at);
  const oldest = recent[0];

  return {
    limit: WEEKLY_LIMIT,
    used: Math.min(recent.length, WEEKLY_LIMIT),
    remaining: Math.max(0, WEEKLY_LIMIT - recent.length),
    renewsAt:
      recent.length >= WEEKLY_LIMIT && oldest
        ? new Date((oldest.at + WINDOW_SECONDS) * 1000)
        : null,
  };
}

export type GrantOutcome =
  | { granted: true; alreadyOwned: boolean; grants: Grant[]; quota: Quota }
  | { granted: false; reason: "quota_exhausted"; grants: Grant[]; quota: Quota };

/**
 * Décide d'un déblocage, sans rien écrire.
 *
 * Rouvrir un outil déjà débloqué NE CONSOMME RIEN et ne peut pas échouer, même
 * quota épuisé : on ne reprend pas ce qui a été donné.
 */
export function applyGrant(grants: Grant[], slug: string, now: Date): GrantOutcome {
  if (grants.some((grant) => grant.slug === slug)) {
    return { granted: true, alreadyOwned: true, grants, quota: computeQuota(grants, now) };
  }

  const quota = computeQuota(grants, now);
  if (quota.remaining <= 0) {
    return { granted: false, reason: "quota_exhausted", grants, quota };
  }

  const next = [...grants, { slug, at: Math.floor(now.getTime() / 1000) }].slice(-MAX_GRANTS);
  return { granted: true, alreadyOwned: false, grants: next, quota: computeQuota(next, now) };
}
