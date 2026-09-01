"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils/cn";

import { useFavorites } from "./favorites";

/**
 * Le signet d'un outil.
 *
 * `aria-pressed` et non un simple bouton : l'état est ce qui compte, et un
 * lecteur d'écran doit l'annoncer sans avoir à deviner l'icône.
 */
export function FavoriteButton({
  slug,
  title,
  className,
  withLabel = false,
}: {
  slug: string;
  title: string;
  className?: string;
  withLabel?: boolean;
}) {
  const { isFavorite, toggle, hydrated } = useFavorites();
  const active = hydrated && isFavorite(slug);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(event) => {
        // Le signet vit souvent DANS une carte cliquable : sans cela, marquer
        // un outil ouvrirait sa fiche au lieu de le mettre de côté.
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
        track({ name: active ? "tool_unsaved" : "tool_saved", params: { tool_id: slug } });
      }}
      className={cn(
        // `tap-target` : sans libellé, le signet ne dessine que 32×28 px. Le
        // grossir pour la main déséquilibrerait la carte d'outil qui le porte,
        // alors on n'élargit que la zone d'appui, invisible et centrée.
        "tap-target relative inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm transition-colors",
        active ? "text-accent" : "text-ink-subtle hover:text-ink",
        className,
      )}
    >
      {active ? (
        <BookmarkCheck aria-hidden="true" className="size-4" />
      ) : (
        <Bookmark aria-hidden="true" className="size-4" />
      )}
      {withLabel ? (
        <span>{active ? "Mis de côté" : "Mettre de côté"}</span>
      ) : (
        <span className="sr-only">
          {active ? `Retirer ${title} de mes favoris` : `Mettre ${title} de côté`}
        </span>
      )}
    </button>
  );
}
