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

const BREVO_ENDPOINT = "https://api.brevo.com/v3/contacts";
const RESEND_ENDPOINT = "https://api.resend.com/audiences";
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
  listId: number | string | undefined,
): Promise<ContactSyncOutcome> {
  // Règle 1 — aucune inscription sans accord explicite.
  if (!input.consents.marketing) return { synced: false, reason: "no_consent" };

  // Règle 2 — la liste doit être nommée.
  if (!listId) return { synced: false, reason: "no_list" };

  const apiKey = env.email.apiKey;
  const provider = env.email.provider;
  if (provider === "console" || !apiKey) {
    return { synced: false, reason: "not_configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response =
      provider === "brevo"
        ? await postBrevo(apiKey, input, listId, controller.signal)
        : await postResend(apiKey, input, listId, controller.signal);

    // Brevo — 201 : créé, 204 : déjà connu et mis à jour.
    // Resend — 201 : créé ou mis à jour, il ne distingue pas.
    if (response.status === 201) return { synced: true, created: true };
    if (response.status === 204 || response.status === 200) {
      return { synced: true, created: false };
    }

    const detail = await response.text().catch(() => "");
    console.error(
      `[contacts:${provider}] inscription refusée (${response.status}) pour ` +
        `${maskEmail(input.email)} — ${detail.slice(0, 200)}`,
    );
    return { synced: false, reason: "failed" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "erreur inconnue";
    console.error(
      `[contacts:${provider}] inscription impossible pour ${maskEmail(input.email)} — ${reason}`,
    );
    return { synced: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

function postBrevo(
  apiKey: string,
  input: ContactInput,
  listId: number | string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: { "api-key": apiKey, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      email: input.email.toLowerCase(),
      attributes: buildAttributes(input),
      listIds: [Number(listId)],
      // Sans cela, un contact déjà connu fait échouer la requête au lieu
      // d'être mis à jour — et l'on perdrait la trace du nouvel accord.
      updateEnabled: true,
    }),
    signal,
  });
}

/**
 * Resend — l'audience, plus pauvre que la liste Brevo.
 *
 * L'API n'accepte que l'e-mail, le prénom, le nom et l'état d'abonnement :
 * PAS d'attributs libres. La source, la date de consentement et les accords
 * détaillés n'y ont donc AUCUNE place, alors qu'ils sont précisément ce qu'on
 * doit pouvoir produire en cas de réclamation.
 *
 * Conséquence à assumer, écrite ici pour qu'elle ne se perde pas : chez Resend,
 * l'audience est une liste de diffusion, pas une preuve. La preuve du
 * consentement devra vivre dans NOTRE base — c'est un des motifs du chantier de
 * persistance, au même titre que le score de lead.
 */
function postResend(
  apiKey: string,
  input: ContactInput,
  audienceId: number | string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(`${RESEND_ENDPOINT}/${audienceId}/contacts`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      email: input.email.toLowerCase(),
      ...(input.firstName ? { first_name: input.firstName } : {}),
      ...(input.lastName ? { last_name: input.lastName } : {}),
      unsubscribed: false,
    }),
    signal,
  });
}

/**
 * La liste de la lettre d'information.
 *
 * `number | string` : Brevo numérote ses listes, Resend identifie ses audiences
 * par UUID. Le module ne tranche pas — il transmet ce qui est configuré.
 */
export function newsletterListId(): number | string | undefined {
  return env.contacts.newsletterListId;
}

/** La liste alimentée par le parcours d'estimation. */
export function leadsListId(): number | string | undefined {
  return env.contacts.leadsListId;
}
