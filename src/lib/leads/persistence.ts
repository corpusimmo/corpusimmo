/**
 * LA COUTURE ENTRE LES FORMULAIRES ET LA BASE.
 *
 * Les trois formulaires publics (estimation, lettre d'information, accès à un
 * outil) et le bandeau cookies écrivent tous la même chose : une personne, une
 * demande, et surtout des décisions horodatées. Ce module est le seul endroit
 * où ces routes touchent `@/lib/db`, pour trois raisons.
 *
 * 1. UN ÉCHEC DE BASE NE COÛTE JAMAIS SON RÉSULTAT À LA PERSONNE. Aucune
 *    fonction d'ici ne lève, y compris les LECTURES (que la couche `queries/`
 *    laisse remonter, elle). L'appelant reçoit un résultat qu'il peut annoncer
 *    honnêtement, jamais une exception qui transformerait une estimation
 *    réussie en erreur affichée.
 *
 * 2. L'HORODATAGE RESTE HORS DE PORTÉE DE L'APPELANT. Aucune signature d'ici
 *    n'accepte de date : la seule qui compte est posée par Postgres, et c'est
 *    celle qu'on rend (voir `collectedAt` de `ConsentWriteResult`). Une route
 *    ne peut donc pas, même par accident, recopier dans le registre une date
 *    venue d'un corps de requête.
 *
 * 3. CE MODULE N'IMPORTE PAS `server-only`, ET CHARGE LA BASE À LA DEMANDE.
 *    C'est le parti déjà pris par `src/lib/db/config.ts` (« ce qui le rend
 *    éprouvable sous Vitest ») et par `src/lib/auth/user-id.ts` (« la règle se
 *    teste, la plomberie s'exécute »). Sans `DATABASE_URL`, le pilote n'est pas
 *    chargé du tout : le chemin « pas de base » est le VRAI chemin, pas une
 *    imitation, et c'est précisément celui qu'il faut prouver puisque c'est lui
 *    qui décide si la réponse a le droit de dire « c'est enregistré ».
 */

import { isDatabaseConfigured } from "@/lib/db/config";
import type { LeadInput } from "@/lib/db/queries/leads";
import type { ConsentPurpose } from "@/lib/db/schema/consents";

export type { ConsentPurpose } from "@/lib/db/schema/consents";

/**
 * LE PÉRIMÈTRE DE FINALITÉS SOUS LEQUEL ON ÉCRIT.
 *
 * Le serveur le pose lui-même et ne l'accepte d'aucun corps de requête : une
 * version fournie par le navigateur ferait passer un accord pour la couverture
 * d'un périmètre qui n'était pas celui affiché.
 *
 * Il DOIT valoir `CONSENT_VERSION` (`src/lib/consent/consent.ts`), qui commande
 * l'affichage du bandeau. La constante n'est pas importée de là : ce module est
 * marqué « use client » et une route serveur ne doit pas en dépendre. La
 * divergence est donc interdite par un test (`consent-version.test.ts`) plutôt
 * que par un import.
 */
export const CONSENT_REGISTRY_VERSION = 1;

/** Une décision, et son sens : vrai pour un accord, faux pour un refus. */
export interface ConsentDecision {
  purpose: ConsentPurpose;
  /**
   * UNE CASE NON COCHÉE EST UN REFUS, PAS UNE ABSENCE. C'est la raison d'être
   * de ce booléen : `granted: false` s'écrit, il ne se tait pas. Pouvoir
   * prouver qu'on a demandé et essuyé un non vaut autant que prouver un oui, et
   * empêche de reposer la question indéfiniment.
   */
  granted: boolean;
}

export interface ConsentContext {
  /** `estimation`, `newsletter`, `outil:<slug>`, `bandeau-cookies`. */
  source: string;
  /** L'adresse donnée. Absente pour le bandeau cookies, qui n'en demande pas. */
  email?: string | null;
  /** Le compte, quand la personne en a un. */
  userId?: string | null;
}

export type ConsentWriteResult =
  | {
      recorded: true;
      /** La date POSTGRES des lignes écrites. La seule qui fasse preuve. */
      collectedAt: Date;
      count: number;
    }
  | { recorded: false; reason: "not_configured" | "failed" | "empty" };

export type LeadWriteResult =
  | { stored: true; leadId: string; contactId: string; createdAt: Date }
  | { stored: false; reason: "not_configured" | "failed" };

