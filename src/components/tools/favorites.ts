"use client";

/**
 * LES FAVORIS — la liste de lecture de la bibliothèque.
 *
 * Mettre un outil de côté ne coûte rien et n'engage à rien : c'est un signet.
 * On parcourt donc la bibliothèque, on marque ce qui servira, et on y revient —
 * sans avoir à retenir dix noms d'outils ni à refaire une recherche.
 *
 * POURQUOI DU `localStorage` ET PAS UN COOKIE
 *   Le brouillon rangeait les favoris dans un cookie httpOnly, lisible côté
 *   serveur. C'était cohérent chez lui, où toutes les pages étaient déjà
 *   dynamiques. Ici, lire un cookie dans `/outils` ferait basculer la page en
 *   rendu dynamique — ce que ce dépôt évite depuis le premier commit. Le prix à
 *   payer est un signet qui s'allume après l'hydratation plutôt qu'au premier
 *   octet ; c'est le même compromis que le panier de comparables, et la même
 *   mécanique.
 *
 * `useSyncExternalStore` plutôt qu'un contexte React : le signet d'une carte,
 * le filtre de la bibliothèque et le bouton d'une fiche vivent dans trois
 * arbres différents. Un abonnement au niveau du module les tient d'accord sans
 * imposer un fournisseur à toute l'application.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "corpusimmo.outils.favoris.v1";

/** Un signet n'est pas une base : au-delà, on ne garde que les plus récents. */
const MAX_FAVORITES = 60;

/** Borne de sûreté : un identifiant d'outil, rien d'autre. */
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

const listeners = new Set<() => void>();

/**
 * L'instantané rendu à React.
 *
 * `useSyncExternalStore` compare les instantanés par IDENTITÉ. Relire
 * `localStorage` à chaque appel produirait un tableau neuf à chaque rendu, donc
 * une boucle infinie. On met donc en cache, et on n'invalide que sur écriture.
 */
let snapshot: string[] | null = null;

/** Le serveur n'a pas de `localStorage` : il ne connaît aucun favori. */
const SERVER_SNAPSHOT: string[] = [];

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string" && SLUG_PATTERN.test(value))
      .slice(-MAX_FAVORITES);
  } catch {
    // Navigation privée, quota plein, contenu corrompu : on repart de zéro
    // plutôt que de faire tomber la page pour un signet.
    return [];
  }
}

function getSnapshot(): string[] {
  snapshot ??= read();
  return snapshot;
}

function emit(next: string[]): void {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // L'écriture peut échouer sans que le signet cesse de fonctionner pour la
    // session en cours. Il ne survivra simplement pas au rechargement.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Un autre onglet a écrit : on invalide et on prévient.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = null;
    for (const l of listeners) l();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface FavoritesApi {
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  toggle: (slug: string) => void;
  /** Faux tant que `localStorage` n'a pas été lu — évite un signet qui clignote. */
  hydrated: boolean;
}

export function useFavorites(): FavoritesApi {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const toggle = useCallback((slug: string) => {
    if (!SLUG_PATTERN.test(slug)) return;
    const current = getSnapshot();
    emit(
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug].slice(-MAX_FAVORITES),
    );
  }, []);

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  return { favorites, isFavorite, toggle, hydrated: favorites !== SERVER_SNAPSHOT };
}
