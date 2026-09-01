/**
 * L'image sociale de l'observatoire, héritée par la recherche de transactions.
 *
 * Aucune donnée chiffrée n'y figure : une image est mise en cache pendant un an
 * par les réseaux qui la relaient, et un prix médian affiché dessus serait faux
 * bien avant d'être remplacé.
 */

import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = "L'observatoire du marché immobilier de CorpusImmo";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function ObservatoireOpengraphImage() {
  return renderOgImage({
    eyebrow: "Observatoire",
    title: "Le marché, à l'échelle de la rue",
    subtitle: "Prix au m², volumes et dispersion, sur les ventes réellement enregistrées.",
  });
}
