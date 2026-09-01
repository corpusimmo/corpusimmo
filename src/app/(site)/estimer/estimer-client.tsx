"use client";

import { useCallback, useState } from "react";

import { EstimationResult } from "@/components/estimation/estimation-result";
import { EstimatorWizard } from "@/components/estimation/estimator-wizard";
import { confidenceBand, countBand, departmentOf } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { recordEstimation } from "@/lib/history/estimations";
import type { ValuationResult } from "@/types/valuation";

/**
 * Le parcours et son résultat vivent dans le même écran.
 *
 * Aucune redirection vers `/estimation/<id>` : rien n'étant stocké, une telle
 * URL serait morte au premier rechargement. On remonte donc le résultat ici, et
 * « Faire une autre estimation » remonte le composant à neuf — `key` force le
 * remontage, ce qui vide l'état du parcours sans avoir à le réinitialiser
 * champ par champ.
 *
 * Le résumé est en revanche déposé dans l'historique du navigateur au passage :
 * l'estimation reste retrouvable depuis `/mon-espace` après la fermeture de
 * l'onglet, sans compte et sans base. Voir `src/lib/history/estimations.ts`
 * pour ce qui est gardé, et ce qui ne l'est pas.
 */
export function EstimerClient() {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const keep = useCallback((valuation: ValuationResult) => {
    recordEstimation(valuation);
    // Le département et une tranche de confiance suffisent à savoir si l'outil
    // sert. Une adresse ou un montant ne partent jamais vers un tiers : voir
    // l'en-tête de `src/lib/analytics/events.ts`.
    track({
      name: "estimation_completed",
      params: {
        property_type: valuation.subject.type,
        department: departmentOf(valuation.subject.address.cityCode),
        confidence: confidenceBand(valuation.confidence.score),
        comparables: countBand(valuation.comparables.filter((c) => !c.excluded).length),
        concluded: Boolean(valuation.value),
      },
    });
    setResult(valuation);
  }, []);

  const restart = useCallback(() => {
    track({ name: "estimation_restarted", params: {} });
    setResult(null);
    setAttempt((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (result) {
    return <EstimationResult valuation={result} onRestart={restart} />;
  }

  return <EstimatorWizard key={attempt} onResult={keep} />;
}
