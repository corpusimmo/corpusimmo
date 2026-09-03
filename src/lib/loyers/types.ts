/**
 * Le contrat de `src/data/loyers.json`, produit par `scripts/agreger-loyers.mjs`.
 *
 * MÊME PRINCIPE QUE `src/lib/cities/types.ts` : le fichier ne porte que des
 * faits, le code porte les refus. On n'y trouvera donc jamais un booléen
 * « affichable » ni un rendement pré-calculé — seulement l'indicateur, son
 * intervalle, son effectif, son R² et l'échelle à laquelle il a été estimé.
 * Durcir un seuil ne doit pas obliger à retélécharger 9 Mo de CSV.
 *
 * CE FICHIER N'IMPORTE PAS LE JSON, et c'est délibéré : 34 900 communes en
 * `resolveJsonModule` obligeraient TypeScript à inférer un type littéral de
 * 34 900 propriétés à chaque `tsc`. L'appelant importe le JSON là où il en a
 * besoin et le lit à travers `JeuLoyers`.
 */

/**
 * À quelle échelle l'indicateur de la commune a réellement été estimé.
 *
 * C'est l'information la plus facile à perdre et la plus coûteuse à perdre.
 * `commune` veut dire que des annonces ont été observées SUR PLACE. `maille`
 * et `epci` veulent dire que la valeur vient de communes voisines jugées
 * semblables, faute d'annonces locales : c'est une estimation de voisinage,
 * publiée dans la même colonne qu'une estimation locale. Sur les 34 900
 * communes du millésime 2025, moins d'une sur six est estimée `commune`.
 *
 * `null` veut dire « la source a écrit autre chose que ces trois valeurs », et
 * pas « commune » par défaut : on ne devine pas.
 */
export type EchelleLoyer = "commune" | "maille" | "epci";

/**
 * Un indicateur de loyer d'annonce, charges comprises, en €/m²/mois.
 *
 * `bas` et `haut` bornent l'intervalle de prédiction du modèle. Ils ne sont pas
 * décoratifs : sur beaucoup de communes rurales, l'écart va du simple au
 * double, et c'est le seul signal qui dise à l'affichage que le chiffre
 * central ne mérite pas d'être écrit à l'euro près.
 */
export interface IndicateurLoyer {
  /** Loyer médian prédit, €/m²/mois, charges comprises. */
  m2: number;
  /** Bornes de l'intervalle de prédiction, €/m²/mois. */
  bas: number | null;
  haut: number | null;
  echelle: EchelleLoyer | null;
  /** Nombre d'annonces observées DANS la commune. Zéro est fréquent. */
  obs: number;
  /** R² ajusté du modèle qui a produit la valeur. */
  r2: number | null;
}

export interface LoyersCommune {
  nom: string;
  /** Code département, tel que publié : `01` à `95`, `2A`/`2B`, `971`… */
  dep: string;
  appartement: IndicateurLoyer | null;
  maison: IndicateurLoyer | null;
}

export interface JeuLoyers {
  generatedAt: string;
  /** Millésime de la carte des loyers, pas l'année de génération du fichier. */
  annee: number;
  source: string;
  /** Mention obligatoire, à reproduire partout où le chiffre est montré. */
  attribution: string;
  page: string;
  ressources: Record<string, string>;
  /** Surface du « bien type » sur lequel chaque famille est estimée, en m². */
  surfacesType: Record<string, number>;
  precautions: string[];
  communes: Record<string, LoyersCommune>;
}
