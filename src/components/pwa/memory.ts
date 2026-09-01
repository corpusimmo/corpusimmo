"use client";

/**
 * LA MÉMOIRE DE L'INVITE — ce qui fait qu'un « non » reste un « non ».
 *
 * Deux souvenirs distincts, deux clefs, deux durées de vie :
 *
 *   1. LE REFUS. Un bandeau d'installation qui revient le lendemain n'a pas
 *      écouté la réponse. Soixante jours, c'est assez long pour que le refus
 *      soit vécu comme respecté, et assez court pour laisser une seconde
 *      chance à quelqu'un devenu entre-temps un habitué. Chaque refus
 *      supplémentaire double l'attente : deux « non » valent plus qu'un.
 *
 *   2. LE SIGNE D'INTÉRÊT. Quelqu'un qui vient d'arriver depuis une recherche
 *      n'a aucune raison de vouloir installer un site qu'il n'a pas encore lu.
 *      On compte les pages vues, et on ne propose rien avant la deuxième.
 *
 * La mécanique de stockage est celle de tout le reste du site : voir l'en-tête
 * de `src/lib/browser/local-store.ts` pour le pourquoi du `localStorage`
 * plutôt que d'un cookie (un cookie lu au rendu ferait basculer les pages en
 * dynamique, et ce dépôt tient au rendu statique).
 */

import { createLocalStore } from "@/lib/browser/local-store";

const JOUR_MS = 86_400_000;

/** La peine plancher d'un refus. */
export const REFUS_JOURS = 60;

/** Le nombre de pages vues à partir duquel on considère qu'il y a intérêt. */
export const PAGES_AVANT_INVITE = 2;

/** À défaut de deuxième page : le temps passé sur celle-ci. */
export const PRESENCE_AVANT_INVITE_MS = 30_000;

/**
 * Deux comptages rapprochés sont le même. React en mode strict monte les
 * effets deux fois en développement, et un aller-retour navigateur ne doit pas
 * compter pour deux visites.
 */
const DEBOUNCE_VUE_MS = 1_000;

/* ==========================================================================
   1. LE REFUS
   ========================================================================== */

export type Souvenir =
  /** Jamais rien demandé, jamais rien répondu. */
  | { statut: "vierge" }
  /** Refusé le `depuis`, pour la `nieme` fois. */
  | { statut: "refuse"; depuis: number; nieme: number }
  /** Installé : on ne redemande plus, jamais. */
  | { statut: "installe"; depuis: number };

export const VIERGE: Souvenir = { statut: "vierge" };

/** Défensif par contrat : ce qui est sur le disque a pu être écrit à la main. */
export function parseSouvenir(raw: unknown): Souvenir {
  if (typeof raw !== "object" || raw === null) return VIERGE;
  const valeur = raw as { statut?: unknown; depuis?: unknown; nieme?: unknown };

  const depuis =
    typeof valeur.depuis === "number" && Number.isFinite(valeur.depuis) ? valeur.depuis : null;
  if (depuis === null) return VIERGE;

  if (valeur.statut === "installe") return { statut: "installe", depuis };

  if (valeur.statut === "refuse") {
    const nieme =
      typeof valeur.nieme === "number" && Number.isFinite(valeur.nieme) && valeur.nieme >= 1
        ? Math.floor(valeur.nieme)
        : 1;
    return { statut: "refuse", depuis, nieme };
  }

  return VIERGE;
}

/**
 * Combien de temps se taire après le n-ième refus.
 *
 * Le doublement est plafonné à quatre refus (480 jours) : au-delà, la
 * différence est théorique, et un entier qui grandit sans borne finit toujours
 * par produire une date absurde.
 */
export function silenceApresRefus(nieme: number): number {
  const palier = Math.min(Math.max(nieme, 1), 4);
  return REFUS_JOURS * 2 ** (palier - 1) * JOUR_MS;
}

/** L'invite doit-elle se taire&nbsp;? */
export function estMuette(souvenir: Souvenir, maintenant: number): boolean {
  if (souvenir.statut === "installe") return true;
  if (souvenir.statut === "vierge") return false;

  // Une date dans le futur signale une horloge système reculée depuis le
  // refus. On préfère se taire : le doute profite à qui a dit non.
  if (souvenir.depuis > maintenant) return true;

  return maintenant - souvenir.depuis < silenceApresRefus(souvenir.nieme);
}

export function apresRefus(souvenir: Souvenir, maintenant: number): Souvenir {
  const nieme = souvenir.statut === "refuse" ? souvenir.nieme + 1 : 1;
  return { statut: "refuse", depuis: maintenant, nieme };
}

export function apresInstallation(maintenant: number): Souvenir {
  return { statut: "installe", depuis: maintenant };
}

const souvenirStore = createLocalStore<Souvenir>({
  key: "corpusimmo.pwa-invite.v1",
  empty: VIERGE,
  parse: parseSouvenir,
});

export function lireSouvenir(): Souvenir {
  try {
    return souvenirStore.read();
  } catch {
    return VIERGE;
  }
}

export function ecrireSouvenir(souvenir: Souvenir): void {
  souvenirStore.write(souvenir);
}

/* ==========================================================================
   2. LE SIGNE D'INTÉRÊT
   ========================================================================== */

export interface Presence {
  /** Pages vues, tous chargements confondus. Plafonné : seul le seuil compte. */
  vues: number;
  /** Horodatage du dernier comptage, pour le garde-fou anti-doublon. */
  derniere: number;
}

export const AUCUNE_PRESENCE: Presence = { vues: 0, derniere: 0 };

export function parsePresence(raw: unknown): Presence {
  if (typeof raw !== "object" || raw === null) return AUCUNE_PRESENCE;
  const valeur = raw as { vues?: unknown; derniere?: unknown };

  const vues =
    typeof valeur.vues === "number" && Number.isFinite(valeur.vues) && valeur.vues > 0
      ? Math.min(Math.floor(valeur.vues), 99)
      : 0;
  const derniere =
    typeof valeur.derniere === "number" && Number.isFinite(valeur.derniere)
      ? valeur.derniere
      : 0;

  return { vues, derniere };
}

/** Pure, pour que le garde-fou anti-doublon soit vérifiable sans horloge. */
export function compterVue(presence: Presence, maintenant: number): Presence {
  if (maintenant - presence.derniere < DEBOUNCE_VUE_MS) return presence;
  return { vues: Math.min(presence.vues + 1, 99), derniere: maintenant };
}

export function assezVu(presence: Presence): boolean {
  return presence.vues >= PAGES_AVANT_INVITE;
}

const presenceStore = createLocalStore<Presence>({
  key: "corpusimmo.pwa-presence.v1",
  empty: AUCUNE_PRESENCE,
  parse: parsePresence,
});

/** Enregistre une page vue et rend l'état à jour. */
export function enregistrerVue(maintenant: number = Date.now()): Presence {
  try {
    const suivant = compterVue(presenceStore.read(), maintenant);
    presenceStore.write(suivant);
    return suivant;
  } catch {
    return AUCUNE_PRESENCE;
  }
}
