"use client";

import { Shapes } from "lucide-react";
import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import { ChoiceCard, ChoiceGroup } from "@/components/ui";
import type { StepProps, WizardPropertyType } from "../wizard-state";

/**
 * L'icône est une silhouette de la famille du logotype, pas un pictogramme
 * générique : bureaux, commerce et local d'activité ne se confondent plus, là
 * où une mallette, une boutique et une usine se lisaient comme trois métiers.
 * « Autre » garde un pictogramme neutre, puisqu'il ne désigne rien de précis.
 */
type Choix = {
  id: WizardPropertyType;
  icon: AssetIconName | "other";
  title: string;
  description: string;
};

/**
 * Quatre familles par branche, jamais davantage : au-delà, on hésite au lieu de
 * choisir. Ce qui déborde va derrière « Autre », qui demande alors une précision.
 */
const TYPES_PRO: Choix[] = [
  {
    id: "office",
    icon: "office",
    title: "Bureaux",
    description: "Plateau, immeuble ou lot de bureaux, occupé ou libre.",
  },
  {
    id: "retail",
    icon: "retail",
    title: "Local commercial",
    description: "Boutique, pied d’immeuble, cellule de centre commercial.",
  },
  {
    id: "business_premises",
    icon: "business_premises",
    title: "Local d’activité",
    description: "Atelier, entrepôt, locaux mixtes activité et bureaux.",
  },
  {
    id: "land",
    icon: "land",
    title: "Terrain",
    description: "Foncier à bâtir ou terrain d’assiette d’une opération.",
  },
];

const TYPES: Choix[] = [
  {
    id: "apartment",
    icon: "apartment",
    title: "Appartement",
    description: "Dans une copropriété, avec ou sans ascenseur.",
  },
  {
    id: "house",
    icon: "house",
    title: "Maison",
    description: "Individuelle ou mitoyenne, avec son terrain.",
  },
  {
    id: "land",
    icon: "land",
    title: "Terrain",
    description: "Nu, à bâtir ou non, même si vous n’en êtes pas sûr.",
  },
  {
    id: "other",
    icon: "other",
    title: "Autre",
    description: "Immeuble, local, bureaux, parking…",
  },
];

export function StepType({ state, errors, update }: StepProps) {
  const choix = state.usage === "professional" ? TYPES_PRO : TYPES;
  const question =
    state.usage === "professional"
      ? "Quel type d’actif professionnel ?"
      : "Que souhaitez-vous estimer ?";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ChoiceGroup label={question} columns={2}>
          {choix.map((type) => (
            <ChoiceCard
              key={type.id}
              selected={state.type === type.id}
              icon={
                type.icon === "other" ? (
                  <Shapes aria-hidden="true" />
                ) : (
                  <AssetTypeIcon name={type.icon} className="size-6" />
                )
              }
              title={type.title}
              description={type.description}
              onSelect={() => update({ type: type.id })}
            />
          ))}
        </ChoiceGroup>
      </div>

      {errors.type ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {errors.type}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-muted">
        Le type conditionne les questions suivantes : nous ne demandons jamais l’étage d’une maison,
        ni le nombre de pièces d’un terrain, ni le loyer d’un bien que vous nous avez dit vacant.
      </p>
    </div>
  );
}