/**
 * L'estimation telle que NOUS l'avons produite et rangée.
 *
 * Ce type existe pour qu'on ne puisse pas confondre les deux valeurs qui se
 * ressemblent : celle du corps de la requête (une déclaration) et celle de la
 * base (une donnée que nous avons calculée). Seule la seconde a le droit
 * d'entrer dans le score et dans la fiche du prospect.
 */
export interface VerifiedEstimation {
  /**
   * NOTRE identifiant de ligne, le seul qui puisse aller dans
   * `leads.estimation_id` : la colonne est un `uuid` avec clé étrangère, et
   * l'identifiant de moteur que le client a en main n'en est pas un.
   */
  estimationId: string;
  /** La fourchette en euros, nulle quand le moteur n'a pas conclu. */
  value: { low: number; central: number; high: number } | null;
}

/**
 * Enregistre des décisions dans le registre.
 *
 * Une seule instruction pour toutes : elles portent alors le MÊME horodatage
 * serveur, et aucune ne peut manquer si la suivante échoue.
 */
export async function saveConsents(
  decisions: readonly ConsentDecision[],
  context: ConsentContext,
): Promise<ConsentWriteResult> {
  if (decisions.length === 0) return { recorded: false, reason: "empty" };
  if (!isDatabaseConfigured()) return { recorded: false, reason: "not_configured" };

  const { recordConsents } = await import("@/lib/db");

  const outcome = await recordConsents(
    decisions.map((decision) => ({
      purpose: decision.purpose,
      granted: decision.granted,
      source: context.source,
      version: CONSENT_REGISTRY_VERSION,
      email: context.email ?? null,
      userId: context.userId ?? null,
      // Aucune date n'est passée, et `recordConsent` n'en accepte d'ailleurs
      // aucune : la colonne vaut `now()` côté Postgres.
    })),
  );

  if (!outcome.stored) return { recorded: false, reason: outcome.reason };

  const first = outcome.value[0];
  if (!first) return { recorded: false, reason: "failed" };

  return { recorded: true, collectedAt: first.collectedAt, count: outcome.value.length };
}

/** Enregistre la personne (dédupliquée par adresse) puis sa demande. */
export async function saveLead(input: LeadInput): Promise<LeadWriteResult> {
  if (!isDatabaseConfigured()) return { stored: false, reason: "not_configured" };

  const { recordLead } = await import("@/lib/db");

  // Pas de `now` : la date d'une demande appartient au serveur, comme celle
  // d'un consentement.
  const outcome = await recordLead(input);
  if (!outcome.stored) return { stored: false, reason: outcome.reason };

  return {
    stored: true,
    leadId: outcome.value.leadId,
    contactId: outcome.value.contactId,
    createdAt: outcome.value.createdAt,
  };
}

/**
 * L'identifiant de compte de la personne connectée, ou `null`.
 *
 * `null` couvre toutes les situations qui appellent la même conduite : pas de
 * base, pas d'authentification, personne connectée, jeton antérieur à l'arrivée
 * de la base. Une session illisible ne doit pas faire échouer un formulaire, on
 * la traite donc comme une absence de session.
 */
export async function accountId(): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const { currentUserId } = await import("@/lib/auth/current-user");
    return await currentUserId();
  } catch (error) {
    console.warn("[leads] session illisible, la personne est traitée comme anonyme", error);
    return null;
  }
}

/**
 * Relit UNE estimation depuis la base, à partir de l'identifiant de moteur que
 * le client a en main.
 *
 * POURQUOI PASSER PAR LA LISTE. La couche d'accès n'expose pas de lecture par
 * identifiant de moteur : `readEstimation` attend NOTRE identifiant de ligne,
 * que le client n'a jamais vu. On relit donc la page la plus récente de la
 * personne et on y cherche l'identifiant. L'estimation visée vient d'être
 * calculée, elle est donc en tête ; si elle n'y est pas, on ne trouve rien et
 * la bande « valeur » ne compte pas. C'est la bonne direction pour se tromper :
 * zéro point plutôt que des points non vérifiés.
 *
 * Rend `null` sans lever, y compris quand la base répond mal : une demande de
 * contact ne doit pas échouer parce qu'une lecture d'agrément a échoué.
 */
export async function verifiedEstimation(
  engineId: string,
  userId: string,
): Promise<VerifiedEstimation | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const { listEstimations } = await import("@/lib/db");
    const summaries = await listEstimations(userId);
    const match = summaries.find((summary) => summary.engineId === engineId);
    if (!match) return null;

    return { estimationId: match.id, value: match.value };
  } catch (error) {
    console.error("[leads] relecture de l'estimation impossible", error);
    return null;
  }
}
