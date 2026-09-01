/**
 * La recherche du sommaire des communes, côté navigateur.
 *
 * Elle cherche un DÉBUT DE MOT, jamais une sous-chaîne : « nio » doit trouver
 * Niort, pas les quatre communes de La Réunion. Les accents, la casse, les
 * tirets et les apostrophes ne comptent pas : « saint etienne » et
 * « Saint-Étienne » sont le même mot pour qui tape sur un téléphone.
 *
 * Le numéro de département se compare tel quel, par préfixe : « 4 » liste
 * tout le Grand Ouest, « 44 » ne garde que la Loire-Atlantique.
 */

export interface SearchableCity {
  name: string;
  departmentName: string;
  departmentCode: string;
}

/** Minuscules, sans accents, tirets et apostrophes ramenés à l'espace. */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si un mot de `haystack` (déjà replié) commence par `needle` (idem). */
export function startsAWord(haystack: string, needle: string): boolean {
  return haystack.startsWith(needle) || haystack.includes(` ${needle}`);
}

/** Vrai si la commune répond à ce que la personne a tapé. Une saisie vide répond oui. */
export function cityMatches(city: SearchableCity, query: string): boolean {
  const needle = foldForSearch(query);
  if (needle === "") return true;
  return (
    startsAWord(foldForSearch(city.name), needle) ||
    startsAWord(foldForSearch(city.departmentName), needle) ||
    city.departmentCode.startsWith(needle)
  );
}
