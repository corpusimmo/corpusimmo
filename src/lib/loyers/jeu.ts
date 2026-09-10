import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import type { JeuLoyers, LoyersCommune } from "./types";

/**
 * LE JEU DE LOYERS, LU SUR LE DISQUE, UNE FOIS.
 *
 * POURQUOI PAS UN `import` DE JSON. 34 900 communes : avec
 * `resolveJsonModule`, TypeScript infère un type littéral d'autant de
 * propriétés et le retient à chaque `tsc`. `src/lib/loyers/types.ts` le dit
 * depuis le premier jour, et ce module est la réponse qui manquait — le
 * fichier est lu à travers `JeuLoyers`, jamais inféré.
 *
 * POURQUOI SYNCHRONE. La lecture arrive pendant le rendu de pages
 * PRÉ-CALCULÉES : cent communes générées à la construction, une seule lecture
 * pour toutes. Une version asynchrone obligerait chaque composant appelant à
 * devenir asynchrone pour un fichier qui est déjà sur le disque de la
 * machine de build.
 *
 * LE FICHIER EST TRACÉ EXPLICITEMENT. `next.config.ts` doit le compter parmi
 * les fichiers de la fonction si une page cesse d'être pré-calculée ; tant
 * que ces pages sont statiques, la lecture n'a lieu qu'au build.
 */
let cache: JeuLoyers | null = null;

export function jeuLoyers(): JeuLoyers {
  if (cache) return cache;
  const fichier = path.join(process.cwd(), "src/data/loyers.json");
  cache = JSON.parse(readFileSync(fichier, "utf8")) as JeuLoyers;
  return cache;
}

/**
 * Les loyers d'une commune, par code INSEE.
 *
 * `null` quand la commune n'est pas dans le jeu — une commune nouvelle, un
 * arrondissement, une collectivité d'outre-mer hors périmètre. Jamais un
 * objet vide : l'appelant doit pouvoir distinguer « pas de donnée » de
 * « données à zéro ».
 */
export function loyersDeCommune(insee: string): LoyersCommune | null {
  return jeuLoyers().communes[insee] ?? null;
}
