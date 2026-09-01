"use client";

/**
 * LE POINT DE MONTAGE UNIQUE — une balise, et rien de plus, dans `layout.tsx`.
 *
 * Deux choses vivent ici : l'enregistrement du service worker et l'invite
 * d'installation. Elles sont réunies pour que la mise en page racine n'ait
 * jamais à connaître qu'un seul composant, et pour que grossir le sujet PWA
 * demain ne redemande pas de toucher au fichier le plus sensible du dépôt.
 *
 * Il ne rend RIEN dans le flux : le registrar rend `null`, l'invite se dessine
 * dans un portail sur `<body>` et seulement après un signe d'intérêt. Aucun
 * décalage de mise en page n'est possible, et le manifeste étant posé par la
 * convention de fichier `app/manifest.ts`, il n'y a pas non plus de balise à
 * ajouter dans le `<head>`.
 */

import { InstallInvite } from "./install-invite";
import { ServiceWorkerRegistrar } from "./service-worker";

export function PwaRuntime() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <InstallInvite />
    </>
  );
}
