/**
 * La liste — l'autre moitié du travail e-mail, et le seul actif réel au
 * lancement.
 *
 * Le transporteur (`brevo.ts`) envoie UN message à UNE adresse. Ce module-ci
 * inscrit durablement une personne dans une liste, avec ce à quoi elle a
 * consenti et quand. Les deux sont volontairement séparés : envoyer un e-mail
 * transactionnel à quelqu'un n'a jamais valu accord pour lui en envoyer
 * d'autres, et mélanger les deux chemins est la façon la plus courante de
 * transformer une base propre en base illégale.
 *
 * TROIS RÈGLES, APPLIQUÉES ICI
 *  1. **Aucune inscription sans consentement explicite.** `marketing !== true`
 *     ne synchronise rien. Il n'y a pas de branche « par défaut on inscrit ».
 *  2. **La liste doit être nommée.** Sans identifiant de liste configuré, on
 *     saute. Écrire dans une liste devinée mélangerait des consentements qui ne
 *     se recouvrent pas.
 *  3. **La date de consentement vient du serveur**, et elle voyage avec le
 *     contact : c'est elle qui se produit en cas de réclamation.
 *
 * Comme le transporteur, ces fonctions ne lèvent JAMAIS. Une panne de liste ne
 * doit pas coûter à quelqu'un l'estimation qu'il vient de demander.
 */

import { env } from "@/config/env";

import { maskEmail } from "./types";

const ENDPOINT = "https://api.brevo.com/v3/contacts";
const TIMEOUT_MS = 10_000;

/** À quoi la personne a dit oui, explicitement. */
export interface ContactConsents {
  /** Recevoir la lettre d'information et les nouveautés. */
  marketing: boolean;
  /** Être contacté par un professionnel de son secteur. */
  professionalContact: boolean;
  /** Horodatage ISO produit par le serveur. Jamais par le client. */
  collectedAt: string;
}

export interface ContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  /** D'où vient le contact : `estimation`, `newsletter`, `aimant:<slug>`… */
  source: string;
  consents: ContactConsents;
  /** Attributs métier facultatifs, déjà normalisés. */
  city?: string;
  propertyType?: string;
}

export type ContactSyncOutcome =
  | { synced: true; created: boolean }
  | { synced: false; reason: "no_consent" | "no_list" | "not_configured" | "failed" };

/**
 * Les attributs personnalisés attendus côté Brevo.
 *
 * Ils doivent exister dans le compte AVANT le premier envoi : Brevo refuse un
 * attribut inconnu au lieu de l'ignorer. La liste est dans `docs/emails.md`.
 */
function buildAttributes(input: ContactInput): Record<string, string> {
  const attributes: Record<string, string> = {
    SOURCE: input.source,
    CONSENT_DATE: input.consents.collectedAt,
    CONSENT_MARKETING: input.consents.marketing ? "oui" : "non",
    CONSENT_PRO: input.consents.professionalContact ? "oui" : "non",
  };
  if (input.firstName) attributes.PRENOM = input.firstName;
  if (input.lastName) attributes.NOM = input.lastName;
  if (input.city) attributes.VILLE = input.city;
  if (input.propertyType) attributes.TYPE_BIEN = input.propertyType;
  return attributes;
}

/**
 * Inscrit ou met à jour un contact dans une liste.
 *
 * `listId` explicite plutôt que déduit de la source : c'est l'appelant qui sait
 * dans quelle liste il écrit, et un identifiant qui se devine est un
 * identifiant qui se trompe.
 */
export async function syncContact(
  input: ContactInput,
  listId: number | undefined,
): Promise<ContactSyncOutcome> {
  // Règle 1 — aucune inscription sans accord explicite.
  if (!input.consents.marketing) return { synced: false, reason: "no_consent" };

  // Règle 2 — la liste doit être nommée.
  if (!listId) return { synced: false, reason: "no_list" };

  const apiKey = env.email.apiKey;
  if (env.email.provider !== "brevo" || !apiKey) {
    return { synced: false, reason: "not_configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: input.email.toLowerCase(),
        attributes: buildAttributes(input),
        listIds: [listId],
        // Sans cela, un contact déjà connu fait échouer la requête au lieu
        // d'être mis à jour — et l'on perdrait la trace du nouvel accord.
        updateEnabled: true,
      }),
      signal: controller.signal,
    });

    // 201 : créé. 204 : déjà connu, mis à jour. Les deux sont des succès.
    if (response.status === 201) return { synced: true, created: true };
    if (response.status === 204) return { synced: true, created: false };

    const detail = await response.text().catch(() => "");
    console.error(
      `[contacts:brevo] inscription refusée (${response.status}) pour ` +
        `${maskEmail(input.email)} — ${detail.slice(0, 200)}`,
    );
    return { synced: false, reason: "failed" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "erreur inconnue";
    console.error(
      `[contacts:brevo] inscription impossible pour ${maskEmail(input.email)} — ${reason}`,
    );
    return { synced: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** La liste de la lettre d'information. */
export function newsletterListId(): number | undefined {
  return env.contacts.newsletterListId;
}

/** La liste alimentée par le parcours d'estimation. */
export function leadsListId(): number | undefined {
  return env.contacts.leadsListId;
}
