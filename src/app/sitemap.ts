import type { MetadataRoute } from "next";

import { canonicalUrl } from "@/lib/seo/metadata";
import { indexableRoutes } from "@/lib/seo/routes";

/**
 * LE PLAN DU SITE, dérivé et non recopié.
 *
 * Ce fichier ne contient aucune liste d'URL, et c'est tout l'intérêt. Il pose
 * une question à `src/lib/seo/routes.ts` — « quelles pages existent, et
 * lesquelles se déclarent indexables ? » — et écrit la réponse. L'inventaire
 * est lu dans l'arborescence `src/app/**`, dans le catalogue d'outils et dans
 * la navigation ; les dates viennent du système de fichiers.
 *
 * Conséquence directe, et c'est la seule qui compte : une page ajoutée demain
 * entre au sitemap sans que personne n'y pense, et une page passée en `noindex`
 * en sort par le même mécanisme. Le sitemap ne peut plus contredire les
 * métadonnées d'une page, puisqu'il les lit.
 *
 * Le garde-fou est dans `src/app/sitemap.test.ts` : il vérifie qu'aucune page
 * hors index n'y figure, que les dix fiches outils y sont toutes, et qu'aucune
 * URL n'est relative ni dupliquée.
 */

/**
 * Le sitemap est écrit AU BUILD, jamais servi dynamiquement.
 *
 * `routes.ts` lit `src/app/**` avec `node:fs` : à l'exécution sur Vercel, ces
 * fichiers ne sont pas dans le bundle. Figer le rendu ici rend l'erreur
 * impossible plutôt que rare.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = indexableRoutes().map((route) => ({
    url: canonicalUrl(route.path),
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  /*
   * POINT D'EXTENSION — LE BLOG.
   *
   * `src/lib/blog/` est livré en parallèle et exposera `blogSitemapEntries()`.
   * Quand ce module existera, le branchement tient en deux lignes, ici :
   *
   *     import { blogSitemapEntries } from "@/lib/blog";
   *     routes.push(...blogSitemapEntries());
   *
   * Il n'est pas importé aujourd'hui parce qu'un import d'un module absent
   * casse le build entier, pour toutes les pages. Le préfixe `/blog` est par
   * ailleurs écarté de la découverte automatique (voir `EXCLUDED_PREFIXES`
   * dans `src/lib/seo/routes.ts`) : sans énumération des articles, elle
   * produirait l'URL littérale « /blog/[slug] », ce qui serait pire que rien.
   *
   * Trois choses à respecter au branchement, elles sont testées :
   * des URL absolues sur le domaine canonique, aucun doublon, aucun brouillon.
   */

  return routes;
}
