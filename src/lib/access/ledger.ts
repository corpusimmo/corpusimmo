import "server-only";

/**
 * LE VERROU — côté serveur, et nulle part ailleurs.
 *
 * Un seul verrou dans tout le site : l'adresse e-mail contre l'outil.
 *
 * COMMENT IL TIENT
 *   1. la fiche publique ne contient JAMAIS le calculateur — elle le décrit.
 *      L'outil vit sur `/outils/[slug]/calculer`, une page distincte ;
 *   2. cette page revérifie l'accès à CHAQUE rendu. Deviner l'URL ne sert donc
 *      à rien ;
 *   3. l'autorisation vit dans un cookie httpOnly signé en HMAC-SHA256 : un
 *      visiteur ne peut pas s'attribuer un outil qu'il n'a pas demandé.
 *
 * LE SECRET — `DOWNLOAD_SIGNING_SECRET`, le même qui signe les liens de
 * téléchargement. Le brouillon tirait ici un secret aléatoire au démarrage : en
 * environnement serverless, chaque démarrage à froid aurait invalidé les
 * déblocages de tout le monde. Un secret configuré est stable par construction.
 *
 * SANS SECRET, IL N'Y A PAS DE VERROU — et les outils restent ouverts. C'est
 * délibéré : l'application doit tourner avec un `.env` vide, et un verrou qu'on
 * ne peut pas signer ne doit pas se transformer en porte close pour tout le
 * monde. L'absence est journalisée une fois.
 */

import { cookies } from "next/headers";

import { env } from "@/config/env";

import {
  applyGrant,
  computeQuota,
  decodeGrants,
  encodeGrants,
  WEEKLY_LIMIT,
  type Grant,
  type Quota,
} from "./core";

export { WEEKLY_LIMIT, type Grant, type Quota } from "./core";

export const ACCESS_COOKIE = "corpusimmo_acces";

/** Six mois : assez pour ne pas redemander l'adresse à chaque visite. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const OPEN_QUOTA: Quota = {
  limit: WEEKLY_LIMIT,
  used: 0,
  remaining: WEEKLY_LIMIT,
  renewsAt: null,
};

export interface AccessState {
  /** Les outils débloqués, du plus récent au plus ancien. */
  unlocked: Grant[];
  quota: Quota;
  /** Faux quand aucun secret n'est configuré : il n'y a alors pas de verrou. */
  enforced: boolean;
}

let warned = false;

function secret(): string | undefined {
  const value = env.downloadSecret;
  if (!value && !warned) {
    warned = true;
    console.warn(
      "[acces] DOWNLOAD_SIGNING_SECRET absent : les outils restent ouverts, " +
        "aucun quota n'est appliqué.",
    );
  }
  return value;
}

/** Lecture seule — utilisable depuis un Server Component. */
export async function readAccess(now: Date = new Date()): Promise<AccessState> {
  const key = secret();
  if (!key) return { unlocked: [], quota: OPEN_QUOTA, enforced: false };

  const grants = decodeGrants((await cookies()).get(ACCESS_COOKIE)?.value, key);
  return {
    unlocked: [...grants].sort((a, b) => b.at - a.at),
    quota: computeQuota(grants, now),
    enforced: true,
  };
}

/** Sans verrou configuré, tout est ouvert — voir l'en-tête du fichier. */
export async function hasAccess(slug: string): Promise<boolean> {
  const state = await readAccess();
  if (!state.enforced) return true;
  return state.unlocked.some((grant) => grant.slug === slug);
}

export type GrantResult =
  | { granted: true; alreadyOwned: boolean; quota: Quota }
  | { granted: false; reason: "quota_exhausted"; quota: Quota };

/**
 * Débloque un outil et écrit le cookie.
 *
 * À n'appeler que depuis un route handler ou une action serveur — écrire un
 * cookie depuis un Server Component lève.
 */
export async function grantAccess(slug: string, now: Date = new Date()): Promise<GrantResult> {
  const key = secret();
  if (!key) return { granted: true, alreadyOwned: true, quota: OPEN_QUOTA };

  const jar = await cookies();
  const outcome = applyGrant(decodeGrants(jar.get(ACCESS_COOKIE)?.value, key), slug, now);

  if (!outcome.granted) {
    return { granted: false, reason: outcome.reason, quota: outcome.quota };
  }

  if (!outcome.alreadyOwned) {
    jar.set(ACCESS_COOKIE, encodeGrants(outcome.grants, key), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  }

  return { granted: true, alreadyOwned: outcome.alreadyOwned, quota: outcome.quota };
}
