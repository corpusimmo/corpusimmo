/**
 * Le jeton d'accès à un document — signé, lié, périssable.
 *
 * POURQUOI PAS UNE PIÈCE JOINTE
 *   Une pièce jointe dégrade la délivrabilité (les filtres se méfient des
 *   fichiers), bute sur les limites de taille des messageries, gonfle le coût
 *   d'envoi, et surtout ne se révoque pas : une fois partie, elle est partie.
 *   Un lien signé se révoque en changeant le secret, et il expire tout seul.
 *
 * CE QUE LE JETON LIE, ET POURQUOI
 *   · le **slug** — un jeton pour la matrice A ne peut pas ouvrir la matrice B.
 *     Sans cela, une personne ayant demandé un document les obtiendrait tous ;
 *   · l'**adresse e-mail** — le lien reste attribuable. Un lien qui circule sur
 *     un forum se voit, et on sait par où il est sorti ;
 *   · une **expiration** — un lien oublié dans une boîte ne doit pas rester
 *     ouvert un an.
 *
 * Le secret vit dans `DOWNLOAD_SIGNING_SECRET`. Il n'a **aucune valeur par
 * défaut** : un secret connu de tous ne signe rien, et un jeton signé avec lui
 * serait forgeable par n'importe qui. Absent, on n'émet aucun lien et la route
 * de téléchargement refuse tout.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/config/env";

/** Sept jours : assez pour retrouver l'e-mail, trop court pour l'oublier. */
export const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

interface TokenPayload {
  /** Le document autorisé. */
  s: string;
  /** L'adresse à qui le lien a été remis, en minuscules. */
  e: string;
  /** Expiration, en secondes depuis l'époque Unix. */
  x: number;
}

function b64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

/**
 * `null` plutôt qu'une exception quand le secret manque : l'appelant doit
 * pouvoir dire « le téléchargement n'est pas configuré » sans planter.
 */
export function createDownloadToken(
  slug: string,
  email: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  now: Date = new Date(),
): string | null {
  const secret = env.downloadSecret;
  if (!secret) return null;

  const payload: TokenPayload = {
    s: slug,
    e: email.toLowerCase(),
    x: Math.floor(now.getTime() / 1000) + ttlSeconds,
  };
  const encoded = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${encoded}.${sign(encoded, secret)}`;
}

export type TokenVerdict =
  | { valid: true; slug: string; email: string; expiresAt: Date }
  | { valid: false; reason: "not_configured" | "malformed" | "bad_signature" | "expired" | "wrong_document" };

/**
 * Vérifie un jeton pour un document donné.
 *
 * L'ordre des contrôles compte : la signature est vérifiée AVANT l'expiration
 * et avant le slug. Se prononcer sur le contenu d'une charge non authentifiée
 * reviendrait à faire confiance à ce qu'un attaquant vient d'écrire.
 */
export function verifyDownloadToken(
  token: string,
  expectedSlug: string,
  now: Date = new Date(),
): TokenVerdict {
  const secret = env.downloadSecret;
  if (!secret) return { valid: false, reason: "not_configured" };

  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };

  const [encoded, signature] = parts;
  if (!encoded || !signature) return { valid: false, reason: "malformed" };

  const expected = sign(encoded, secret);
  const given = Buffer.from(signature, "base64url");
  const wanted = Buffer.from(expected, "base64url");
  // `timingSafeEqual` exige des longueurs égales ; une longueur différente est
  // déjà un échec, et la comparer révélerait la longueur attendue.
  if (given.length !== wanted.length) return { valid: false, reason: "bad_signature" };
  if (!timingSafeEqual(given, wanted)) return { valid: false, reason: "bad_signature" };

  let payload: TokenPayload;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as TokenPayload).s !== "string" ||
      typeof (parsed as TokenPayload).e !== "string" ||
      typeof (parsed as TokenPayload).x !== "number"
    ) {
      return { valid: false, reason: "malformed" };
    }
    payload = parsed as TokenPayload;
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (payload.s !== expectedSlug) return { valid: false, reason: "wrong_document" };

  const expiresAt = new Date(payload.x * 1000);
  if (expiresAt.getTime() <= now.getTime()) return { valid: false, reason: "expired" };

  return { valid: true, slug: payload.s, email: payload.e, expiresAt };
}
