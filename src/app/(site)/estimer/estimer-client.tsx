"use client";

import { useCallback, useState } from "react";

import { EstimationResult } from "@/components/estimation/estimation-result";
import { EstimatorWizard } from "@/components/estimation/estimator-wizard";
import type { ValuationResult } from "@/types/valuation";

/**
 * Le parcours et son résultat vivent dans le même écran.
 *
 * Aucune redirection vers `/estimation/<id>` : rien n'étant stocké, une telle
 * URL serait morte au premier rechargement. On remonte donc le résultat ici, et
 * « Faire une autre estimation » remonte le composant à neuf — `key` force le
 * remontage, ce qui vide l'état du parcours sans avoir à le réinitialiser
 * champ par champ.
 */
export function EstimerClient() {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const restart = useCallback(() => {
    setResult(null);
    setAttempt((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (result) {
    return <EstimationResult valuation={result} onRestart={restart} />;
  }

  return <EstimatorWizard key={attempt} onResult={setResult} />;
}
