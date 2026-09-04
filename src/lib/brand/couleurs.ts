/**
 * LIRE LES COULEURS D'UNE MARQUE DANS LES PIXELS DE SON LOGO.
 *
 * `charte.ts` ne connaît que des couleurs déjà décidées. Ici on les propose, à
 * partir de la seule chose qu'un professionnel a toujours sous la main : son
 * logo. Personne ne connaît ses hexadécimaux, tout le monde a son PNG.
 *
 * ── POURQUOI DES FONCTIONS PURES SUR DES PIXELS BRUTS ──────────────────────
 * Ce module ne touche ni au DOM, ni au réseau. Il reçoit le tableau RGBA que
 * rend `getImageData`, rien d'autre. C'est ce qui permet de le tester sous
 * Vitest avec des tableaux écrits à la main, donc de vérifier les pièges
 * ci-dessous sur des cas construits plutôt que sur un logo réel dont on ne
 * saurait dire ce qu'il contient vraiment.
 *
 * ── LES QUATRE PIÈGES D'UN LOGO ────────────────────────────────────────────
 * 1. LA TRANSPARENCE. Un logo est presque toujours un PNG posé sur du vide.
 *    Les pixels transparents ne sont pas noirs, ils ne sont rien : les
 *    compter reviendrait à déclarer que la couleur de la marque est le noir,
 *    parce qu'un canal RGB non peint vaut 0.
 * 2. LE BLANC, LE NOIR ET LES GRIS. Ce sont le fond et le texte, pas
 *    l'identité. Une agence dont le logo est noir sur blanc n'a pas « le noir »
 *    pour couleur de marque : elle a un filet rouge quelque part, ou rien, et
 *    dans ce cas il vaut mieux ne rien proposer que proposer du gris.
 * 3. L'ANTICRÉNELAGE. Le contour d'une lettre bleue sur blanc fabrique des
 *    centaines de bleus délavés qui n'existent nulle part dans la charte.
 *    Compter les valeurs exactes ferait gagner ces intermédiaires par le
 *    nombre. Il faut regrouper avant de compter.
 * 4. LA MINORITÉ. Un filet, une puce, un accent occupent 1 % de la surface et
 *    sont pourtant LA couleur. Le simple classement par surface les enterre.
 *
 * ── LA MÉTHODE DE REGROUPEMENT, ET POURQUOI CELLE-LÀ ───────────────────────
 * Quantification par cases de TEINTE (24 secteurs de 15°) dans l'espace TSL,
 * après filtrage des pixels non colorés.
 *
 * · Pourquoi la teinte, et elle seule. L'anticrénelage mélange la couleur au
 *   fond : cela déplace la clarté et la saturation, presque jamais la teinte.
 *   Regrouper par teinte fait donc retomber le halo sur la couleur qui l'a
 *   engendré, ce qu'une case RGB à trois dimensions ne garantit pas, puisque
 *   le dégradé y traverse plusieurs cases en diagonale.
 * · Pourquoi pas les k-moyennes. Elles demandent un tirage initial : deux
 *   exécutions sur la même image donnent deux résultats. L'utilisateur verrait
 *   ses couleurs changer en rechargeant la page, et les tests ne vaudraient
 *   rien. Ici tout est histogramme, tri total et départage explicite : le
 *   résultat est reproductible au bit près.
 * · Le prix à payer, assumé. Deux nuances d'une même teinte (marine et ciel)
 *   se retrouvent dans la même case et n'en ressort qu'une. C'est exactement
 *   ce qu'on veut : proposer deux bleus ne rend service à personne.
 * · La frontière de case. Deux teintes voisines séparées par une frontière
 *   (14° et 16°) donnent deux candidats distincts ; l'écart minimal imposé
 *   entre la principale et la secondaire les rassemble ensuite. Le filet de
 *   sécurité est là, pas dans un découpage plus fin.
 */

import type { Hex } from "./charte";

/* ── Seuils ──────────────────────────────────────────────────────────────── */

/**
 * En deçà, le pixel appartient au contour fondu du logo : sa couleur est déjà
 * mélangée à du vide, donc délavée. On ne la veut pas dans le comptage.
 * Au-dessus de 200/255, le pixel est de la matière, pas du bord.
 */
export const ALPHA_MINIMAL = 200;

/**
 * Saturation TSL en dessous de laquelle une couleur se lit comme un gris à
 * l'écran. 0,20 laisse passer les bleus sourds et les kakis d'identité
 * (marine #14293c est à 0,50), et écarte les gris de texte et les blancs
 * cassés, qui plafonnent autour de 0,05.
 */
