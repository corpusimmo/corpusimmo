"use client";

/**
 * L'ATTRAPE-ÉVÉNEMENT — et pourquoi il vit au niveau du MODULE.
 *
 * `beforeinstallprompt` est tiré une seule fois, tôt, dès que Chrome a lu le
 * manifeste et vu un service worker. Il n'est pas rejoué : le manquer, c'est
 * perdre la possibilité d'installer pour toute la durée de la page.
 *
 * S'abonner depuis un `useEffect` laisserait passer toute la fenêtre entre
 * l'évaluation du script et la fin de l'hydratation. On s'abonne donc à
 * l'évaluation du module, c'est-à-dire au plus tôt de ce que ce fichier peut
 * espérer, et on garde l'événement de côté jusqu'à ce qu'un composant vienne
 * le chercher.
 *
 * L'appel à `preventDefault()` est le cœur de la consigne : il annule la
 * mini-bannière native de Chrome. À partir de là, l'invite, c'est la nôtre, et
 * c'est nous qui décidons du moment.
 */

import type { BeforeInstallPromptEvent } from "./platform";

let capture: BeforeInstallPromptEvent | null = null;
let installee = false;
const abonnes = new Set<() => void>();

function prevenir(): void {
  for (const abonne of abonnes) abonne();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    // Sans ceci, Chrome affiche sa propre invite, au moment qu'il choisit.
    event.preventDefault();
    capture = event as BeforeInstallPromptEvent;
    prevenir();
  });

  // L'installation a pu se faire hors de notre invite (menu du navigateur,
  // barre d'adresse). L'événement est notre seul moyen de le savoir.
  window.addEventListener("appinstalled", () => {
    capture = null;
    installee = true;
    prevenir();
  });
}

export const invitationNative = {
  disponible: (): boolean => capture !== null,
  dejaInstallee: (): boolean => installee,

  subscribe: (abonne: () => void): (() => void) => {
    abonnes.add(abonne);
    return () => {
      abonnes.delete(abonne);
    };
  },

  /**
   * Consomme l'événement : il n'est utilisable QU'UNE FOIS. On le retire avant
   * de l'utiliser pour qu'un double clic ne déclenche pas deux invites
   * natives, ce que Chrome refuse en levant une erreur.
   */
  consommer: (): BeforeInstallPromptEvent | null => {
    const evenement = capture;
    capture = null;
    return evenement;
  },
};
