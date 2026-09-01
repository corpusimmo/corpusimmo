/**
 * La carte d'un article, en liste et en fin d'article.
 *
 * Un seul composant pour les deux emplacements&nbsp;: deux cartes d'article de
 * dessins différents sur le même site donneraient l'impression de deux
 * rubriques distinctes.
 *
 * Le badge « Brouillon » n'apparaît qu'en développement, puisqu'un brouillon
 * n'existe pas en production. Il est là pour éviter l'erreur inverse&nbsp;:
 * relire un texte en local et croire qu'il est en ligne.
 */

import Link from "next/link";

import { Badge } from "@/components/ui";
import { blogCategoryLabel, blogDateTime, formatBlogDate } from "@/lib/blog";
import type { BlogPost } from "@/types/blog";

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-6 transition-[box-shadow,border-color] duration-200 ease-out hover:border-border-strong hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">{blogCategoryLabel(post.category)}</p>
        {post.status === "draft" ? (
          <Badge tone="warning" size="sm">
            Brouillon
          </Badge>
        ) : null}
      </div>

      <h2 className="font-display text-xl leading-snug text-ink">
        {/* Le lien couvre la carte entière&nbsp;: la cible tactile est la carte,
            mais le nom accessible du lien reste le seul titre. */}
        <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
          {post.title}
        </Link>
      </h2>

      <p className="text-sm leading-relaxed text-ink-muted">{post.excerpt}</p>

      <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-ink-subtle">
        <time dateTime={blogDateTime(post.publishedAt)}>{formatBlogDate(post.publishedAt)}</time>
        <span aria-hidden="true">·</span>
        <span className="tnum">{post.readingMinutes} min de lecture</span>
      </p>
    </article>
  );
}
