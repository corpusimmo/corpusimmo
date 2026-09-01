/**
 * Les documents remis contre une adresse e-mail.
 *
 * Le catalogue est VIDE aujourd'hui, et c'est volontaire : les matrices Excel
 * sont en cours de révision et aucune n'est versionnée. Le mécanisme est prêt,
 * il ne promet simplement rien qu'il ne puisse livrer — une fiche qui annonce
 * un téléchargement inexistant coûte plus cher que pas de fiche du tout.
 *
 * Les fichiers vivent dans `content/aimants/`, **hors de `public/`** : le seul
 * chemin vers un octet passe par la route de téléchargement, qui revérifie le
 * jeton à chaque requête. Un fichier posé dans `public/` serait servi
 * directement par le CDN, sans jamais nous demander notre avis.
 */

export interface Magnet {
  /** Segment d'URL, et valeur liée dans le jeton signé. */
  slug: string;
  title: string;
  /** Une phrase : ce que la personne reçoit. */
  summary: string;
  /** Nom du fichier dans `content/aimants/`. JAMAIS une URL. */
  fileName: string;
  /** Type MIME servi dans la réponse. */
  contentType: string;
  /** Poids lisible, annoncé avant le clic. */
  weight: string;
}

export const magnets: Magnet[] = [];

export function getMagnet(slug: string): Magnet | undefined {
  return magnets.find((magnet) => magnet.slug === slug);
}
