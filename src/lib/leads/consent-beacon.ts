"use client";

/**
 * LA MOITIÉ NAVIGATEUR DU REGISTRE DE CONSENTEMENT.
 *
 * `src/lib/consent/consent.ts` garde le choix cookies dans `localStorage`, et
 * le dit lui-même : ce choix vit « dans un seul navigateur, donc nulle part le
 * jour où il faut le produire ». Ce module est ce qui manque, à savoir le
 * dépôt de la preuve côté serveur, où elle est horodatée par Postgres.
 *
 * IL NE DÉCIDE RIEN. Le blocage des traceurs reste entièrement côté navigateur
 * et ne dépend pas de cet appel : si le réseau est coupé ou si la base est
 * absente, rien n'est chargé pour autant. La preuve manque, le respect du choix
 * non.
 *
 * POURQUOI UNE MÉMOIRE LOCALE. Le bandeau appelle son effet à CHAQUE montage,
 * y compris quand la réponse est déjà donnée depuis des semaines. Sans garde,
 * chaque page vue écrirait une ligne de plus dans un registre en ajout seul, et
 * la preuve se noierait dans son propre bruit. On ne réécrit donc que lorsque
 * la décision a CHANGÉ depuis le dernier dépôt réussi.
 *
 * La mémoire retient le DERNIER choix déposé, pas l'ensemble des choix déjà
 * vus : quelqu'un qui accepte, refuse, puis accepte de nouveau doit produire
 * trois lignes, sinon la plus récente du registre (celle qui fait foi)
 * contredirait son navigateur.
 */

import { CONSENT_VERSION } from "@/lib/consent/consent";

const MEMO_KEY = "corpusimmo.consentement.preuve.v1";
const ENDPOINT = "/api/consentement";

/** Empêche un double montage d'envoyer deux fois la même décision. */
let inFlight: string | null = null;

function mark(analytics: boolean): string {
  return `${CONSENT_VERSION}:${analytics ? "oui" : "non"}`;
}

function lastReported(): string | null {
  try {
    return window.localStorage.getItem(MEMO_KEY);
  } catch {
    // Navigation privée, stockage plein : on redéposera, ce qui est le sens de
    // l'erreur à préférer ici (une ligne de trop plutôt qu'une preuve absente).
    return null;
  }
}

function remember(value: string): void {
  try {
    window.localStorage.setItem(MEMO_KEY, value);
  } catch {
    // Sans mémoire, la preuve repartira au prochain chargement. Sans gravité.
  }
}

/**
 * Dépose la décision cookies auprès du serveur, si elle a changé.
 *
 * N'ENVOIE AUCUNE DATE, volontairement : celle du navigateur ne prouverait
 * rien, et la route la refuserait. Ne lève jamais.
 */
export async function reportConsentChoice(analytics: boolean): Promise<void> {
  const current = mark(analytics);
  if (inFlight === current || lastReported() === current) return;

  inFlight = current;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `keepalive` : le clic sur « Tout accepter » est souvent suivi d'une
      // navigation immédiate, qui annulerait une requête ordinaire.
      keepalive: true,
      body: JSON.stringify({ analytics }),
    });

    // On ne retient que ce que le serveur a bien reçu : un échec réseau doit se
    // rejouer au prochain chargement, sans quoi la preuve serait perdue pour
    // de bon.
    if (response.ok) remember(current);
  } catch {
    // Hors ligne : rien à dire à la personne, le choix est déjà appliqué.
  } finally {
    inFlight = null;
  }
}
