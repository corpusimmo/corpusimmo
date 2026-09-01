"use client";

/**
 * LE CONSENTEMENT, tel que la CNIL le demande.
 *
 * Trois règles tiennent tout le reste, et elles sont ici plutôt que dans un
 * composant pour qu'aucune interface ne puisse les contourner :
 *
 *   1. RIEN DE NON ESSENTIEL AVANT LE CHOIX. Tant que l'état vaut `unknown`,
 *      aucune mesure d'audience n'est chargée. Pas de balise chargée « en
 *      mode refusé », pas de requête préalable : le script tiers n'est pas
 *      demandé du tout. C'est la lecture stricte, et c'est celle qui ne se
 *      discute pas.
 *   2. REFUSER EST AUSSI SIMPLE QU'ACCEPTER. Les deux réponses passent par la
 *      même fonction, avec le même coût. Aucune n'est un chemin dégradé.
 *   3. LE CHOIX SE RETIRE AUSSI FACILEMENT QU'IL SE DONNE. `reopen()` remet la
 *      décision à zéro, et le pied de page comme la page cookies y donnent
 *      accès en un clic.
 *
 * L'ABSENCE DE RÉPONSE N'EST PAS UN ACCORD. Fermer le bandeau sans choisir
 * laisse l'état à `unknown`, donc tout reste refusé. C'est délibérément moins
 * rentable qu'un consentement présumé, et c'est la seule position tenable.
 *
 * POURQUOI `localStorage` ET PAS UN COOKIE. Un cookie de consentement serait
 * lisible côté serveur, donc rendrait le bandeau sans clignotement. Mais le
 * lire ferait basculer toutes les pages en rendu dynamique, ce que ce dépôt
 * évite depuis le premier commit. Le bandeau apparaît donc après l'hydratation.
 * C'est le bon compromis : il n'y a rien à protéger dans ce choix, et rien ne
 * part avant lui de toute façon.
 *
 * LA VERSION. Ajouter demain une finalité nouvelle (publicité, test A/B)
 * invalide les consentements donnés pour l'ancien périmètre : incrémenter
 * `CONSENT_VERSION` redemande le choix à tout le monde, ce qui est exactement
 * ce que le règlement exige.
 */

import { useCallback, useSyncExternalStore } from "react";

import { createLocalStore } from "@/lib/browser/local-store";

/** À incrémenter dès que les finalités changent. */
export const CONSENT_VERSION = 1;

/**
 * Les finalités soumises au choix. `necessary` n'y figure pas : ce qui est
 * strictement nécessaire au service demandé est dispensé de consentement, et
 * faire semblant de le soumettre au choix serait un consentement de façade.
 */
export interface ConsentChoices {
  /** Mesure d'audience. */
  analytics: boolean;
}

export const NO_CONSENT: ConsentChoices = { analytics: false };

export interface ConsentState {
  /** `unknown` tant que la personne n'a pas répondu. Rien ne part alors. */
  status: "unknown" | "answered";
  choices: ConsentChoices;
  /** Millisecondes Unix de la réponse, pour la preuve du consentement. */
  at: number | null;
  version: number;
}

const UNKNOWN: ConsentState = {
  status: "unknown",
  choices: NO_CONSENT,
  at: null,
  version: CONSENT_VERSION,
};

const store = createLocalStore<ConsentState>({
  key: "corpusimmo.consentement.v1",
  empty: UNKNOWN,
  parse: (raw) => {
    if (typeof raw !== "object" || raw === null) return UNKNOWN;
    const value = raw as Partial<ConsentState>;
    // Un consentement donné pour un périmètre de finalités qui n'existe plus
    // ne vaut rien : on redemande.
    if (value.version !== CONSENT_VERSION) return UNKNOWN;
    if (value.status !== "answered") return UNKNOWN;

    return {
      status: "answered",
      choices: { analytics: value.choices?.analytics === true },
      at: typeof value.at === "number" && Number.isFinite(value.at) ? value.at : null,
      version: CONSENT_VERSION,
    };
  },
});

/** Lecture hors React, pour le transport de mesure. */
export function readConsent(): ConsentState {
  try {
    return store.read();
  } catch {
    return UNKNOWN;
  }
}

export function answerConsent(choices: ConsentChoices): void {
  store.write({
    status: "answered",
    choices: { analytics: choices.analytics === true },
    at: Date.now(),
    version: CONSENT_VERSION,
  });
}

/** Retire le choix et fait réapparaître le bandeau. */
export function reopenConsent(): void {
  store.write(UNKNOWN);
}

/** S'abonner au consentement hors React : le transport de mesure en a besoin. */
export function subscribeConsent(listener: () => void): () => void {
  return store.subscribe(listener);
}

export interface ConsentApi extends ConsentState {
  acceptAll: () => void;
  refuseAll: () => void;
  answer: (choices: ConsentChoices) => void;
  reopen: () => void;
  /** Faux tant que `localStorage` n'a pas été lu : évite un bandeau qui clignote. */
  hydrated: boolean;
}

export function useConsent(): ConsentApi {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const acceptAll = useCallback(() => answerConsent({ analytics: true }), []);
  const refuseAll = useCallback(() => answerConsent({ analytics: false }), []);
  const answer = useCallback((choices: ConsentChoices) => answerConsent(choices), []);
  const reopen = useCallback(() => reopenConsent(), []);

  return {
    ...state,
    acceptAll,
    refuseAll,
    answer,
    reopen,
    hydrated: state !== store.serverSnapshot,
  };
}
