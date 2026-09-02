import Image from "next/image";

import type { PropertyUsage, WizardPropertyType } from "./wizard-state";

/**
 * LE FOND DU PARCOURS, QUI SUIT CE QU'ON ESTIME.
 *
 * Un formulaire de six écrans sur un fond uni ne dit jamais où l'on en est.
 * Ici, le fond répond au type de bien choisi : commerce, la vitrine ; entrepôt,
 * les quais de chargement. C'est un accusé de réception visuel, et il arrive
 * exactement au moment où la réponse vient d'être donnée.
 *
 * TROIS PRÉCAUTIONS, dont deux ne sont pas négociables.
 *
 * 1. L'IMAGE RESTE SOUS UN VOILE DE CANVAS, et le formulaire vit dans des
 *    cartes opaques. Le voile est plus dense en haut, là où le titre et le
 *    chapeau sont posés à même le fond ; il s'ouvre en bas, où il n'y a plus
 *    que des cartes. Un champ de saisie posé sur une photographie est un champ
 *    qu'on relit deux fois : il n'y en a aucun ici.
 * 2. ELLE EST DÉCORATIVE (`alt=""`, `aria-hidden`). Elle illustre une
 *    CATÉGORIE, jamais le bien de la personne, et surtout jamais à côté du
 *    prix : le résultat, lui, n'en porte aucune (docs/images.md).
 * 3. `position: fixed` : le fond ne défile pas avec le formulaire. Un décor
 *    qui glisse pendant qu'on remplit un champ attire l'œil pour rien.
 *
 * Une seule image est montée à la fois, remplacée par sa `key` : garder dix
 * calques empilés pour un fondu coûterait dix téléchargements sur mobile.
 */

/** Le fond par typologie. Les clés sont celles de `WizardPropertyType`. */
const BY_TYPE: Record<WizardPropertyType, string> = {
  apartment: "/illustrations/bien-appartement-ancien.webp",
  house: "/illustrations/bien-maison.webp",
  land: "/illustrations/bien-terrain.webp",
  office: "/illustrations/bien-bureaux.webp",
  retail: "/illustrations/bien-commerce.webp",
  business_premises: "/illustrations/bien-local-activite.webp",
  // « Autre » ne désigne rien de précis — immeuble, entrepôt, parking se
  // cachent derrière — donc il garde une vue de ville, qui n'affirme aucune
  // typologie plutôt que d'en affirmer une fausse.
  other: "/illustrations/ville-toits.webp",
};

/** Avant le type, l'usage suffit à donner le registre. */
const BY_USAGE: Record<PropertyUsage, string> = {
  residential: "/illustrations/ville-rue-fenetre.webp",
  professional: "/illustrations/interieur-bureaux-plateau.webp",
};

/** Et avant toute réponse : une ville, ni résidentielle ni professionnelle. */
const DEFAULT_SRC = "/illustrations/ville-moyenne-aerienne.webp";

export function backdropSrc(
  type: WizardPropertyType | null,
  usage: PropertyUsage | null,
): string {
  if (type) return BY_TYPE[type] ?? DEFAULT_SRC;
  if (usage) return BY_USAGE[usage];
  return DEFAULT_SRC;
}

export function EstimatorBackdrop({
  type,
  usage,
}: {
  type: WizardPropertyType | null;
  usage: PropertyUsage | null;
}) {
  const src = backdropSrc(type, usage);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <Image
        key={src}
        src={src}
        alt=""
        fill
        sizes="100vw"
        className="animate-fade-in object-cover object-center opacity-[0.28]"
      />
      {/* Le voile : opaque en haut, où vit le formulaire, ouvert en bas. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--canvas)_0%,color-mix(in_srgb,var(--canvas)_88%,transparent)_28%,color-mix(in_srgb,var(--canvas)_78%,transparent)_60%,color-mix(in_srgb,var(--canvas)_84%,transparent)_100%)]" />
    </div>
  );
}
