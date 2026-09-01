"use client";

/**
 * L'ENREGISTREMENT DU SERVICE WORKER — en production, et seulement là.
 *
 * En développement, un service worker est un piège : il sert des morceaux JS
 * mis en cache pendant qu'on modifie le code, et on passe une demi-heure à
 * chercher pourquoi une correction ne s'applique pas. Le rechargement à chaud
 * de Next et un cache local ne peuvent pas cohabiter honnêtement.
 *
 * En plus de ne pas enregistrer, on DÉSENREGISTRE : quiconque a ouvert
 * `corpus.immo` en production puis lance le site en local sur le même
 * navigateur garde sinon un contrôleur actif sur `localhost`.
 */

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((enregistrements) => {
        for (const enregistrement of enregistrements) void enregistrement.unregister();
      });
      return;
    }

    // On attend `load`. Enregistrer un service worker met la main sur le
    // réseau du document ; le faire pendant que la page finit de se peindre
    // retarde le premier rendu utile sans rien gagner.
    const enregistrer = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((erreur) => {
        // Navigation privée, réglage d'entreprise, quota plein : l'échec est
        // normal et sans conséquence. Le site marche exactement pareil, il
        // n'est simplement pas disponible hors ligne.
        console.warn("[pwa] service worker non enregistré", erreur);
      });
    };

    if (document.readyState === "complete") {
      enregistrer();
      return;
    }

    window.addEventListener("load", enregistrer, { once: true });
    return () => window.removeEventListener("load", enregistrer);
  }, []);

  return null;
}
