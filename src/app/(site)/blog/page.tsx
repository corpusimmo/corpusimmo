/**
 * L'INDEX DU JOURNAL, construit mais pas encore montré.
 *
 * La page existe, elle se construit au build, elle est complète. Elle n'est
 * simplement proposée à aucun moteur tant que `BLOG_IS_PUBLIC` vaut `false` et
 * qu'aucun article n'est publié (voir `src/lib/blog/visibility.ts`). Aucune
 * entrée de menu ne la désigne, aucune ligne de plan de site ne la déclare.
 *
 * Rien n'est lu de la requête ici&nbsp;: pas de `searchParams`, donc pas de
 * filtre par rubrique dans l'URL. C'est délibéré. Lire un paramètre de requête
 * basculerait la page en rendu dynamique, ce que l'invariant du dépôt interdit.
 * Le filtrage par rubrique et par étiquette existe déjà dans `lib/blog`, prêt
 * pour de futures pages `/blog/rubrique/[id]`, statiques elles aussi.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Newspaper, Rss } from "lucide-react";

import { EmptyState } from "@/components/ui";
import {
  blogRobots,
  hasPublishedBlogPosts,
  visibleBlogPosts,
} from "@/lib/blog";
import { pageMetadata } from "@/lib/seo/metadata";

import { PostCard } from "./post-card";

const TITLE = "Le journal";
const DESCRIPTION =
  "Ce que les données publiques de transaction permettent de dire d'un marché, ce qu'elles ne " +
  "permettent pas, et comment lire une estimation sans lui faire dire plus qu'elle ne dit.";

/**
 * Les métadonnées sont CALCULÉES, jamais figées&nbsp;: l'indexation dépend de
 * l'état réel du journal au moment du build. Une constante `robots` recopiée
 * ici finirait par contredire le contenu de la page.
 */
export function generateMetadata(): Metadata {
  const robots = blogRobots(hasPublishedBlogPosts());

  return pageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: "/blog",
    index: robots.index,
    follow: robots.follow,
  });
}

export default function BlogIndexPage() {
  const posts = visibleBlogPosts();
  const hasPublished = hasPublishedBlogPosts();

  return (
    <div className="bg-canvas py-10 md:py-14">
      <div className="container-page">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div className="max-w-2xl">
            <p className="eyebrow">Journal</p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
              Lire un marché sur pièces
            </h1>
            <p className="mt-3 leading-relaxed text-ink-muted">{DESCRIPTION}</p>

            {hasPublished ? (
              <Link
                href="/blog/rss.xml"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                <Rss aria-hidden="true" className="size-4" />
                Suivre le flux RSS
              </Link>
            ) : null}
          </div>

          {/* Des îlots haussmanniens vus du ciel : le journal lit un marché
              par-dessus les toits. Illustration générée (voir docs/images.md). */}
          <figure>
            <div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-border bg-surface-3 shadow-xs lg:aspect-[4/3]">
              <Image
                src="/illustrations/ville-metropole-aerienne.webp"
                alt="Illustration : îlots haussmanniens vus du ciel, toits de zinc et cours intérieures en fin de journée."
                fill
                priority
                sizes="(min-width: 1024px) 480px, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-2 text-xs text-ink-subtle">
              Illustration.
            </figcaption>
          </figure>
        </header>

        <div className="mt-10">
          {posts.length === 0 ? (
            <EmptyState
              icon={<Newspaper aria-hidden="true" />}
              title="Le journal n'a pas encore d'article"
              description="Les premiers textes sont en cours de rédaction. Ils porteront sur la méthode d'estimation, sur ce que contiennent les données publiques de transaction, et sur ce qu'elles ne disent pas."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