export const SATURATION_MINIMALE = 0.2;

/**
 * Bornes de clarté. Elles ne font pas double emploi avec la saturation : la
 * formule TSL devient instable aux extrêmes, et un blanc cassé #f0f0ff affiche
 * une saturation de 1,00 pour trois points d'écart entre canaux. Sans ces
 * bornes, le blanc du papier serait élu couleur de marque.
 */
export const CLARTE_MINIMALE = 0.1;
export const CLARTE_MAXIMALE = 0.92;

/** Largeur d'une case de teinte : 24 secteurs pour le tour du cercle. */
export const LARGEUR_SECTEUR = 15;

/**
 * Écart de teinte exigé entre la principale et la secondaire, en degrés.
 *
 * 45° est un huitième du cercle : c'est le pas à partir duquel deux couleurs
 * changent de nom courant (bleu et turquoise, rouge et orange). En dessous, on
 * proposerait deux variantes de la même couleur, ce qui n'aide pas à décider
 * et donne l'impression que l'outil a compté deux fois la même chose.
 */
export const SEPARATION_TEINTE_MINIMALE = 45;

/* ── Conversion ──────────────────────────────────────────────────────────── */

export interface Tsl {
  /** Teinte en degrés, 0 à 360. Vaut 0 par convention sur un gris. */
  teinte: number;
  /** Saturation TSL, 0 à 1. */
  saturation: number;
  /** Clarté TSL, 0 à 1. */
  clarte: number;
}

/**
 * RGB vers TSL.
 *
 * On travaille en TSL et non en RGB parce que les trois questions posées à un
 * pixel (est-il gris ? est-il presque blanc ? de quelle famille est-il ?) sont
 * chacune un axe de cet espace, alors qu'en RGB elles sont mêlées aux trois
 * canaux à la fois.
 */
export function rgbVersTsl(r: number, g: number, b: number): Tsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const clarte = (max + min) / 2;

  if (delta === 0) return { teinte: 0, saturation: 0, clarte };

  const saturation =
    clarte > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let teinte: number;
  if (max === rn) teinte = ((gn - bn) / delta) % 6;
  else if (max === gn) teinte = (bn - rn) / delta + 2;
  else teinte = (rn - gn) / delta + 4;

  teinte *= 60;
  if (teinte < 0) teinte += 360;

  return { teinte, saturation, clarte };
}

