import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import type { IndicateurLoyer, JeuLoyers, LoyersCommune } from "./types";

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
  const direct = jeuLoyers().communes[insee];
  if (direct) return direct;
  return loyersParArrondissements(insee);
}

/**
 * PARIS, LYON ET MARSEILLE N'EXISTENT PAS DANS LA CARTE DES LOYERS.
 *
 * La source publie leurs ARRONDISSEMENTS — 75101 à 75120, 69381 à 69389,
 * 13201 à 13216 — et pas la commune qui les contient. Le produit, lui, tient
 * une page par commune : les trois plus grandes villes de France se
 * retrouvaient donc sans le moindre loyer, ce qui ne se remarque pas quand on
 * teste sur Nantes.
 *
 * CE QU'ON RECONSTITUE, ET COMMENT. Une moyenne des médianes
 * d'arrondissement, PONDÉRÉE par le nombre d'annonces observées dans chacun.
 * Ce n'est pas la médiane de la ville — on ne l'a pas, il faudrait les
 * annonces elles-mêmes — mais c'est la meilleure approximation qu'on puisse
 * tirer de ce que la source publie, et elle est bornée par les
 * arrondissements les moins chers et les plus chers.
 *
 * L'ÉCHELLE REDESCEND À `null`. Un agrégat n'est ni une estimation communale
 * ni une estimation de voisinage : lui laisser « commune » ferait passer un
 * calcul pour une observation. `null` veut dire « la source n'a pas écrit
 * cela », ce qui est exactement le cas.
 */
const ARRONDISSEMENTS: Record<string, [number, number, string]> = {
  // [premier, dernier, préfixe] — codes contigus, sans trou.
  "75056": [1, 20, "751"],
  "69123": [1, 9, "693"],
  "13055": [1, 16, "132"],
};

function loyersParArrondissements(insee: string): LoyersCommune | null {
  const plage = ARRONDISSEMENTS[insee];
  if (!plage) return null;
  const [premier, dernier, prefixe] = plage;

  const jeu = jeuLoyers();
  const parts: LoyersCommune[] = [];
  for (let n = premier; n <= dernier; n += 1) {
    const code = `${prefixe}${String(n).padStart(2, "0")}`;
    const part = jeu.communes[code];
    if (part) parts.push(part);
  }
  if (parts.length === 0) return null;

  const premiere = parts[0]!;
  return {
    nom: premiere.nom.replace(/\s+1er Arrondissement$/i, ""),
    dep: premiere.dep,
    appartement: agreger(parts.map((p) => p.appartement)),
    appartementT12: agreger(parts.map((p) => p.appartementT12)),
    appartementT3: agreger(parts.map((p) => p.appartementT3)),
    maison: agreger(parts.map((p) => p.maison)),
  };
}

/** Moyenne pondérée par les annonces observées. `null` si aucun terme. */
function agreger(
  indicateurs: (IndicateurLoyer | null)[],
): IndicateurLoyer | null {
  const retenus = indicateurs.filter(
    (i): i is IndicateurLoyer => i !== null && i.m2 > 0,
  );
  if (retenus.length === 0) return null;

  /* Sans effectif, chaque arrondissement pèse pareil : c'est moins bon, mais
     c'est mieux que d'écarter un arrondissement dont la source n'a pas publié
     le compte d'annonces. */
  const poids = retenus.map((i) => (i.obs > 0 ? i.obs : 1));
  const total = poids.reduce((a, b) => a + b, 0);
  const pondere = (lire: (i: IndicateurLoyer) => number | null): number | null => {
    let somme = 0;
    let vus = 0;
    retenus.forEach((i, rang) => {
      const v = lire(i);
      if (typeof v !== "number" || !Number.isFinite(v)) return;
      somme += v * poids[rang]!;
      vus += poids[rang]!;
    });
    return vus === 0 ? null : Math.round((somme / vus) * 100) / 100;
  };

  const m2 = pondere((i) => i.m2);
  if (m2 === null) return null;

  return {
    m2,
    bas: pondere((i) => i.bas),
    haut: pondere((i) => i.haut),
    echelle: null,
    obs: total,
    /* Le R² le plus bas des arrondissements, pas leur moyenne : un agrégat ne
       vaut pas mieux que son maillon le plus faible, et c'est lui qui décide
       si l'affichage doit accompagner le chiffre d'une réserve. */
    r2: retenus.reduce<number | null>((min, i) => {
      if (i.r2 === null) return min;
      return min === null || i.r2 < min ? i.r2 : min;
    }, null),
  };
}
