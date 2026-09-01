import "server-only";

/**
 * LE REGISTRE DES CONSENTEMENTS — écrire, et savoir relire.
 *
 * L'ÉCRITURE EST EN AJOUT SEUL. Il n'y a pas de fonction `updateConsent`, et
 * c'est le point entier du module : retirer un accord se fait en écrivant un
 * refus daté, pas en modifiant la ligne qui portait l'accord. Écraser
 * détruirait la seule chose qu'on cherche à conserver, c'est-à-dire la preuve
 * qu'à telle date, la personne avait dit oui.
 *
 * L'HORODATAGE VIENT DE POSTGRES, jamais de l'appelant. `contacts.ts` en fait
 * déjà une règle explicite : « un horodatage fourni par le client ne prouverait
 * rien ». C'est pourquoi `recordConsent` n'accepte AUCUN paramètre de date. Un
 * `now` optionnel, même bien intentionné, finirait tôt ou tard rempli avec une
 * valeur venue d'un corps de requête.
 *
 * L'ÉTAT COURANT EST LA LIGNE LA PLUS RÉCENTE d'une finalité. `currentConsent`
 * le calcule ; personne ne doit refaire ce calcul ailleurs, sous peine de
 * répondre « oui » à partir d'une ligne de l'an dernier alors qu'un refus a été
 * écrit depuis.
 */

import { and, desc, eq, type SQL } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "../client";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { consents, type ConsentPurpose, type ConsentRow } from "../schema/consents";
import { consentsOfEmail, consentsOfUser, normaliseEmail } from "../scopes";

export { CONSENT_PURPOSES, type ConsentPurpose } from "../schema/consents";

/**
 * Ce qu'il faut fournir pour qu'un consentement soit une preuve.
 *
 * Ni `collectedAt` ni `id` : le premier appartient au serveur, le second à
 * Postgres.
 */
export interface ConsentInput {
  /** Le compte, si la personne en a un. */
  userId?: string | null;
  /** L'adresse donnée. Absente pour le bandeau cookies, qui n'en demande pas. */
  email?: string | null;
  purpose: ConsentPurpose;
  /** Vrai pour un accord, faux pour un refus ou un retrait. */
  granted: boolean;
  /** `estimation`, `newsletter`, `aimant:<slug>`, `bandeau-cookies`… */
  source: string;
  /** Le périmètre de finalités en vigueur au moment du choix. */
  version: number;
}

/** Ce qu'on relit d'une ligne du registre. */
export interface StoredConsent {
  id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  collectedAt: Date;
  source: string;
  version: number;
  email: string | null;
  userId: string | null;
}

function toStored(row: ConsentRow): StoredConsent {
  return {
    id: row.id,
    purpose: row.purpose,
    granted: row.granted,
    collectedAt: row.collectedAt,
    source: row.source,
    version: row.version,
    email: row.email,
    userId: row.userId,
  };
}

/** Enregistre UN consentement. La date est posée par Postgres. */
export async function recordConsent(input: ConsentInput): Promise<WriteOutcome<StoredConsent>> {
  const outcome = await recordConsents([input]);
  if (!outcome.stored) return outcome;

  const first = outcome.value[0];
  return first
    ? { stored: true, value: first }
    : writeFailed("recordConsent", new Error("aucune ligne rendue"));
}

/**
 * Enregistre plusieurs consentements d'un coup.
 *
 * C'est la forme dont `POST /api/leads` a besoin : un formulaire d'estimation
 * recueille trois décisions distinctes en un envoi (remise de l'estimation,
 * contact professionnel, lettre d'information). Trois lignes, parce que ce sont
 * trois décisions — mais UNE instruction, pour qu'elles portent le même
 * horodatage serveur et qu'aucune ne puisse manquer si la suivante échoue.
 */
export async function recordConsents(
  inputs: readonly ConsentInput[],
): Promise<WriteOutcome<StoredConsent[]>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;
  if (inputs.length === 0) return { stored: true, value: [] };

  try {
    const rows = await getDb()
      .insert(consents)
      .values(
        inputs.map((input) => ({
          userId: input.userId ?? null,
          email: input.email ? normaliseEmail(input.email) : null,
          purpose: input.purpose,
          granted: input.granted,
          source: input.source,
          version: input.version,
          // `collectedAt` est volontairement absent : la valeur par défaut de la
          // colonne est `now()`, donc l'heure de la BASE. Voir l'en-tête.
        })),
      )
      .returning();

    return { stored: true, value: rows.map(toStored) };
  } catch (error) {
    return writeFailed("recordConsents", error);
  }
}

/** Tout le registre d'une personne, du plus récent au plus ancien. */
export async function listConsents(
  who: { userId: string } | { email: string },
): Promise<StoredConsent[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select()
    .from(consents)
    .where(scopeOf(who))
    .orderBy(desc(consents.collectedAt));

  return rows.map(toStored);
}

/**
 * L'état COURANT d'une finalité : la ligne la plus récente, ou rien.
 *
 * Rien ne veut dire « jamais répondu », ce qui n'est PAS un accord. C'est la
 * position que `src/lib/consent/consent.ts` défend déjà côté navigateur :
 * « l'absence de réponse n'est pas un accord ». L'appelant doit traiter `null`
 * comme un refus, et le type le lui rappelle en ne rendant pas de booléen.
 */
export async function currentConsent(
  who: { userId: string } | { email: string },
  purpose: ConsentPurpose,
): Promise<StoredConsent | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await getDb()
    .select()
    .from(consents)
    .where(and(scopeOf(who), eq(consents.purpose, purpose)))
    .orderBy(desc(consents.collectedAt))
    .limit(1);

  const row = rows[0];
  return row ? toStored(row) : null;
}

function scopeOf(who: { userId: string } | { email: string }): SQL {
  return "userId" in who ? consentsOfUser(who.userId) : consentsOfEmail(who.email);
}
