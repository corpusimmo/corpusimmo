"use client";

/**
 * UN PETIT MAGASIN LOCAL, partagé par tout ce qui doit survivre à un
 * rechargement sans exister sur le serveur.
 *
 * POURQUOI PAS UN COOKIE. Un cookie serait lisible côté serveur, donc rendu
 * sans clignotement. Mais le lire dans une page ferait basculer cette page en
 * rendu dynamique, et ce dépôt tient au rendu statique depuis le premier
 * commit : rien n'est lu dans la mise en page racine, et toutes les pages sauf
 * les routes d'API sont produites au build. Le prix à payer est un contenu qui
 * s'allume après l'hydratation ; c'est le bon prix.
 *
 * POURQUOI `useSyncExternalStore`. Les signets d'une carte, le compteur d'une
 * bibliothèque et la liste d'un espace compte vivent dans trois arbres React
 * différents. Un abonnement au niveau du module les tient d'accord sans imposer
 * un fournisseur à toute l'application.
 *
 * L'INSTANTANÉ EST MIS EN CACHE. `useSyncExternalStore` compare les instantanés
 * par IDENTITÉ : relire `localStorage` à chaque appel produirait un tableau neuf
 * à chaque rendu, donc une boucle de rendu infinie. On ne relit qu'après une
 * écriture, ou quand un autre onglet en signale une.
 */

import { useSyncExternalStore } from "react";

export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  /** Lecture directe, hors React. */
  read: () => T;
  write: (next: T) => void;
}

export interface LocalStoreOptions<T> {
  /** Clé de `localStorage`. Versionnée : `corpusimmo.<sujet>.v1`. */
  key: string;
  /**
   * Relit une valeur brute venue du disque. DÉFENSIF par contrat : ce qui est
   * là a pu être écrit par une autre version du site, ou à la main.
   */
  parse: (raw: unknown) => T;
  /** Valeur rendue côté serveur, et repli en cas d'échec de lecture. */
  empty: T;
}

export function createLocalStore<T>({ key, parse, empty }: LocalStoreOptions<T>): LocalStore<T> {
  const listeners = new Set<() => void>();
  let snapshot: T | null = null;

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return empty;
      return parse(JSON.parse(raw) as unknown);
    } catch {
      // Navigation privée, quota plein, contenu corrompu : on repart de zéro
      // plutôt que de faire tomber la page pour un confort.
      return empty;
    }
  };

  const getSnapshot = (): T => {
    snapshot ??= read();
    return snapshot;
  };

  const write = (next: T): void => {
    snapshot = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // L'écriture peut échouer sans que la fonctionnalité cesse de marcher
      // pour la session en cours. Elle ne survivra simplement pas au
      // rechargement.
    }
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    // Un autre onglet a écrit : on invalide, puis on prévient tout le monde.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      snapshot = null;
      for (const l of listeners) l();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { subscribe, getSnapshot, getServerSnapshot: () => empty, read, write };
}

const noopSubscribe = () => () => {};

/**
 * Vrai une fois l'hydratation faite, faux au rendu serveur et au premier rendu
 * client.
 *
 * POURQUOI CE CROCHET EXISTE, ET CE QU'IL A CORRIGÉ. La version précédente
 * déduisait l'hydratation d'une comparaison d'identité avec le repli serveur.
 * Quand le stockage était VIDE, la lecture renvoyait exactement cet objet de
 * repli : la comparaison restait donc fausse pour toujours, et un espace compte
 * neuf affichait des squelettes de chargement à l'infini. Signalé en
 * production.
 *
 * Un drapeau explicite ne peut pas se tromper de cette façon : il ne dit rien
 * du contenu, seulement du moment.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
