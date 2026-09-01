/**
 * Le tri, le filtrage et le rapprochement des articles, sans disque ni React.
 *
 * Cette couche ne connaît ni `node:fs`, ni Next, ni l'environnement d'exécution,
 * exactement comme `lib/access/core.ts` est séparé de son cookie. C'est ce
 * qui permet d'éprouver « un brouillon ne sort jamais » et « les liés sont bien
 * choisis » sur des objets fabriqués à la main, sans monter un build.
 *
 * Aucune de ces fonctions ne modifie son entrée&nbsp;: elles rendent toutes un
 * nouveau tableau. Un `sort()` en place sur le catalogue lu en cache
 * réordonnerait le catalogue lui-même pour tous les appelants suivants.
 */

import type { BlogCategoryId, BlogPost, BlogSitemapEntry } from "@/types/blog";

/**
 * Du plus récent au plus ancien, à date égale par slug.
 *
 * La départage par slug n'est pas cosmétique&nbsp;: deux articles publiés le
 * même jour doivent sortir dans le même ordre à chaque build, sans quoi le
 * plan du site et le flux RSS changeraient sans que rien n'ait changé.
 */
export function sortPosts(posts: readonly BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
    return a.slug.localeCompare(b.slug, "fr");
  });
}

/** Les articles réellement publiés. Le seul filtre qui ait une conséquence publique. */
export function publishedOnly(posts: readonly BlogPost[]): BlogPost[] {
  return posts.filter((post) => post.status === "published");
}

export function draftsOnly(posts: readonly BlogPost[]): BlogPost[] {
  return posts.filter((post) => post.status === "draft");
}

export function byCategory(posts: readonly BlogPost[], category: BlogCategoryId): BlogPost[] {
  return posts.filter((post) => post.category === category);
}

/** Le filtrage par étiquette est insensible à la casse&nbsp;: les étiquettes sont déjà normalisées à la lecture. */
export function byTag(posts: readonly BlogPost[], tag: string): BlogPost[] {
  const wanted = tag.trim().toLocaleLowerCase("fr-FR");
  if (!wanted) return [];
  return posts.filter((post) => post.tags.includes(wanted));
}

/** Les étiquettes présentes, de la plus portée à la moins portée. */
export function tagCounts(posts: readonly BlogPost[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count === a.count ? a.tag.localeCompare(b.tag, "fr") : b.count - a.count));
}

/** Deux points pour la même rubrique, un point par étiquette commune. */
function affinity(post: BlogPost, candidate: BlogPost): number {
  const shared = candidate.tags.filter((tag) => post.tags.includes(tag)).length;
  return (candidate.category === post.category ? 2 : 0) + shared;
}

/**
 * Les articles à lire ensuite.
 *
 * L'ordre est délibéré&nbsp;: d'abord ce que l'auteur a EXPLICITEMENT relié
 * dans son en-tête, dans l'ordre où il l'a écrit, ensuite seulement ce que la
 * proximité de rubrique et d'étiquettes suggère. Un rapprochement automatique
 * ne doit jamais passer devant une intention éditoriale.
 *
 * Un slug lié introuvable, dépublié ou pointant sur l'article lui-même est
 * ignoré sans bruit&nbsp;: le jour où un article est retiré, les autres pages
 * doivent continuer de se construire.
 */
export function relatedTo(
  post: BlogPost,
  pool: readonly BlogPost[],
  limit = 3,
): BlogPost[] {
  if (limit <= 0) return [];

  const candidates = pool.filter((entry) => entry.slug !== post.slug);
  const bySlug = new Map(candidates.map((entry) => [entry.slug, entry]));

  const chosen: BlogPost[] = [];
  const taken = new Set<string>();

  for (const slug of post.related) {
    const explicit = bySlug.get(slug);
    if (!explicit || taken.has(slug)) continue;
    chosen.push(explicit);
    taken.add(slug);
    if (chosen.length >= limit) return chosen;
  }

  const scored = candidates
    .filter((entry) => !taken.has(entry.slug))
    .map((entry) => ({ entry, score: affinity(post, entry) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.entry.publishedAt !== b.entry.publishedAt) {
        return a.entry.publishedAt < b.entry.publishedAt ? 1 : -1;
      }
      return a.entry.slug.localeCompare(b.entry.slug, "fr");
    });

  for (const row of scored) {
    chosen.push(row.entry);
    if (chosen.length >= limit) break;
  }

  return chosen;
}

/**
 * Les entrées de plan de site, pour les articles PUBLIÉS uniquement.
 *
 * `lastModified` porte la date de mise à jour, pas celle de publication&nbsp;:
 * c'est la seule des deux qu'un moteur puisse exploiter pour décider de
 * repasser. Elle est fixée à minuit UTC afin que deux builds du même jour
 * produisent exactement le même fichier.
 */
export function sitemapEntriesFor(
  posts: readonly BlogPost[],
  baseUrl: string,
): BlogSitemapEntry[] {
  const base = baseUrl.replace(/\/+$/, "");

  return sortPosts(publishedOnly(posts)).map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(`${post.updatedAt}T00:00:00.000Z`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
