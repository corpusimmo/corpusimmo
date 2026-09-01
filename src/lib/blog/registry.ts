/**
 * La lecture des articles sur le disque, et rien de plus.
 *
 * QUAND cela s'exécute. Uniquement à la CONSTRUCTION. L'index, les fiches
 * d'articles et le flux RSS sont tous statiques&nbsp;: le dossier n'est donc
 * jamais ouvert en réponse à une requête, et la lecture synchrone qui suit ne
 * bloque aucun visiteur. C'est la même raison qui rend `readFileSync`
 * acceptable ici alors qu'il serait fautif dans une route d'API.
 *
 * POURQUOI un cache de module. `generateStaticParams`, `generateMetadata` et la
 * page appellent tous le catalogue pour un même build. Sans cache, chaque
 * article serait relu et réanalysé une fois par appel et par page.
 *
 * Ce module lit et met en ordre&nbsp;; il ne juge pas. Le jugement est dans
 * `post.ts`, la sélection dans `select.ts`, et c'est ce qui les rend testables
 * sans toucher au disque.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { siteConfig } from "@/config/site";
import type { BlogPost, BlogSitemapEntry } from "@/types/blog";

import { BlogContentError, parseBlogPost } from "./post";
import { publishedOnly, sitemapEntriesFor, sortPosts } from "./select";
import { BLOG_IS_PUBLIC } from "./visibility";

/** Les articles vivent dans les sources, pas dans `public/`&nbsp;: ils sont du contenu, pas des fichiers servis. */
export const BLOG_CONTENT_DIR = join(process.cwd(), "src", "content", "blog");

let cache: BlogPost[] | null = null;

/**
 * Lit un dossier d'articles et rend le catalogue trié.
 *
 * Le dossier absent n'est PAS une erreur&nbsp;: un dépôt fraîchement cloné, ou
 * un journal dont tous les articles ont été retirés, doit construire un site
 * complet avec une rubrique vide. Deux fichiers qui revendiquent la même URL,
 * en revanche, sont une faute que rien ne peut arbitrer&nbsp;: on refuse.
 */
export function loadBlogPosts(directory: string = BLOG_CONTENT_DIR): BlogPost[] {
  let fileNames: string[];
  try {
    fileNames = readdirSync(directory);
  } catch {
    return [];
  }

  const posts: BlogPost[] = [];
  const seen = new Map<string, string>();

  for (const fileName of fileNames.filter((name) => /\.mdx?$/i.test(name)).sort()) {
    const raw = readFileSync(join(directory, fileName), "utf8");
    const post = parseBlogPost(fileName, raw);

    const duplicate = seen.get(post.slug);
    if (duplicate) {
      throw new BlogContentError(
        fileName,
        `le slug « ${post.slug} » est déjà pris par « ${duplicate} ».`,
      );
    }
    seen.set(post.slug, fileName);
    posts.push(post);
  }

  return sortPosts(posts);
}

/** Le catalogue complet, brouillons compris. Lu une seule fois par processus. */
export function allBlogPosts(): BlogPost[] {
  cache ??= loadBlogPosts();
  return cache;
}

/** Vide le cache. Réservé aux tests&nbsp;: rien en production ne réécrit un article en vol. */
export function resetBlogCache(): void {
  cache = null;
}

/**
 * Les brouillons sont lisibles PARTOUT SAUF en production.
 *
 * Un brouillon doit se relire dans son gabarit réel, sinon on relit du texte et
 * pas une page. Mais il ne doit exister nulle part en ligne&nbsp;: ni listé, ni
 * généré, ni dans le flux. La bascule tient à cette seule fonction, ce qui la
 * rend vérifiable d'un coup d'œil.
 */
export function draftsAreVisible(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Les articles publiés, du plus récent au plus ancien. */
export function publishedBlogPosts(): BlogPost[] {
  return publishedOnly(allBlogPosts());
}

/** Ce que le site affiche ici et maintenant&nbsp;: publiés partout, brouillons hors production. */
export function visibleBlogPosts(): BlogPost[] {
  return draftsAreVisible() ? allBlogPosts() : publishedBlogPosts();
}

export function findVisibleBlogPost(slug: string): BlogPost | undefined {
  return visibleBlogPosts().find((post) => post.slug === slug);
}

/** Le journal a-t-il quelque chose à montrer&nbsp;? Décide du `noindex` de l'index. */
export function hasPublishedBlogPosts(): boolean {
  return publishedBlogPosts().length > 0;
}

/**
 * LES ENTRÉES DE PLAN DE SITE&nbsp;: l'index, puis les articles publiés.
 *
 * Volontairement isolée pour être branchée en une ligne dans
 * `src/app/sitemap.ts`, sans que ce fichier ait à savoir ce qu'est un
 * brouillon. Un brouillon ne peut pas atteindre cette liste&nbsp;: le filtre
 * est dans `sitemapEntriesFor`, avec son test.
 *
 * L'INDEX `/blog` EST RENDU ICI, et non découvert par `src/lib/seo/routes.ts`.
 * Ce détecteur lit le TEXTE d'une page pour savoir si elle est indexable, or
 * l'indexabilité de `/blog` est calculée au build (`blogRobots`), donc
 * invisible pour lui. Le module du journal est le seul à savoir si l'index a
 * quelque chose à montrer, et sa date est celle de l'article le plus récent&nbsp;:
 * c'est bien la dernière fois que la page a changé.
 *
 * LE SECOND FILTRE, sur `BLOG_IS_PUBLIC`, existe pour une raison précise&nbsp;:
 * un plan de site ne doit jamais contredire les métadonnées d'une page. Tant
 * que le journal n'est pas ouvert, ses pages se déclarent `noindex`&nbsp;;
 * annoncer ces mêmes URL aux moteurs enverrait deux instructions contraires,
 * ce qui est le meilleur moyen d'obtenir une exploration erratique.
 *
 * Conséquence pratique&nbsp;: la fonction peut être branchée sur le sitemap dès
 * aujourd'hui sans rien exposer. Elle rendra ses entrées le jour où le drapeau
 * passera à `true`, et pas avant.
 */
export function blogSitemapEntries(): BlogSitemapEntry[] {
  if (!BLOG_IS_PUBLIC) return [];

  const posts = sitemapEntriesFor(allBlogPosts(), siteConfig.url);
  // Un index sans article n'a rien à annoncer, et l'annoncer serait promettre
  // une page vide aux moteurs.
  if (posts.length === 0) return [];

  const newest = posts.reduce((latest, post) =>
    post.lastModified > latest.lastModified ? post : latest,
  );

  return [
    {
      url: `${siteConfig.url.replace(/\/+$/, "")}/blog`,
      lastModified: newest.lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...posts,
  ];
}
