import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * LES TYPOLOGIES D’ACTIF, DANS LA GRAMMAIRE DU LOGOTYPE.
 *
 * Même grille de 32 que `BrandMark`, mêmes jonctions arrondies, même trait.
 * Une icône de typologie n’est pas un pictogramme décoratif : elle sert de
 * repère dans le sélecteur de l’estimateur, dans les filtres de l’observatoire
 * et dans les fiches d’outil. Elle doit donc se lire à 20 px.
 *
 * LE TRAIT — 2 unités sur une grille de 32, soit exactement 1,5 px quand
 * l’icône est rendue à 24 px, la taille standard d’une icône dans ce produit.
 * C’est le poids de `lucide-react` avec `strokeWidth={1.5}` : les deux familles
 * cohabitent sans qu’aucune ne paraisse plus grasse que l’autre. Les icônes
 * lucide de ce projet doivent donc recevoir `strokeWidth={1.5}` là où elles
 * voisinent avec celles-ci. `strokeWidth` reste réglable si un contexte exige
 * le poids par défaut de lucide (2 sur 24, soit 2,67 ici).
 *
 * LA COULEUR — `currentColor`, sans exception. L’icône prend la couleur du
 * texte qui l’entoure, donc le token de ce texte, donc la marque.
 */

export type AssetIconName =
  | "apartment"
  | "house"
  | "land"
  | "building"
  | "office"
  | "retail"
  | "business_premises"
  | "warehouse"
  | "parking";

export interface AssetIconProps {
  className?: string;
  /**
   * Le libellé accessible. En son absence l’icône est DÉCORATIVE
   * (`aria-hidden`) : c’est le cas normal, puisqu’un libellé texte
   * l’accompagne presque toujours.
   */
  label?: string;
  /** 2 = 1,5 px à 24 px. Monter à 2,67 pour épouser lucide par défaut. */
  strokeWidth?: number;
}

/** Les libellés français, source unique pour les légendes et les tests. */
export const assetTypeIconLabels: Record<AssetIconName, string> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  building: "Immeuble",
  office: "Bureaux",
  retail: "Commerce",
  business_premises: "Local d’activité",
  warehouse: "Entrepôt",
  parking: "Parking",
};

function IconFrame({
  className,
  label,
  strokeWidth = 2,
  children,
}: AssetIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={cn("size-6 shrink-0", className)}
    >
      {label ? <title>{label}</title> : null}
      {children}
    </svg>
  );
}

/**
 * APPARTEMENT — un lot dans un immeuble, pas l’immeuble.
 * Le carré plein est la seule zone remplie de toute la famille : c’est lui qui
 * dit « une unité parmi d’autres » sans écrire le mot.
 */
export function AssetIconApartment(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="7" y="5" width="18" height="22" rx="2" />
      <path d="M7 12.5h18M7 19.5h18" />
      <rect x="9.6" y="14.6" width="6.4" height="3.8" rx="0.8" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

/**
 * MAISON — le toit, les murs et le sol du logotype, à l’identique.
 * C’est volontaire : la marque doit se reconnaître dans le jeu d’icônes.
 */
export function AssetIconHouse(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 16 16 6l11.5 10" />
      <path d="M8 15.5V27h16V15.5" />
      <path d="M13.6 27v-6.4h4.8V27" />
    </IconFrame>
  );
}

/**
 * TERRAIN — une parcelle cadastrale : un contour tireté et ses bornes.
 * Rien de bâti, aucune végétation : ce qui se vend ici est un périmètre.
 */
export function AssetIconLand(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 22.5 8.5 7.5 27 10.5 23.5 25.5Z" strokeDasharray="3.2 2.6" />
      <g fill="currentColor" stroke="none">
        <circle cx="5" cy="22.5" r="1.6" />
        <circle cx="8.5" cy="7.5" r="1.6" />
        <circle cx="27" cy="10.5" r="1.6" />
        <circle cx="23.5" cy="25.5" r="1.6" />
      </g>
    </IconFrame>
  );
}

/**
 * IMMEUBLE — deux volumes de hauteurs différentes.
 * La distinction avec l’appartement tient à ça : plusieurs corps de bâtiment,
 * et aucun lot désigné. On achète le tout.
 */
export function AssetIconBuilding(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 27V7.5h12V27" />
      <path d="M17 27V14h10v13" />
      <path d="M5 27h22" />
      <path d="M8.5 12.5h5M8.5 18h5M8.5 23.5h5M20 19h4M20 24h4" />
    </IconFrame>
  );
}

/**
 * BUREAUX — la façade rideau : des bandeaux EN RETRAIT des rives, là où
 * l’appartement porte des planchers qui vont de mur à mur. C’est cette
 * différence-là, plus la porte d’entrée, qui sépare les deux silhouettes.
 */
export function AssetIconOffice(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="5" y="7" width="22" height="20" rx="1.5" />
      <path d="M8.5 12h15M8.5 17h15" />
      <path d="M13 27v-5.6h6V27" />
    </IconFrame>
  );
}

/**
 * COMMERCE — un pied d’immeuble : le plancher haut, le store, la vitrine.
 * Le trait du haut n’est pas un toit, c’est la dalle de l’étage au-dessus.
 */
export function AssetIconRetail(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 6.5h24" />
      <path d="M5.5 14 8.5 10h15l3 4Z" />
      <path d="M7 14v13h18V14" />
      <path d="M13.5 27v-7.5h5V27" />
    </IconFrame>
  );
}

/**
 * LOCAL D’ACTIVITÉ — une toiture à un seul pan et un rideau métallique.
 * C’est la silhouette réelle d’un atelier de zone d’activité.
 */
export function AssetIconBusinessPremises(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 13 28 8.5" />
      <path d="M6 12.6V27h20V11.2" />
      <path d="M11 27v-9h10v9" />
      <path d="M11 21.5h10M11 24.5h10" />
    </IconFrame>
  );
}

/**
 * ENTREPÔT — un volume bas à toit plat, une casquette de quai, deux portes.
 * Les quais sont ce qui distingue la logistique de tout le reste du bâti.
 */
export function AssetIconWarehouse(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 11h24" />
      <path d="M6 11v16h20V11" />
      <path d="M6.5 17.5h19" />
      <path d="M9.5 27v-5.5h5V27M17.5 27v-5.5h5V27" />
    </IconFrame>
  );
}

/**
 * PARKING — la lettre, parce que c’est le seul signe universel du stationnement.
 * Elle est TRACÉE, jamais composée : une icône ne doit pas dépendre d’une
 * police, et un `<text>` casserait à la première substitution de fonte.
 */
export function AssetIconParking(props: AssetIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="5" y="5" width="22" height="22" rx="4" />
      <path d="M13 22.5V10h4.4a3.6 3.6 0 0 1 0 7.2H13" />
    </IconFrame>
  );
}

/** Le registre, pour itérer sur la famille sans la réécrire. */
export const assetTypeIcons: Record<AssetIconName, ComponentType<AssetIconProps>> = {
  apartment: AssetIconApartment,
  house: AssetIconHouse,
  land: AssetIconLand,
  building: AssetIconBuilding,
  office: AssetIconOffice,
  retail: AssetIconRetail,
  business_premises: AssetIconBusinessPremises,
  warehouse: AssetIconWarehouse,
  parking: AssetIconParking,
};

/** Le point d’entrée quand la typologie est une donnée et non un choix d’écriture. */
export function AssetTypeIcon({ name, ...props }: AssetIconProps & { name: AssetIconName }) {
  const Icon = assetTypeIcons[name];
  return <Icon {...props} />;
}