/** `(20, 41, 60)` → `#14293c`, au format attendu par `normaliserHex`. */
export function hexDepuisRgb(r: number, g: number, b: number): Hex {
  const octet = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${octet(r)}${octet(g)}${octet(b)}`;
}

/**
 * Distance angulaire entre deux teintes, de 0 à 180.
 *
 * Le cercle se referme : 350° et 10° sont deux rouges voisins, pas deux
 * couleurs opposées. Une soustraction naïve les déclarerait distants de 340°
 * et laisserait proposer deux fois le même rouge.
 */
export function ecartTeinte(a: number, b: number): number {
  const brut = Math.abs(a - b) % 360;
  return brut > 180 ? 360 - brut : brut;
}

/* ── Extraction ──────────────────────────────────────────────────────────── */

export interface CouleurCandidate {
  /** La couleur retenue, telle qu'elle existe dans l'image. */
  hex: Hex;
  /** Part de la surface colorée du logo, 0 à 1. */
  part: number;
  teinte: number;
  saturation: number;
  clarte: number;
  /** Poids de classement. Voir `scorer`. */
  score: number;
}

export interface LecturePixels {
  /** Les candidats, du plus convaincant au moins convaincant. */
  candidats: CouleurCandidate[];
  /** Pixels assez opaques pour compter. */
  pixelsOpaques: number;
  /** Pixels opaques ET colorés, c'est-à-dire la base des parts de surface. */
  pixelsColores: number;
}

/**
 * Le poids d'un candidat : sa surface, tempérée, multipliée par sa saturation.
 *
 * La racine cubique est le cœur de la réponse au piège de la minorité. Elle
 * ramène l'écart de surface entre un aplat qui couvre tout le logo et un filet
 * qui en couvre 1 % d'un facteur 100 à un facteur 4,6. Le filet passe donc
 * devant l'aplat dès qu'il est trois fois plus saturé, ce qui est le cas d'un
 * accent vif sur un gris-bleu sourd, et reste derrière lui à saturation
 * comparable, ce qui est le cas d'un logo monochrome et de son ombre.
 */
function scorer(part: number, saturation: number): number {
  return Math.cbrt(part) * saturation;
}

/**
 * Les couleurs candidates d'une image, à partir de son tableau RGBA.
 *
 * `pixels` est ce que rend `CanvasRenderingContext2D.getImageData`, soit
 * quatre octets par pixel dans l'ordre rouge, vert, bleu, alpha. L'ordre des
 * pixels n'a aucune influence sur le résultat : le classement final est un tri
 * total, départagé par la valeur hexadécimale, donc reproductible.
 */
export function candidatsDepuisPixels(
  pixels: Uint8ClampedArray,
): LecturePixels {
  /** Par secteur de teinte : les couleurs exactes et leur effectif. */
  const secteurs = new Map<number, Map<number, number>>();
  let pixelsOpaques = 0;
  let pixelsColores = 0;

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < ALPHA_MINIMAL) continue;
    pixelsOpaques += 1;

    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const { teinte, saturation, clarte } = rgbVersTsl(r, g, b);

    if (saturation < SATURATION_MINIMALE) continue;
    if (clarte < CLARTE_MINIMALE || clarte > CLARTE_MAXIMALE) continue;

    pixelsColores += 1;

    const secteur = Math.floor(teinte / LARGEUR_SECTEUR) % (360 / LARGEUR_SECTEUR);
    const exact = (r << 16) | (g << 8) | b;
    let couleurs = secteurs.get(secteur);
    if (!couleurs) {
      couleurs = new Map<number, number>();
      secteurs.set(secteur, couleurs);
    }
    couleurs.set(exact, (couleurs.get(exact) ?? 0) + 1);
  }

  const candidats: CouleurCandidate[] = [];

  for (const couleurs of secteurs.values()) {
    let effectif = 0;
    let meilleur: { exact: number; poids: number } | null = null;

    for (const [exact, nombre] of couleurs) {
      effectif += nombre;
      const { saturation } = rgbVersTsl(
        (exact >> 16) & 255,
        (exact >> 8) & 255,
        exact & 255,
      );
      // Le représentant du secteur est une couleur RÉELLEMENT présente, jamais
      // une moyenne : la moyenne d'un bleu et de son halo est un bleu délavé
      // qui n'est écrit nulle part dans la charte du client. On prend celle qui
      // pèse le plus par le nombre ET par la saturation, ce qui écarte le halo
      // au profit de la matière.
      const poids = nombre * saturation;
      if (
        !meilleur ||
        poids > meilleur.poids ||
        // Départage stable : à poids égal, la plus petite valeur l'emporte.
        (poids === meilleur.poids && exact < meilleur.exact)
      ) {
        meilleur = { exact, poids };
      }
    }

    if (!meilleur) continue;

    const r = (meilleur.exact >> 16) & 255;
    const g = (meilleur.exact >> 8) & 255;
    const b = meilleur.exact & 255;
    const { teinte, saturation, clarte } = rgbVersTsl(r, g, b);
    const part = effectif / pixelsColores;

    candidats.push({
      hex: hexDepuisRgb(r, g, b),
      part,
      teinte,
      saturation,
      clarte,
      score: scorer(part, saturation),
    });
  }

  candidats.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.hex.localeCompare(b.hex),
  );

  return { candidats, pixelsOpaques, pixelsColores };
}

/* ── Proposition ─────────────────────────────────────────────────────────── */

export interface Proposition {
  /** `null` quand le logo ne contient aucune couleur digne de ce nom. */
  principale: Hex | null;
  /** `null` quand aucun candidat n'est assez éloigné de la principale. */
  secondaire: Hex | null;
  /** Tout ce qui a été trouvé, pour laisser l'utilisateur trancher lui-même. */
  candidats: CouleurCandidate[];
  pixelsOpaques: number;
  pixelsColores: number;
}

/**
 * Une, deux, ou aucune couleur de marque.
 *
 * Rendre `principale: null` sur un logo noir et blanc est un résultat, pas un
 * échec : c'est la seule réponse vraie, et elle vaut mieux qu'un gris posé en
 * silence dans la charte d'un client.
 */
export function proposerCouleurs(pixels: Uint8ClampedArray): Proposition {
  const { candidats, pixelsOpaques, pixelsColores } =
    candidatsDepuisPixels(pixels);

  const principale = candidats[0] ?? null;
  const secondaire = principale
    ? (candidats.find(
        (c) =>
          ecartTeinte(c.teinte, principale.teinte) >=
          SEPARATION_TEINTE_MINIMALE,
      ) ?? null)
    : null;

  return {
    principale: principale?.hex ?? null,
    secondaire: secondaire?.hex ?? null,
    candidats,
    pixelsOpaques,
    pixelsColores,
  };
}
