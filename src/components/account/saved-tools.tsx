"use client";

/**
 * LES OUTILS MIS DE CÔTÉ.
 *
 * Mettre de côté ne coûte aucun crédit : c'est ce qui rend le quota de deux
 * outils par semaine vivable plutôt que punitif. On repère librement, on
 * dépense en connaissance de cause.
 *
 * La liste vit dans le navigateur, le registre des déblocages vit dans un
 * cookie signé côté serveur. Les deux se rejoignent ici : le serveur passe la
 * liste des outils déjà ouverts, et chaque signet sait s'il est encore derrière
 * la porte ou non.
 */

import Link from "next/link";
import { BookmarkX, Check, Lock } from "lucide-react";

import { useFavorites } from "@/components/tools/favorites";
import { Button, EmptyState, SkeletonText } from "@/components/ui";
import { toolCatalogue } from "@/data/tools-catalogue";

export function SavedTools({ unlocked }: { unlocked: string[] }) {
  const { favorites, toggle, hydrated } = useFavorites();

  if (!hydrated) return <SkeletonText lines={3} />;

  const saved = toolCatalogue.filter((tool) => favorites.includes(tool.id));

  if (saved.length === 0) {
    return (
      <EmptyState
        title="Rien de mis de côté pour l'instant"
        description="Le signet d'une fiche outil range celle-ci ici. C'est gratuit, illimité, et ça ne consomme aucun crédit hebdomadaire."
        action={
          <Button asChild variant="secondary">
            <Link href="/outils">Parcourir la bibliothèque</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {saved.map((tool) => {
        const owned = unlocked.includes(tool.id);
        return (
          <li
            key={tool.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <Link
                href={`/outils/${tool.id}`}
                className="font-medium text-ink transition-colors hover:text-primary"
              >
                {tool.title}
              </Link>
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{tool.summary}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button asChild size="sm" variant={owned ? "secondary" : "primary"}>
                <Link href={`/outils/${tool.id}/calculer`}>
                  {owned ? (
                    <>
                      <Check aria-hidden="true" className="size-4" />
                      Rouvrir
                    </>
                  ) : (
                    <>
                      <Lock aria-hidden="true" className="size-4" />
                      Débloquer
                    </>
                  )}
                </Link>
              </Button>
              <button
                type="button"
                onClick={() => toggle(tool.id)}
                aria-label={`Retirer ${tool.title} des outils mis de côté`}
                className="inline-flex size-9 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <BookmarkX aria-hidden="true" className="size-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
