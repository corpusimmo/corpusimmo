import type { MetadataRoute } from "next";

import { unpublishedNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { canonicalUrl } from "@/lib/seo/metadata";

/**
 * CE QUI EST FERMÉ AUX ROBOTS, ET POURQUOI.
 *
 * Quatre motifs, et aucun « au cas où » : chaque ligne ci-dessous coûte des
 * pages à l'index, ce qu'un domaine neuf ne peut pas dépenser sans raison.
 *
 * 1. LE SECRET DVF. `/observatoire/comparables` porte des mutations détaillées,
 *    adresse comprise : le décret du 28/12/2018 en interdit l'indexation. Les
 *    routes `/api/*` servent la même donnée en JSON et ne rendent rien de
 *    lisible ; elles portent déjà `X-Robots-Tag`, ceci est la seconde ceinture.
 *
 * 2. RIEN À INDEXER. `/mon-espace` et `/connexion` sont des écrans de service :
 *    un robot n'y voit qu'un état vide ou un bouton de connexion.
 *
 * 3. PAS DE CONTENU PROPRE. La route `/outils/[slug]/calculer` est le
 *    calculateur lui-même, derrière une connexion et un quota. Sa fiche
 *    publique, elle, dit tout ce qu'il y a à dire et reste indexable : ce sont
 *    les fiches qui travaillent, pas les formulaires.
 *
 * 4. PAS ENCORE PUBLIÉ. Les offres professionnelles sont écrites mais l'offre
 *    n'est pas ouverte ; la liste est LUE dans `unpublishedNav`, jamais
 *    recopiée. Le jour où elle remonte dans le menu, ce fichier s'ouvre tout
 *    seul.
 *
 * NUANCE, parce qu'elle compte : un `Disallow` empêche l'exploration, donc
 * empêche aussi de LIRE le `noindex` de la page. Les deux sont posés ensemble
 * ici parce que ces pages ne reçoivent presque aucun lien entrant ; sur une
 * page très liée, il faudrait choisir le `noindex` seul.
 */
export default function robots(): MetadataRoute.Robots {
  // Un préfixe suffit : `Disallow: /solutions` couvre tout le sous-arbre.
  const unpublished = unpublishedNav.map((entry) => entry.href);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/connexion",
          "/mon-espace",
          "/observatoire/comparables",
          // Le joker médian est compris par Google et Bing ; les fiches
          // `/outils/<slug>` restent explorables, seul le calculateur est fermé.
          "/outils/*/calculer",
          ...unpublished,
        ],
      },
    ],
    sitemap: canonicalUrl("/sitemap.xml"),
    host: siteConfig.url,
  };
}
