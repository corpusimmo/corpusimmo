/**
 * Le contrat d'un article du journal.
 *
 * Un article n'est pas une page&nbsp;: c'est un FICHIER Markdown posé dans
 * `src/content/blog/`, dont l'en-tête déclare tout ce que le site a besoin de
 * savoir pour le classer, le dater, le relier et le référencer. Publier tient
 * alors en une ligne changée dans ce fichier, sans toucher au code.
 *
 * Deux couches, séparées comme pour les outils&nbsp;:
 *   · le FICHIER, écrit à la main, faillible, validé à la lecture
 *     (`src/lib/blog/post.ts`)&nbsp;;
 *   · le `BlogPost` ci-dessous, garanti complet, que le reste du site consomme
 *     sans jamais revérifier.
 *
 * Tout ce qui vient du disque passe par cette frontière. C'est ce qui permet à
 * une page de faire confiance à `post.publishedAt` sans se demander si
 * quelqu'un a écrit « demain » dans l'en-tête.
 */

/**
 * Le statut d'un article, et le seul interrupteur de publication.
 *
 * `draft` n'est pas « caché »&nbsp;: un brouillon n'existe tout simplement pas
 * en production. Il n'est ni généré, ni listé, ni dans le flux, ni dans le plan
 * du site. Il reste visible en développement pour être relu.
 */
export type BlogStatus = "draft" | "published";

/**
 * Les rubriques, fermées volontairement.
 *
 * Une catégorie inventée dans un en-tête de fichier ferait tomber la lecture
 * avec un message explicite, plutôt que de créer une rubrique fantôme peuplée
 * d'un seul article. Les étiquettes, elles, restent libres.
 */
export type BlogCategoryId = "methode" | "donnees" | "marche" | "pratique";

export interface BlogAuthor {
  name: string;
  /** Fonction affichée sous la signature. Facultative. */
  role?: string;
}

export interface BlogPost {
  /** Segment d'URL sous `/blog/`. Par défaut, le nom du fichier sans extension. */
  slug: string;
  title: string;
  /** Le chapeau&nbsp;: une à trois phrases. Sert aussi de méta-description et de description RSS. */
  excerpt: string;
  /** Date de publication, au format `AAAA-MM-JJ`. */
  publishedAt: string;
  /** Date de dernière mise à jour. Égale à la publication tant que rien n'a bougé. */
  updatedAt: string;
  author: BlogAuthor;
  category: BlogCategoryId;
  /** Étiquettes libres, normalisées en minuscules et dédoublonnées. */
  tags: string[];
  /** Temps de lecture en minutes, CALCULÉ à partir du corps, jamais déclaré. */
  readingMinutes: number;
  status: BlogStatus;
  /** Chemin d'une image sociale, relatif au domaine (`/og/...`). Facultatif. */
  socialImage?: string;
  /**
   * Articles liés déclarés à la main, dans l'ordre voulu. Les slugs inconnus ou
   * non publiés sont ignorés à la lecture&nbsp;: un lien mort ne casse rien.
   */
  related: string[];
  /** Le corps de l'article, en Markdown brut. */
  body: string;
  /** Le fichier d'origine. Sert uniquement aux messages d'erreur de lecture. */
  sourceFile: string;
}

/**
 * Une entrée de plan de site, telle que `blogSitemapEntries()` la produit.
 *
 * La forme est celle qu'attend `MetadataRoute.Sitemap`, sans importer les types
 * de Next dans une couche qui doit rester testable hors framework.
 */
export interface BlogSitemapEntry {
  url: string;
  lastModified: Date;
  /** `weekly` pour l'index, qui bouge à chaque publication ; `monthly` pour un article. */
  changeFrequency: "weekly" | "monthly";
  priority: number;
}
