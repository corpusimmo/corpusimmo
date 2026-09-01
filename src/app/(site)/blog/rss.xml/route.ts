/**
 * LE FLUX RSS DU JOURNAL, articles publiés uniquement.
 *
 * `force-static` n'est pas une optimisation, c'est la condition pour que ce
 * fichier respecte l'invariant du dépôt. Depuis Next&nbsp;15, un gestionnaire
 * de route est dynamique par défaut&nbsp;: sans cette ligne, chaque appel
 * relirait le dossier d'articles sur le disque, en production, à chaud. Le flux
 * est ici construit une fois, au build, comme les pages qu'il annonce.
 *
 * Le flux ne connaît que les articles PUBLIÉS, en développement comme en
 * production. C'est le seul endroit du journal où la règle est plus stricte
 * qu'ailleurs, et c'est volontaire&nbsp;: un flux se copie, se met en cache et
 * se rediffuse sans notre accord. Un brouillon qui y entrerait une seule minute
 * n'en sortirait plus.
 *
 * Le document lui-même est assemblé par `blogRssFeed()`, qui est testé.
 */

import { siteConfig } from "@/config/site";
import { blogRssFeed, publishedBlogPosts } from "@/lib/blog";

export const dynamic = "force-static";

export function GET(): Response {
  const xml = blogRssFeed({
    posts: publishedBlogPosts(),
    baseUrl: siteConfig.url,
    title: `Le journal ${siteConfig.name}`,
    description:
      "Méthode d'estimation, lecture des données publiques de transaction et limites assumées.",
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      // Le flux est reconstruit à chaque déploiement : un cache d'une heure au
      // bord suffit, et évite qu'un agrégateur bavard frappe l'origine.
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
