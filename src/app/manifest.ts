import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * LE MANIFESTE — ce qui transforme le site en application installable.
 *
 * Convention de fichier Next : cette route produit `/manifest.webmanifest` et
 * la balise `<link rel="manifest">` est posée toute seule dans le document.
 * Il n'y a RIEN à ajouter dans `layout.tsx` pour ce fichier.
 *
 * LA SEULE EXCEPTION À LA RÈGLE DES TOKENS — `background_color` et
 * `theme_color` sont écrits en dur, comme les couleurs de `src/app/icon.svg`,
 * et pour la même raison : un manifeste est lu par le système d'exploitation
 * bien avant qu'une feuille de style existe. Personne ici ne peut résoudre
 * `var(--canvas)`. Ces deux valeurs doivent donc être tenues à la main si la
 * palette bouge :
 *   #f6f5f2 → `--canvas`  (l'écran d'attente au lancement)
 *   #1b3349 → `--primary` (la barre système ; même valeur que le `themeColor`
 *                          du `viewport` dans `layout.tsx`)
 *
 * Rien n'est lu ici qui dépende de la requête : la route reste statique.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Un identifiant explicite et stable. Sans lui, l'identité de
    // l'application est déduite de `start_url` : le jour où celle-ci change,
    // le système croit à une SECONDE application et en installe une deuxième
    // à côté de la première.
    id: "/",
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    lang: "fr",
    dir: "ltr",

    start_url: "/",
    scope: "/",

    display: "standalone",
    // `minimal-ui` garde les flèches précédent/suivant du navigateur. C'est le
    // repli souhaitable là où `standalone` n'existe pas : sur un site qui se
    // parcourt en profondeur, perdre le bouton retour est une régression.
    display_override: ["standalone", "minimal-ui"],
    // Surtout pas de verrouillage en portrait : la carte DVF et les tableaux
    // de mutations se lisent en paysage.
    orientation: "any",

    background_color: "#f6f5f2",
    theme_color: "#1b3349",
    categories: ["business", "finance", "utilities"],

    icons: [
      // `any` : le carré aux angles courts, exactement la favicon. C'est le
      // tirage que le bureau affiche tel quel.
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },

      // `maskable` : le même signe, plein bord, dessiné pour être ROGNÉ.
      // Android applique son propre masque (cercle, goutte, carré arrondi) et
      // ne garantit que le disque central de 80 %. Le motif y tient à 90 % du
      // rayon utile : il survit au cercle, qui est le masque le plus sévère.
      {
        src: "/icons/icone-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    // Les deux gestes qui justifient d'installer : estimer, et consulter le
    // marché. Ils apparaissent sur un appui long sur l'icône.
    shortcuts: [
      {
        name: "Estimer un bien",
        short_name: "Estimer",
        description: "Lancer une estimation à partir des ventes enregistrées.",
        url: "/estimer",
        icons: [{ src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Observatoire du marché",
        short_name: "Observatoire",
        description: "Explorer les mutations DVF et les indicateurs de marché.",
        url: "/observatoire",
        icons: [{ src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
