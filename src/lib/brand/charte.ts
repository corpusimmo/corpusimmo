/**
 * LA CHARTE GRAPHIQUE D'UN CLIENT, ET CELLE QUI SERT QUAND IL N'Y EN A PAS.
 *
 * Ce module est le socle des documents générés : export PDF des comparables,
 * trames PowerPoint, dossiers. Tous lisent la MÊME `Charte`, ce qui garantit
 * qu'un logo posé une fois se retrouve partout, et qu'ajouter un format de
 * sortie ne demande pas de redécider ce qu'est une couleur de marque.
 *
 * ── LA RÈGLE DE REPLI ──────────────────────────────────────────────────────
 * Charte du client si elle existe, charte CorpusImmo sinon. Jamais de document
 * sans identité : un PDF blanc à en-tête vide fait plus de mal qu'un PDF à nos
 * couleurs, parce qu'il donne l'air d'un brouillon devant le mandant.
 *
 * ── POURQUOI DEUX COULEURS, ET PAS UNE PALETTE ─────────────────────────────
 * On demande une couleur principale et, facultativement, une seconde. C'est ce
 * qu'un professionnel sait donner de tête. Réclamer une palette complète
 * (fond, texte, bordures, états) reviendrait à demander un travail de
 * graphiste pour remplir un formulaire, et personne n'irait au bout. Tout le
 * reste se DÉDUIT : le texte lisible sur chaque fond, le ton sourd des
 * en-têtes de tableau, la teinte des filets.
 *
 * ── CE QUI N'EST PAS ICI ───────────────────────────────────────────────────
 * Ni la lecture du logo, ni son stockage, ni l'extraction des couleurs depuis
 * ses pixels : ce fichier ne connaît que des valeurs déjà décidées. Il doit
 * rester utilisable côté serveur comme côté navigateur, donc sans DOM et sans
 * accès réseau.
 */

/** Une couleur de marque, normalisée en `#rrggbb` minuscule. */
export type Hex = string;

export interface Charte {
  /** Le nom affiché en pied de document. */
  entreprise: string;
  /** Le site, affiché tel quel. Jamais de protocole en surimpression. */
  site?: string;
  /** URL du logo, ou `null` quand aucun n'a été déposé. */
  logo?: string | null;
  /** Couleur principale : en-têtes, filets, aplats. */
  principale: Hex;
  /** Couleur d'appui, facultative : accents, seconde ligne. */
  secondaire?: Hex;
  /**
   * Vrai quand la charte est celle du produit et non celle d'un client. Les
   * documents s'en servent pour décider s'il faut signer « généré avec
   * CorpusImmo » discrètement ou l'assumer pleinement.
   */
  parDefaut: boolean;
}

/**
 * La charte du produit, reprise des tokens de `globals.css`.
 *
 * Les valeurs sont recopiées littéralement plutôt que lues : un document PDF
 * ou PowerPoint se fabrique hors du navigateur, sans feuille de style à
 * interroger. C'est la même raison qui fait vivre des couleurs en dur dans
 * `base-palette.ts` pour le fond de carte.
 */
export const CHARTE_CORPUSIMMO: Charte = {
  entreprise: "CorpusImmo",
  site: "corpus.immo",
  logo: "/icon.svg",
  principale: "#14293c",
  secondaire: "#8a6a2f",
  parDefaut: true,
};

/* ── Normalisation ───────────────────────────────────────────────────────── */

const HEX_COURT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#?([0-9a-f]{6})$/i;

/**
 * `#ABC`, `abc123`, `#AABBCC` → `#aabbcc`. `null` sur tout le reste.
 *
 * Renvoyer `null` plutôt qu'une couleur de repli est délibéré : à ce
 * niveau-là, une saisie invalide doit remonter à celui qui l'a faite. Le repli
 * se décide plus haut, une fois, dans `resoudreCharte`.
 */
export function normaliserHex(valeur: string | null | undefined): Hex | null {
  if (!valeur) return null;
  const brut = valeur.trim();

  const court = HEX_COURT.exec(brut);
  if (court) {
    const [, r, g, b] = court;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const long = HEX_LONG.exec(brut);
  return long ? `#${long[1]!.toLowerCase()}` : null;
}

/* ── Lisibilité ──────────────────────────────────────────────────────────── */

function canaux(hex: Hex): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Luminance relative, au sens WCAG.
 *
 * La correction gamma n'est pas une coquetterie : sans elle, le jaune vif d'un
 * réseau de transport ou d'une enseigne passe pour sombre, et on lui pose du
 * texte blanc illisible. C'est exactement le cas que les couleurs de marque
 * font apparaître le plus souvent.
 */
export function luminance(hex: Hex): number {
  const [r, g, b] = canaux(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre deux couleurs, de 1 à 21. */
export function contraste(a: Hex, b: Hex): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [
    number,
    number,
  ];
  return (x + 0.05) / (y + 0.05);
}

/**
 * Le texte à poser sur un fond : noir ou blanc, celui qui contraste le plus.
 *
 * Sans ce calcul, une charte jaune ou or produit des en-têtes de tableau
 * blancs sur fond clair, illisibles à l'écran comme à l'impression. Le client
 * n'y verrait pas une erreur de saisie mais un défaut de notre outil.
 */
export function encreLisible(fond: Hex): Hex {
  return contraste(fond, "#ffffff") >= contraste(fond, "#111111")
    ? "#ffffff"
    : "#111111";
}

/* ── Résolution ──────────────────────────────────────────────────────────── */

/** Ce qu'un compte a réellement enregistré, avant validation. */
export interface CharteBrute {
  entreprise?: string | null;
  site?: string | null;
  logo?: string | null;
  principale?: string | null;
  secondaire?: string | null;
}

/**
 * La charte à appliquer, à partir de ce qui est enregistré.
 *
 * Le repli est un TOUT, pas un champ à champ. Une charte à moitié renseignée
 * (le nom du client, nos couleurs) produirait un document hybride qui n'est
 * ni le sien ni le nôtre, et qui a l'air cassé. Il faut au minimum un nom
 * d'entreprise ET une couleur principale valable pour qu'on bascule.
 *
 * `parDefaut` reste faux dès qu'on utilise la charte de quelqu'un, même
 * incomplète sur les champs facultatifs : c'est ce qui décidera plus tard du
 * ton de la signature en pied de document.
 */
export function resoudreCharte(brute: CharteBrute | null | undefined): Charte {
  const entreprise = brute?.entreprise?.trim();
  const principale = normaliserHex(brute?.principale);
  if (!entreprise || !principale) return CHARTE_CORPUSIMMO;

  const site = brute?.site?.trim();
  return {
    entreprise,
    site: site ? site.replace(/^https?:\/\//i, "").replace(/\/$/, "") : undefined,
    logo: brute?.logo ?? null,
    principale,
    secondaire: normaliserHex(brute?.secondaire) ?? undefined,
    parDefaut: false,
  };
}
