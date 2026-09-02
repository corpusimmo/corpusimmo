import { Check, MapPin } from "lucide-react";

import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import {
  PROJECT_INTENT_LABELS,
  PROPERTY_CONDITION_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyType,
} from "@/types/property";

import type { WizardState } from "./wizard-state";

/**
 * LA CARTE D'IDENTITÉ DU BIEN, qui se remplit au fil des étapes.
 *
 * Un parcours en six écrans efface ce qu'on vient de répondre : l'écran
 * suivant remplace le précédent, et il faut revenir en arrière pour vérifier
 * une surface. Cette carte est la mémoire visible du parcours. Elle sert trois
 * choses à la fois : on voit ce qu'on a déjà donné, on voit ce qui reste, et
 * on voit une faute de saisie AVANT le calcul plutôt qu'après.
 *
 * CE QU'ELLE NE FAIT PAS. Elle n'est pas un formulaire : rien ne s'y modifie,
 * les corrections passent par « Retour ». Deux endroits pour saisir la même
 * chose, c'est deux endroits pour se contredire. Et elle ne porte AUCUN
 * chiffre de marché : la valeur n'existe pas encore, et un ordre de grandeur
 * affiché avant le calcul serait une promesse.
 *
 * LES COORDONNÉES N'Y FIGURENT PAS. Le nom, l'adresse e-mail et le téléphone
 * sont demandés à la dernière étape ; les répéter dans un encadré fixe, sur un
 * écran parfois partagé, ne rend service à personne.
 */

/** Le pictogramme de typologie, quand la famille en a un. */
const ICONS: Partial<Record<PropertyType, AssetIconName>> = {
  apartment: "apartment",
  house: "house",
  land: "land",
  building: "building",
  office: "office",
  retail: "retail",
  business_premises: "business_premises",
  parking: "parking",
};

interface Row {
  label: string;
  value: string;
}

/** Une surface saisie, rendue lisible. Les nombres sont des chaînes ici. */
function area(value: string, unit: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return `${new Intl.NumberFormat("fr-FR").format(parsed)} ${unit}`;
}

function count(value: string, one: string, many: string): string | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return `${parsed} ${parsed > 1 ? many : one}`;
}

const OUTDOOR_LABELS: Record<string, string> = {
  none: "Sans extérieur",
  balcony: "Balcon",
  terrace: "Terrasse",
  garden: "Jardin",
};

const OCCUPANCY_LABELS: Record<string, string> = {
  occupied: "Occupé",
  vacant: "Vacant",
};

/**
 * Ce qui est ACQUIS, dans l'ordre où on l'a demandé.
 *
 * Exporté pour être éprouvé : la carte ne doit jamais afficher une ligne pour
 * une réponse qui n'a pas été donnée, et c'est exactement ce qu'un test peut
 * vérifier sans monter le composant.
 */
export function propertyRows(state: WizardState): Row[] {
  const rows: Row[] = [];
  const f = state.features;

  if (state.usage) {
    rows.push({
      label: "Usage",
      value: state.usage === "professional" ? "Professionnel" : "Résidentiel",
    });
  }

  const resolvedType = state.type === "other" ? state.otherType : state.type;
  if (state.type) {
    rows.push({
      label: "Type de bien",
      value: resolvedType ? PROPERTY_TYPE_LABELS[resolvedType] : "Autre",
    });
  }

  const living = area(f.livingArea, "m²");
  if (living) rows.push({ label: "Surface", value: living });

  const land = area(f.landArea, "m²");
  if (land) rows.push({ label: "Terrain", value: land });

  const rooms = count(f.rooms, "pièce", "pièces");
  if (rooms) rows.push({ label: "Pièces", value: rooms });

  const bedrooms = count(f.bedrooms, "chambre", "chambres");
  if (bedrooms) rows.push({ label: "Chambres", value: bedrooms });

  if (f.floor.trim()) {
    const floor = Number(f.floor.trim());
    if (Number.isFinite(floor)) {
      rows.push({
        label: "Étage",
        value: floor === 0 ? "Rez-de-chaussée" : `${floor}ᵉ étage`,
      });
    }
  }

  const outdoor = f.outdoor ? OUTDOOR_LABELS[f.outdoor] : undefined;
  if (outdoor) rows.push({ label: "Extérieur", value: outdoor });

  if (f.condition && f.condition in PROPERTY_CONDITION_LABELS) {
    rows.push({
      label: "État",
      value:
        PROPERTY_CONDITION_LABELS[
          f.condition as keyof typeof PROPERTY_CONDITION_LABELS
        ],
    });
  }

  const occupancy = f.occupancy ? OCCUPANCY_LABELS[f.occupancy] : undefined;
  if (occupancy) rows.push({ label: "Occupation", value: occupancy });

  const rent = area(f.annualRent, "€/an");
  if (rent) rows.push({ label: "Loyer annuel", value: rent });

  if (state.intent) {
    rows.push({ label: "Projet", value: PROJECT_INTENT_LABELS[state.intent] });
  }

  return rows;
}

/** Les commodités, qui se lisent mieux en pastilles qu'en lignes. */
function amenities(state: WizardState): string[] {
  const f = state.features;
  const list: string[] = [];
  if (f.hasElevator) list.push("Ascenseur");
  if (f.hasParking) list.push("Stationnement");
  if (f.hasGarage) list.push("Garage");
  if (f.divisible) list.push("Divisible");
  const spaces = count(f.parkingSpaces, "place", "places");
  if (spaces) list.push(spaces);
  return list;
}

export function PropertyCard({ state }: { state: WizardState }) {
  const rows = propertyRows(state);
  const chips = amenities(state);
  const resolvedType = state.type === "other" ? state.otherType : state.type;
  const icon = resolvedType ? ICONS[resolvedType] : undefined;

  return (
    <aside
      aria-label="Le bien tel que vous l'avez décrit"
      className="rounded-lg border border-border bg-surface/90 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-border-soft px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          {icon ? (
            <AssetTypeIcon name={icon} className="size-5" />
          ) : (
            <MapPin aria-hidden="true" className="size-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="eyebrow-text">Le bien</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {state.address ? state.address.label : "Adresse à renseigner"}
          </p>
        </div>
      </div>

      {rows.length === 0 && chips.length === 0 ? (
        <p className="px-5 py-5 text-sm leading-relaxed text-ink-muted">
          Cette fiche se remplit à mesure que vous répondez. Rien n&apos;y est
          calculé&nbsp;: elle répète ce que vous avez saisi, pour que vous
          puissiez le vérifier avant le calcul.
        </p>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          <dl className="flex flex-col divide-y divide-border-soft">
            {rows.map((row) => (
              <div
                key={row.label}
                className="animate-fade-in flex items-baseline justify-between gap-4 py-2"
              >
                <dt className="text-sm text-ink-muted">{row.label}</dt>
                <dd className="tnum text-right text-sm font-semibold text-ink">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {chips.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-fg"
                >
                  <Check aria-hidden="true" className="size-3" />
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <p className="border-t border-border-soft px-5 py-3 text-xs leading-relaxed text-ink-subtle">
        Pour corriger une réponse, revenez à son étape&nbsp;: cette fiche ne se
        modifie pas directement.
      </p>
    </aside>
  );
}
