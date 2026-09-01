/**
 * L'image sociale par défaut, héritée par toute page qui n'en déclare pas.
 *
 * Elle est produite au build : aucune requête ne la recalcule, et elle ne coûte
 * donc rien à l'exécution. La composition vit dans `src/lib/seo/og-image.tsx`,
 * y compris l'explication des couleurs écrites en dur.
 */

import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = "CorpusImmo, estimation immobilière à partir des ventes réellement enregistrées";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Estimation et données publiques",
    title: "Ce qui s'est vraiment vendu, et à quel prix",
    subtitle: "Des prix payés, portés à un acte, plutôt que des prix demandés.",
  });
}
