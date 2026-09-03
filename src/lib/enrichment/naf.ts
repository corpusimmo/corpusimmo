/**
 * NAF rév. 2 → famille d'usage immobilier.
 *
 * POURQUOI CE FICHIER EXISTE.
 * DVF ne connaît que quatre codes de type de local, et le quatrième — « local
 * industriel, commercial ou assimilé » — avale les bureaux, les boutiques, les
 * entrepôts, les ateliers, les hôtels et les cliniques. Aucun champ de DVF ne
 * les distingue : la ventilation fine vit dans les Fichiers fonciers du CEREMA,
 * qui ne sont pas en accès libre.
 *
 * Ce qui suit ne LIT donc pas l'usage d'un bien : il l'INDUIT depuis les
 * activités déclarées à proximité. C'est un indice, pas un fait, et tout
 * l'affichage en aval doit le dire.
 *
 * LA MAILLE. On classe sur la DIVISION (les deux premiers chiffres), pas sur la
 * sous-classe : la division est stable dans le temps, tient en une table qu'un
 * professionnel peut relire, et suffit très largement à trancher entre bureaux,
 * commerce et entrepôt. Descendre plus bas donnerait une fausse précision pour
 * un tableau dix fois plus long.
 *
 * LES EXCEPTIONS. Quelques divisions abritent deux réalités immobilières très
 * différentes : le commerce de gros (46) se fait depuis un bureau autant que
 * depuis un entrepôt, et l'immobilier (68) couvre l'agence de quartier comme le
 * siège de foncière. Elles sont classées sur leur cas le plus fréquent, et
 * `ACTIVITY_FAMILIES` porte le doute dans son libellé plutôt que de le taire.
 */

export type ActivityFamily =
  | "bureaux"
  | "commerce"
  | "entrepot"
  | "industrie"
  | "hotellerie"
  | "sante"
  | "enseignement"
  | "artisanat"
  | "autre";

export interface ActivityFamilyMeta {
  /** Ce qu'on écrit sur la fiche, à la place de « local commercial ». */
  label: string;
  /** Les familles trop hétérogènes ne doivent jamais conclure seules. */
  conclusive: boolean;
}

export const ACTIVITY_FAMILIES: Record<ActivityFamily, ActivityFamilyMeta> = {
  bureaux: { label: "des bureaux", conclusive: true },
  commerce: { label: "un commerce", conclusive: true },
  entrepot: { label: "un entrepôt ou un local logistique", conclusive: true },
  industrie: { label: "un local industriel ou un atelier", conclusive: true },
  hotellerie: { label: "un hôtel ou un restaurant", conclusive: true },
  sante: { label: "un local de santé", conclusive: true },
  enseignement: { label: "un local d'enseignement", conclusive: true },
  artisanat: { label: "un local artisanal", conclusive: true },
  autre: { label: "une activité non caractéristique", conclusive: false },
};

/**
 * Division NAF → famille. Toute division absente retombe sur `autre`, ce qui
 * est un aveu d'ignorance et non un fourre-tout : `autre` n'est jamais
 * concluant.
 */
const FAMILY_BY_DIVISION: Record<string, ActivityFamily> = {
  // 10–33 · industrie manufacturière
  ...divisions(10, 33, "industrie"),
  // 35–39 · énergie, eau, déchets — des emprises techniques, pas des bureaux
  ...divisions(35, 39, "industrie"),
  // 41–43 · construction : sièges de chantier, dépôts de matériel
  ...divisions(41, 43, "artisanat"),
  // 45 · commerce et réparation automobile — garages, concessions
  "45": "commerce",
  // 46 · commerce de gros : plus souvent adossé à un entrepôt qu'à une boutique
  "46": "entrepot",
  // 47 · commerce de détail — le cas canonique de la boutique
  "47": "commerce",
  // 49–53 · transport et entreposage
  "49": "entrepot",
  "50": "entrepot",
  "51": "entrepot",
  "52": "entrepot",
  "53": "entrepot",
  // 55–56 · hébergement et restauration
  "55": "hotellerie",
  "56": "hotellerie",
  // 58–63 · information et communication
  ...divisions(58, 63, "bureaux"),
  // 64–66 · finance et assurance
  ...divisions(64, 66, "bureaux"),
  // 68 · activités immobilières — agences en pied d'immeuble et foncières
  "68": "bureaux",
  // 69–75 · activités spécialisées, scientifiques et techniques
  ...divisions(69, 75, "bureaux"),
  // 77–82 · services administratifs et de soutien
  ...divisions(77, 82, "bureaux"),
  // 84 · administration publique
  "84": "bureaux",
  // 85 · enseignement
  "85": "enseignement",
  // 86–88 · santé et action sociale
  ...divisions(86, 88, "sante"),
  // 90–93 · arts, spectacles, loisirs — trop hétérogène pour conclure
  ...divisions(90, 93, "autre"),
  // 94–96 · associations et services personnels : coiffeurs, pressings…
  "95": "artisanat",
  "96": "artisanat",
};

function divisions(
  from: number,
  to: number,
  family: ActivityFamily,
): Record<string, ActivityFamily> {
  const out: Record<string, ActivityFamily> = {};
  for (let n = from; n <= to; n += 1) {
    out[String(n).padStart(2, "0")] = family;
  }
  return out;
}

/**
 * `"68.20B"`, `"6820B"` ou `"68"` → famille.
 *
 * Renvoie `null` sur une entrée qui n'est pas un code NAF : mieux vaut ne rien
 * classer que ranger du bruit dans `autre`, qui compte dans les totaux.
 */
export function familyForNaf(code: string | null | undefined): ActivityFamily | null {
  if (!code) return null;
  const digits = code.replace(/[^0-9]/g, "");
  if (digits.length < 2) return null;
  return FAMILY_BY_DIVISION[digits.slice(0, 2)] ?? "autre";
}
