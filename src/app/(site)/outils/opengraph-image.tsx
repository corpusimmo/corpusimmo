/**
 * L'image sociale de la bibliothèque d'outils, héritée par les dix fiches.
 *
 * Une image par fiche serait plus flatteuse et ne dirait rien de plus : à la
 * taille d'une vignette de partage, le nom de l'outil est déjà porté par le
 * titre du lien. Une seule image pour la section suffit, et se maintient.
 */

import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = "Les dix outils de calcul immobilier de CorpusImmo";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OutilsOpengraphImage() {
  return renderOgImage({
    eyebrow: "Bibliothèque",
    title: "Dix outils de calcul, ouverts",
    subtitle: "Les hypothèses de calcul sont affichées, modifiables et datées.",
  });
}
