/**
 * Lecture sûre d'une variable d'environnement publique.
 *
 * POURQUOI CE FICHIER EXISTE — le piège a déjà coûté deux pannes.
 *
 * Next.js **remplace textuellement** `process.env.NEXT_PUBLIC_*` au moment du
 * build. Quand la variable n'est pas définie, la référence devient une **chaîne
 * vide**, et non `undefined`. Conséquence : l'idiome habituel
 *
 *     const x = process.env.NEXT_PUBLIC_TRUC ?? valeurParDefaut;
 *
 * ne se déclenche jamais, puisque `??` ne rattrape que `null` et `undefined`.
 * On se retrouve avec `""` — et `""` passe silencieusement là où une URL était
 * attendue.
 *
 * Deux pannes réelles causées par ce seul motif :
 *   1. `NEXT_PUBLIC_APP_URL` → `new URL("")` → build Vercel en échec pendant
 *      « Collecting page data » ;
 *   2. `NEXT_PUBLIC_MAP_STYLE_URL` → `style: ""` passé à MapLibre → carte
 *      blanche en production, alors qu'elle fonctionnait en développement
 *      (la substitution n'y est pas la même).
 *
 * Règle : toute lecture d'une variable publique passe par ici.
 */
export function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
