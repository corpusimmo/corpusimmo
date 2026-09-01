import { PROPERTY_TYPE_LABELS } from "@/types/property";
import type { DvfPropertyType } from "@/types/dvf";

/**
 * Les familles DVF → les libellés que le produit emploie déjà ailleurs.
 *
 * Sorti de `comparables-cart.tsx` pour que l'export CSV — un module sans UI —
 * puisse nommer un type de bien sans importer un composant client entier.
 */
const DVF_TYPE_LABELS: Record<DvfPropertyType, string> = {
  apartment: PROPERTY_TYPE_LABELS.apartment,
  house: PROPERTY_TYPE_LABELS.house,
  land: PROPERTY_TYPE_LABELS.land,
  commercial: "Local commercial ou industriel",
  dependency: "Dépendance",
  other: PROPERTY_TYPE_LABELS.other,
};

export function dvfTypeLabel(type: DvfPropertyType): string {
  return DVF_TYPE_LABELS[type];
}
