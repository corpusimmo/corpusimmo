import type { ReactNode } from "react";

import { ObservatoireShell } from "./observatoire-shell";

/**
 * L'observatoire est dans l'arbre PUBLIC, et libre en consultation.
 *
 * C'est la décision centrale de ce segment. La carte prouve, l'observatoire
 * approfondit ; poser un mur devant l'approfondissement rendrait le produit
 * indémontrable et retirerait trois pages de l'index — sur un domaine neuf qui
 * a besoin de chaque goutte d'autorité.
 *
 * Aucune lecture de session ici : il n'y en a pas dans cette version, et rien
 * de ce que l'écran propose ne l'exige.
 */
export default function ObservatoireLayout({ children }: { children: ReactNode }) {
  return <ObservatoireShell>{children}</ObservatoireShell>;
}
