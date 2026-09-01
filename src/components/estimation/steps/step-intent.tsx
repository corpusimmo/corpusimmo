"use client";

import { ChoiceCard, ChoiceGroup } from "@/components/ui";
import { PROJECT_INTENT_LABELS, type ProjectIntent } from "@/types/property";
import type { StepProps } from "../wizard-state";

/** Order matters: the most frequent answers come first, not the most valuable. */
const INTENTS: { id: ProjectIntent; description: string }[] = [
  { id: "curiosity", description: "Je veux simplement savoir où en est mon bien." },
  { id: "selling_considering", description: "J’y réfléchis, sans date arrêtée." },
  { id: "selling_under_6m", description: "Vente envisagée dans le semestre." },
  { id: "selling_under_3m", description: "Le projet est lancé, l’échéance est proche." },
  { id: "buying", description: "Je veux vérifier le prix d’un bien avant d’acheter." },
  { id: "inheritance", description: "Succession, donation ou partage à évaluer." },
  { id: "investment", description: "J’analyse un placement locatif ou un arbitrage." },
  { id: "other", description: "Divorce, prêt bancaire, assurance, autre motif." },
];

export function StepIntent({ state, errors, update }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ChoiceGroup label="Pourquoi souhaitez-vous connaître la valeur de ce bien ?" columns={2}>
          {INTENTS.map((intent) => (
            <ChoiceCard
              key={intent.id}
              selected={state.intent === intent.id}
              title={PROJECT_INTENT_LABELS[intent.id]}
              description={intent.description}
              onSelect={() => update({ intent: intent.id })}
            />
          ))}
        </ChoiceGroup>
      </div>

      {errors.intent ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {errors.intent}
        </p>
      ) : null}

      <p
        className="rounded-lg bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted"
      >
        Cette réponse ne modifie pas le calcul de la valeur. Elle nous sert à adapter ce que nous
        vous proposons ensuite et, uniquement si vous nous y autorisez à l’étape suivante, à vous
        orienter vers un professionnel dont le métier correspond à votre situation.
      </p>
    </div>
  );
}
