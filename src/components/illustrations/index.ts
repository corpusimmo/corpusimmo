/**
 * Illustrations natives : du SVG en ligne, zéro dépendance, zéro requête.
 *
 * Trois règles tiennent toute la bibliothèque :
 *
 *  - AUCUNE COULEUR EN DUR. Les schémas consomment les tokens par les
 *    utilitaires Tailwind (`fill-ink`, `stroke-accent-rule`, `fill-brand-200`),
 *    les icônes consomment `currentColor`. Changer la marque reste une
 *    modification de `globals.css`, et de rien d’autre.
 *  - AUCUN `id` SVG n’est émis : ni dégradé, ni marqueur, ni masque. Deux
 *    schémas posés sur la même page ne peuvent donc pas se voler leurs
 *    définitions.
 *  - AUCUN ÉTAT, AUCUN HOOK : tout est rendu côté serveur.
 *
 * FIDÉLITÉ — les schémas de méthode décrivent le moteur réel
 * (`src/lib/valuation/`, `docs/valuation-engine.md`). Là où un schéma
 * simplifie, sa légende le dit. La table de correspondance page par page est
 * dans `docs/illustrations.md`.
 */

export { DiagramFigure, ArrowRight } from "./frame";
export type { DiagramProps, DiagramFigureProps } from "./frame";

export { MethodDiagram } from "./method-diagram";
export { RadiusEscalation } from "./radius-escalation";
export { WeightingDiagram } from "./weighting-diagram";
export { ConfidenceBand } from "./confidence-band";
export { DeveloperBalance } from "./developer-balance";
export { WaultDiagram } from "./wault-diagram";

export {
  AssetTypeIcon,
  assetTypeIcons,
  assetTypeIconLabels,
  AssetIconApartment,
  AssetIconHouse,
  AssetIconLand,
  AssetIconBuilding,
  AssetIconOffice,
  AssetIconRetail,
  AssetIconBusinessPremises,
  AssetIconWarehouse,
  AssetIconParking,
} from "./asset-type-icons";
export type { AssetIconName, AssetIconProps } from "./asset-type-icons";
