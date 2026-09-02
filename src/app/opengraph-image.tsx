/**
 * L'image sociale par défaut, héritée par toute page qui n'en déclare pas.
 *
 * Elle est produite au build : aucune requête ne la recalcule, et elle ne coûte
 * donc rien à l'exécution. La composition vit dans `src/lib/seo/og-image.tsx`,
 * y compris l'explication des couleurs écrites en dur.
 */

import { siteConfig } from "@/config/site";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt =
  "CorpusImmo : estimer, comparer, décider sur les ventes réellement enregistrées";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgImage({
    // Le titre est la SIGNATURE : c'est la seule vignette du site où l'on
    // dispose de six cents pixels de large pour la faire lire en entier, et
    // c'est là qu'elle travaille le plus — une carte de partage est vue par
    // des gens qui ne connaissent pas encore le nom.
    eyebrow: "Estimation, carte des ventes, observatoire",
    title: siteConfig.signature,
    subtitle:
      "Sur les mutations enregistrées par la DGFiP et publiées en open data. Partout en France.",
  });
}
