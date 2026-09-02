"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils/cn";

import { useFavorites } from "./favorites";

/**
 * Le signet d'un outil.
 *
 * IL PORTE SON LIBELLÉ, sauf demande contraire. Un signet seul est une icône
 * que chacun interprète : marque-page, favori, téléchargement, partage. Trois
 * mots coûtent quelques pixels et suppriment l'hésitation, et ils disent aussi
 * ce qui se passera au clic, ce qu'une icône ne dit jamais. Le mot est le même
 * que celui du filtre en tête de bibliothèque, « ce que j'ai mis de côté ».
 *
 * `aria-pressed` et non un simple bouton : l'état est ce qui compte, et un
 * lecteur d'écran doit l'annoncer sans avoir à deviner l'icône.
 */
export function FavoriteButton({
  slug,
  title,
  className,
  withLabel = true,
}: {
  slug: string;
  title: string;
  className?: string;
  /** Passer `false` ne laisse que le pictogramme, quand la place manque. */
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
        track({
          name: active ? "tool_unsaved" : "tool_saved",
          params: { tool_id: slug },
        });
      }}
      className={cn(
        // `tap-target` : le bouton ne dessine que 30 px de haut. Le grossir
        // déséquilibrerait la carte d'outil qui le porte, alors on n'élargit
        // que la zone d'appui, invisible et centrée.
        "tap-target relative inline-flex items-center gap-1.5 rounded-full text-sm transition-colors",
        withLabel
          ? // Une pastille bordée : elle se lit comme une action, là où un
            // libellé nu se lirait comme une étiquette de plus.
            "border px-3 py-1.5 text-xs font-medium"
          : "px-2 py-1.5",
        active
          ? withLabel
            ? "border-accent bg-accent-soft text-accent-soft-fg"
            : "text-accent"
          : withLabel
            ? "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink"
            : "text-ink-subtle hover:text-ink",
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
          {active
            ? `Retirer ${title} de mes favoris`
            : `Mettre ${title} de côté`}
        </span>
      )}
    </button>
  );
}
