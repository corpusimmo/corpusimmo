"use client";

/**
 * LES FAVORIS — la liste de lecture de la bibliothèque.
 *
 * Mettre un outil de côté ne coûte AUCUN crédit hebdomadaire : c'est un signet,
 * pas un déblocage (voir `src/lib/access/core.ts`). On peut donc parcourir la
 * bibliothèque, marquer ce qui servira plus tard, et dépenser ses deux accès en
 * connaissance de cause. C'est précisément ce qui rend le quota vivable.
 *
 * La mécanique de stockage vit dans `createLocalStore` : voir l'en-tête de
 * `src/lib/browser/local-store.ts` pour le choix de `localStorage` plutôt qu'un
 * cookie, et ce qu'il coûte.
 */

import { useCallback, useSyncExternalStore } from "react";

import { createLocalStore, useHydrated } from "@/lib/browser/local-store";

/** Un signet n'est pas une base : au-delà, on ne garde que les plus récents. */
const MAX_FAVORITES = 60;

/** Borne de sûreté : un identifiant d'outil, rien d'autre. */
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

const store = createLocalStore<string[]>({
  key: "corpusimmo.outils.favoris.v1",
  empty: [],
  parse: (raw) =>
    Array.isArray(raw)
      ? raw
          .filter((value): value is string => typeof value === "string" && SLUG_PATTERN.test(value))
          .slice(-MAX_FAVORITES)
      : [],
});

export interface FavoritesApi {
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  toggle: (slug: string) => void;
  /** Faux tant que `localStorage` n'a pas été lu : évite un signet qui clignote. */
  hydrated: boolean;
}

export function useFavorites(): FavoritesApi {
  const hydrated = useHydrated();
  const favorites = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const toggle = useCallback((slug: string) => {
    if (!SLUG_PATTERN.test(slug)) return;
    const current = store.getSnapshot();
    store.write(
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug].slice(-MAX_FAVORITES),
    );
  }, []);

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  return { favorites, isFavorite, toggle, hydrated };
}
