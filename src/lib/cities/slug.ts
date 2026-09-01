/**
 * LES SEGMENTS D'URL DES PAGES VILLES.
 *
 * Le slug de chaque commune est ÉCRIT dans `src/data/cities/communes.ts`, pas
 * calculé au rendu : une URL est un engagement, et une URL dérivée d'un nom
 * change le jour où le référentiel corrige une graphie. Ce module ne sert donc
 * pas à produire les slugs du site, mais à VÉRIFIER qu'ils restent cohérents,
 * et à donner à qui étend la liste la règle exacte à suivre.
 *
 * LA RÈGLE
 *   1. le nom, sans accents, en minuscules ;
 *   2. tout ce qui n'est ni lettre ni chiffre devient un tiret, y compris
 *      l'apostrophe : « Villeneuve-d'Ascq » donne `villeneuve-d-ascq` ;
 *   3. en cas d'homonymie, et alors seulement, le code du département est
 *      ajouté. Il y a deux Saint-Denis dans la sélection, l'une en
 *      Seine-Saint-Denis et l'autre à La Réunion : `saint-denis-93` et
 *      `saint-denis-974`. Suffixer tout le monde « pour être cohérent »
 *      allongerait quatre-vingt-dix-huit URL sans rien résoudre.
 */

import type { CityCommune } from "@/data/cities/communes";

/** Étape 1 et 2 de la règle : le slug avant toute désambiguïsation. */
export function slugifyCommuneName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Les slugs de base portés par plusieurs communes de la sélection. */
export function ambiguousBaseSlugs(communes: readonly CityCommune[]): Set<string> {
  const counts = new Map<string, number>();
  for (const commune of communes) {
    const base = slugifyCommuneName(commune.name);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const ambiguous = new Set<string>();
  for (const [base, count] of counts) {
    if (count > 1) ambiguous.add(base);
  }
  return ambiguous;
}

/** Le slug que la règle impose à une commune, dans le contexte de la liste. */
export function expectedSlug(commune: CityCommune, ambiguous: ReadonlySet<string>): string {
  const base = slugifyCommuneName(commune.name);
  return ambiguous.has(base) ? `${base}-${commune.departmentCode.toLowerCase()}` : base;
}
