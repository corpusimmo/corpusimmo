"use client";

import { Briefcase, Home } from "lucide-react";
import { ChoiceCard, ChoiceGroup } from "@/components/ui";
import type { StepProps } from "../wizard-state";

/**
 * La bifurcation du parcours, et la seule question de catégorie qu'on pose.
 *
 * Elle arrive APRÈS l'adresse, à dessein : taper une adresse est l'engagement le
 * plus faible qu'on puisse demander, et c'est ce qui rend la suite crédible.
 * Poser « pro ou résidentiel ? » d'emblée, c'est demander de se ranger dans une
 * case avant d'avoir montré quoi que ce soit.
 *
 * Le choix ne change pas seulement les icônes suivantes : il change la MÉTHODE.
 * Un logement se compare — DVF donne des dizaines de ventes semblables par
 * quartier. Un actif tertiaire se valorise d'abord par son revenu, parce que
 * les mutations professionnelles sont rares et souvent vendues en bloc. C'est
 * pourquoi les deux cartes annoncent la méthode plutôt que de lister des types.
 */
export function StepUsage({ state, errors, update }: StepProps) {
  const choisir = (usage: "residential" | "professional") => {
    // Changer de branche invalide le type déjà choisi : « bureaux » n'a aucun
    // sens en résidentiel, et laisser une valeur orpheline produirait un
    // formulaire incohérent à l'étape suivante.
    update(state.usage === usage ? { usage } : { usage, type: null, otherType: null });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ChoiceGroup label="De quel type de bien s’agit-il ?" columns={2}>
          <ChoiceCard
            selected={state.usage === "residential"}
            icon={<Home aria-hidden="true" />}
            title="Résidentiel"
            description="Appartement, maison ou terrain. Estimé par comparaison avec les ventes réelles du quartier."
            onSelect={() => choisir("residential")}
          />
          <ChoiceCard
            selected={state.usage === "professional"}
            icon={<Briefcase aria-hidden="true" />}
            title="Professionnel"
            description="Bureaux, commerce, local d’activité ou terrain. Comparé aux mutations tertiaires du secteur, qui sont rares : la fourchette sera plus large."
            onSelect={() => choisir("professional")}
          />
        </ChoiceGroup>
      </div>

      {errors.usage ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {errors.usage}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-muted">
        Les deux parcours ne posent pas les mêmes questions. En professionnel, nous demanderons
        notamment si le bien est occupé et à quel loyer — un immeuble loué et le même immeuble vide
        ne se négocient pas de la même façon. La valorisation par le revenu n’est pas encore
        construite : ces réponses éclairent la lecture du résultat, elles n’entrent pas dans le
        calcul, et nous préférons vous le dire.
      </p>
    </div>
  );
}
