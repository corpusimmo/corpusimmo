import type { MetadataRoute } from "next";

import { citiesSitemapEntries } from "@/lib/cities";
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
   * POINT D'EXTENSION — LE JOURNAL.
   *
   * `src/lib/blog/` a atterri pendant l'écriture de ce fichier et expose bien
   * `blogSitemapEntries()`. Le branchement tient en deux lignes, ici :
   *
   *     import { blogSitemapEntries } from "@/lib/blog";
   *     routes.push(...blogSitemapEntries());
   *
   * Il n'est PAS fait dans cette livraison, sur consigne : le journal est écrit
   * en parallèle et son auteur reste maître de son ouverture. La fonction rend
   * de toute façon un tableau vide tant que `BLOG_IS_PUBLIC` vaut `false`, donc
   * brancher aujourd'hui n'exposerait rien.
   *
   * DEUX POINTS À RÉGLER AU BRANCHEMENT, et ils ne sont pas cosmétiques :
   *
   *   · `blogSitemapEntries()` ne rend que les ARTICLES, pas l'index `/blog`.
   *     Celui-ci doit donc être ajouté, ici ou là-bas, sans quoi la page de
   *     tête du journal n'entrera jamais dans le plan de site.
   *   · `/blog` est écarté de la découverte automatique (voir
   *     `EXCLUDED_PREFIXES` dans `src/lib/seo/routes.ts`) pour deux raisons :
   *     l'énumération des articles n'est pas de son ressort, et l'indexabilité
   *     de `/blog` est CALCULÉE au build (`blogRobots(...)`) au lieu d'être
   *     écrite dans le source. Le détecteur de `noindex`, qui lit le texte du
   *     fichier, ne peut donc pas la voir : l'inclure de force ferait dire au
   *     sitemap l'inverse de ce que la page dit aux moteurs.
   *
   * Le reste des garanties du fichier (URL absolues, aucun doublon, aucune page
   * hors index) couvrira les entrées du journal sans une ligne de plus, parce
   * qu'elles sont vérifiées sur la sortie de cette fonction.
   */

  /**
   * LES PAGES VILLES, énumérées par leur propre module.
   *
   * Elles sont écartées de la découverte automatique (`EXCLUDED_PREFIXES`) pour
   * la même raison que le journal : le motif `/prix-immobilier/[ville]` ne se
   * résout pas tout seul, et c'est `src/lib/cities/` qui sait quelles communes
   * ont assez de ventes pour mériter une page. Une commune sous le seuil n'a
   * pas de page, donc pas d'entrée : le plan de site suit cette décision au
   * lieu de la doubler.
   *
   * `citiesSitemapEntries()` rend le sommaire ET les communes retenues : un
   * seul ajout suffit, contrairement au journal.
   */
  routes.push(...citiesSitemapEntries());

  return routes;
}
