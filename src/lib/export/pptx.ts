/**
 * UNE TRAME POWERPOINT AUX COULEURS DU CLIENT, ÉCRITE À LA MAIN.
 *
 * CE QUE CE MODULE PRODUIT, ET CE QU'IL NE PRODUIT PAS. Des titres, des zones
 * vides, une charte. Aucun paragraphe rédigé, aucun chiffre : le professionnel
 * remplit lui-même, et c'est le point. Une trame livrée pré-remplie par une
 * machine se reconnaît en une diapositive et coûte au crédit de celui qui la
 * présente ; une trame vide à ses couleurs lui fait gagner l'heure de mise en
 * pages qu'il perdait vraiment.
 *
 * POURQUOI PAS UNE LIBRAIRIE. Même arbitrage que pour `xlsx.ts` : les
 * générateurs de `.pptx` pèsent plusieurs centaines de kilo-octets, payés par
 * tous les visiteurs y compris ceux qui n'exportent jamais. Le format n'est
 * qu'un ZIP de XML, et `zip.ts` sait déjà écrire le ZIP.
 *
 * CE QUI REND LE `.pptx` PLUS PÉNIBLE QUE LE `.xlsx`. Un classeur tolère à peu
 * près tout ; un diaporama exige une chaîne de relations complète. Chaque
 * diapositive pointe une mise en page, qui pointe un masque, qui pointe un
 * thème, et la présentation redéclare tout. Une seule relation manquante ne
 * donne pas une erreur lisible : PowerPoint annonce un fichier endommagé, sans
 * dire lequel des vingt fichiers est en cause. D'où les tests qui relisent
 * l'archive et vérifient que tout ce qui est déclaré existe.
 *
 * LES UNITÉS. L'OOXML de dessin compte en EMU : 914 400 par pouce, un entier
 * divisible à la fois par les pouces, les centimètres et les points, ce qui
 * évite les arrondis. Une diapositive 16:9 fait 12 192 000 x 6 858 000 EMU,
 * soit 13,333 x 7,5 pouces.
 */

import type { Charte, Hex } from "@/lib/brand/charte";
import { encreLisible } from "@/lib/brand/charte";
import type { DocumentKind, DocumentSection } from "@/lib/generators/documents";
import { sectionsFor } from "@/lib/generators/documents";
import { escapeXml, zipStored } from "./zip";

/* ── Géométrie ───────────────────────────────────────────────────────────── */

const EMU_PAR_POUCE = 914_400;

/** 16:9, la seule proportion qu'on projette encore en rendez-vous. */
const LARGEUR = 12_192_000;
const HAUTEUR = 6_858_000;

/** La page de notes reste au A4 portrait des modèles Office : 7,5 x 10 pouces. */
const NOTES_L = Math.round(7.5 * EMU_PAR_POUCE);
const NOTES_H = Math.round(10 * EMU_PAR_POUCE);

/** Trois quarts de pouce : la marge des modèles PowerPoint natifs. */
const MARGE = Math.round(0.75 * EMU_PAR_POUCE);

/** Un pouce et quart : de quoi loger deux lignes de titre sans rogner. */
const BANDEAU = Math.round(1.25 * EMU_PAR_POUCE);

/** Un filet fin, assez visible pour marquer la charte sans faire bordure. */
const FILET = Math.round(0.05 * EMU_PAR_POUCE);

/** Le pied tient sur une demi-ligne, posée à un demi-pouce du bord bas. */
const PIED_HAUTEUR = Math.round(0.3 * EMU_PAR_POUCE);
const PIED_Y = HAUTEUR - Math.round(0.5 * EMU_PAR_POUCE);

/** Le retrait du texte dans sa forme : 0,15 pouce, comme les modèles Office. */
const RETRAIT_TEXTE = Math.round(0.15 * EMU_PAR_POUCE);

/**
 * Le gris du pied de page.
 *
 * Volontairement hors charte : le pied ne doit pas concurrencer le titre, et
 * une couleur de marque en petit corps sur fond blanc tombe souvent sous le
 * seuil de contraste. Ce gris passe le 4.5:1 sur blanc.
 */
const GRIS_PIED: Hex = "#5b6472";

/** Le liseré des zones à remplir : visible à l'écran, discret à l'impression. */
const GRIS_ZONE: Hex = "#d4d7dd";

/**
 * Le fond des blocs de clauses.
 *
 * Un avertissement de confidentialité et des limites de mission ne se lisent
 * pas comme le reste : ce sont des pavés denses, qu'on parcourt et qu'on ne
 * projette pas. Un aplat très clair les distingue sans les mettre en avant,
 * et surtout sans coûter d'encre à l'impression.
 */
const GRIS_BLOC: Hex = "#f4f5f7";

/* ── Couleurs ────────────────────────────────────────────────────────────── */

/** `#14293c` → `14293C`. L'OOXML veut six hexa sans dièse, en majuscules. */
function srgb(hex: Hex): string {
  return hex.replace("#", "").toUpperCase();
}

/* ── Briques XML ─────────────────────────────────────────────────────────── */

const ENTETE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const NS_P =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const NS_REL = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';

/**
 * L'ossature obligatoire d'un arbre de formes.
 *
 * L'identifiant 1 est réservé au groupe racine par la spécification ; les
 * formes commencent donc à 2. Un doublon d'identifiant dans une diapositive
 * suffit à faire déclarer le fichier endommagé.
 */
function spTree(formes: string): string {
  return (
    "<p:spTree>" +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    formes +
    "</p:spTree>"
  );
}

interface Zone {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

interface Texte {
  contenu: string;
  /** Corps en centièmes de point : `2800` vaut 28 pt. */
  taille: number;
  couleur: Hex;
  gras?: boolean;
  /** `l` à gauche, `ctr` centré, `r` à droite. */
  align?: "l" | "ctr" | "r";
  /** `t` en haut, `ctr` au milieu. */
  ancre?: "t" | "ctr";
}

function paragraphe(texte: Texte): string {
  const align = ` algn="${texte.align ?? "l"}"`;
  const gras = texte.gras ? ' b="1"' : "";
  return (
    `<a:p><a:pPr${align}/><a:r>` +
    `<a:rPr lang="fr-FR" sz="${texte.taille}"${gras} dirty="0">` +
    `<a:solidFill><a:srgbClr val="${srgb(texte.couleur)}"/></a:solidFill>` +
    "</a:rPr>" +
    `<a:t>${escapeXml(texte.contenu)}</a:t>` +
    "</a:r></a:p>"
  );
}

/**
 * Une forme rectangulaire, avec ou sans texte.
 *
 * `fond` et `trait` sont optionnels séparément : une zone à remplir est un
 * rectangle sans fond mais avec un liseré, un bandeau est l'inverse.
 */
function rect(options: {
  id: number;
  nom: string;
  zone: Zone;
  fond?: Hex;
  trait?: Hex;
  textes?: Texte[];
  ancre?: "t" | "ctr";
  /**
   * Retrait interne à gauche et à droite, en EMU. Sert au bandeau, qui va
   * d'un bord à l'autre de la diapositive mais dont le titre doit s'aligner
   * sur la marge du reste de la page.
   */
  retrait?: number;
}): string {
  const { id, nom, zone, fond, trait, textes = [], ancre = "ctr", retrait = RETRAIT_TEXTE } = options;

  const remplissage = fond
    ? `<a:solidFill><a:srgbClr val="${srgb(fond)}"/></a:solidFill>`
    : "<a:noFill/>";
  const bordure = trait
    ? `<a:ln w="${Math.round(EMU_PAR_POUCE / 1200)}"><a:solidFill>` +
      `<a:srgbClr val="${srgb(trait)}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";

  // Une forme sans paragraphe est invalide : il en faut un, fût-il vide.
  const corps = textes.length ? textes.map(paragraphe).join("") : "<a:p/>";

  return (
    "<p:sp>" +
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(nom)}"/>` +
    '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    "<p:spPr>" +
    `<a:xfrm><a:off x="${zone.x}" y="${zone.y}"/><a:ext cx="${zone.cx}" cy="${zone.cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    remplissage +
    bordure +
    "</p:spPr>" +
    "<p:txBody>" +
    `<a:bodyPr wrap="square" lIns="${retrait}" tIns="91440" rIns="${retrait}" bIns="91440" anchor="${ancre}">` +
    "<a:normAutofit/></a:bodyPr><a:lstStyle/>" +
    corps +
    "</p:txBody>" +
    "</p:sp>"
  );
}

/* ── Le thème ────────────────────────────────────────────────────────────── */

/**
 * Le thème porte la charte.
 *
 * Poser les couleurs ICI plutôt que sur chaque forme n'est pas qu'une économie
 * d'octets : celui qui recevra la trame et ajoutera une diapositive obtiendra
 * les bonnes couleurs dans le sélecteur de PowerPoint, au lieu d'un thème
 * Office standard qui jurerait avec les diapositives fournies.
 */
function themeXml(charte: Charte): string {
  const un = srgb(charte.principale);
  const deux = srgb(charte.secondaire ?? charte.principale);

  // Trois styles de remplissage, de trait et d'effet : la spécification en
  // exige exactement trois de chaque, même quand ils sont identiques.
  const fills =
    '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>';
  const lines =
    '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>';
  const effects =
    "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>" +
    "<a:effectStyle><a:effectLst/></a:effectStyle>" +
    "<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>";
  const bgFills =
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>';

  return (
    ENTETE +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Charte">' +
    "<a:themeElements>" +
    '<a:clrScheme name="Charte">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    `<a:dk2><a:srgbClr val="${un}"/></a:dk2>` +
    '<a:lt2><a:srgbClr val="F4F5F7"/></a:lt2>' +
    `<a:accent1><a:srgbClr val="${un}"/></a:accent1>` +
    `<a:accent2><a:srgbClr val="${deux}"/></a:accent2>` +
    `<a:accent3><a:srgbClr val="${un}"/></a:accent3>` +
    `<a:accent4><a:srgbClr val="${deux}"/></a:accent4>` +
    `<a:accent5><a:srgbClr val="${un}"/></a:accent5>` +
    `<a:accent6><a:srgbClr val="${deux}"/></a:accent6>` +
    `<a:hlink><a:srgbClr val="${un}"/></a:hlink>` +
    `<a:folHlink><a:srgbClr val="${deux}"/></a:folHlink>` +
    "</a:clrScheme>" +
    '<a:fontScheme name="Charte">' +
    '<a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
    "</a:fontScheme>" +
    '<a:fmtScheme name="Charte">' +
    fills +
    lines +
    effects +
    bgFills +
    "</a:fmtScheme>" +
    "</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"
  );
}

/* ── Masque et mise en page ──────────────────────────────────────────────── */

/**
 * La table de correspondance des couleurs.
 *
 * Elle est OBLIGATOIRE sur le masque, y compris quand on n'utilise aucune
 * couleur de thème dans les formes : PowerPoint la lit avant tout le reste.
 */
const CLR_MAP =
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ' +
  'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" ' +
  'accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

function masterXml(): string {
  return (
    ENTETE +
    `<p:sldMaster ${NS_P}>` +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill>' +
    "<a:effectLst/></p:bgPr></p:bg>" +
    spTree("") +
    "</p:cSld>" +
    CLR_MAP +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    "</p:sldMaster>"
  );
}

/**
 * Une seule mise en page, de type « vide ».
 *
 * Les trames ne posent pas d'espaces réservés : chaque forme est placée
 * explicitement, à des coordonnées calculées. Multiplier les mises en page
 * n'apporterait rien tant qu'on ne s'appuie pas sur l'héritage.
 */
function layoutXml(): string {
  return (
    ENTETE +
    `<p:sldLayout ${NS_P} type="blank" preserve="1">` +
    '<p:cSld name="Vide">' +
    spTree("") +
    "</p:cSld>" +
    "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>" +
    "</p:sldLayout>"
  );
}

/* ── Les diapositives ────────────────────────────────────────────────────── */

function slideXml(formes: string, fond?: Hex): string {
  const bg = fond
    ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${srgb(fond)}"/></a:solidFill>` +
      "<a:effectLst/></p:bgPr></p:bg>"
    : "";
  return (
    ENTETE +
    `<p:sld ${NS_P}>` +
    `<p:cSld>${bg}${spTree(formes)}</p:cSld>` +
    "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>" +
    "</p:sld>"
  );
}

/**
 * Le pied de page.
 *
 * La signature « Trame générée avec CorpusImmo » n'apparaît QUE sur la charte
 * d'un client. Sur la nôtre, le nom de l'entreprise en pied dit déjà
 * CorpusImmo, et le répéter deux fois sur la même ligne fait amateur.
 */
/**
 * Le pied de page, exporté pour que le test du vocabulaire s'y réfère.
 *
 * Le test doit connaître tous les textes légitimes du document ; recopier la
 * règle du pied chez lui en ferait une seconde définition, qui finirait par
 * diverger de celle-ci et passerait au vert en éprouvant autre chose.
 */
export function piedTexte(charte: Charte): string {
  const parts = [charte.entreprise];
  if (charte.site) parts.push(charte.site);
  if (!charte.parDefaut) parts.push("Trame générée avec CorpusImmo");
  return parts.join("  ·  ");
}

function pied(id: number, charte: Charte, couleur: Hex): string {
  return rect({
    id,
    nom: "Pied de page",
    zone: { x: MARGE, y: PIED_Y, cx: LARGEUR - 2 * MARGE, cy: PIED_HAUTEUR },
    textes: [{ contenu: piedTexte(charte), taille: 900, couleur }],
    ancre: "ctr",
  });
}

/**
 * LE BANDEAU DE SECTION, commun à tous les gabarits.
 *
 * Il porte le titre ET le rang de la diapositive. Le rang n'est pas une
 * coquetterie de mise en pages : un dossier qui circule en réunion se cite
 * (« revenons à la sept »), et une liasse imprimée qui tombe se remet dans
 * l'ordre.
 */
function bandeau(
  titre: string,
  rang: number,
  total: number,
  charte: Charte,
): string {
  const encre = encreLisible(charte.principale);
  const largeurRang = Math.round(1.6 * EMU_PAR_POUCE);

  return (
    rect({
      id: 2,
      nom: "Bandeau",
      zone: { x: 0, y: 0, cx: LARGEUR, cy: BANDEAU },
      fond: charte.principale,
      textes: [{ contenu: titre, taille: 2400, couleur: encre, gras: true, align: "l" }],
      ancre: "ctr",
      retrait: MARGE,
    }) +
    rect({
      id: 3,
      nom: "Rang",
      zone: {
        x: LARGEUR - MARGE - largeurRang,
        y: 0,
        cx: largeurRang,
        cy: BANDEAU,
      },
      textes: [
        {
          contenu: `${String(rang).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
          taille: 1200,
          couleur: encre,
          align: "r",
        },
      ],
      ancre: "ctr",
      retrait: 0,
    }) +
    rect({
      id: 4,
      nom: "Filet",
      zone: { x: 0, y: BANDEAU, cx: LARGEUR, cy: FILET },
      fond: charte.secondaire ?? charte.principale,
    })
  );
}

/** Le haut et la hauteur du corps, sous le bandeau et au-dessus du pied. */
const CORPS_Y = BANDEAU + FILET + Math.round(MARGE / 2);
const CORPS_H = PIED_Y - Math.round(MARGE / 2) - CORPS_Y;
const CORPS_L = LARGEUR - 2 * MARGE;

/** L'espace entre deux zones voisines : un quart de pouce. */
const GOUTTIERE = Math.round(0.25 * EMU_PAR_POUCE);

/** La hauteur d'un sous-titre de volet ou d'un libellé d'indicateur. */
const ETIQUETTE_H = Math.round(0.3 * EMU_PAR_POUCE);

/* ── Les gabarits ────────────────────────────────────────────────────────── */

/** Une zone de rédaction, vide, avec son liseré. */
function zoneVide(id: number, nom: string, zone: Zone, fond?: Hex): string {
  return rect({ id, nom, zone, trait: fond ? undefined : GRIS_ZONE, fond, ancre: "t" });
}

function corpsTexte(dense: boolean): string {
  return zoneVide(
    10,
    dense ? "Bloc de clauses" : "Zone à remplir",
    { x: MARGE, y: CORPS_Y, cx: CORPS_L, cy: CORPS_H },
    dense ? GRIS_BLOC : undefined,
  );
}

function corpsColonnes(volets: readonly string[], charte: Charte): string {
  const largeur = Math.round((CORPS_L - GOUTTIERE) / 2);
  const hauteurZone = CORPS_H - ETIQUETTE_H;

  return volets
    .slice(0, 2)
    .map((volet, i) => {
      const x = MARGE + i * (largeur + GOUTTIERE);
      return (
        rect({
          id: 10 + i * 2,
          nom: `Volet ${i + 1}`,
          zone: { x, y: CORPS_Y, cx: largeur, cy: ETIQUETTE_H },
          textes: [
            { contenu: volet, taille: 1200, couleur: charte.principale, gras: true },
          ],
          ancre: "ctr",
          retrait: 0,
        }) +
        zoneVide(11 + i * 2, `Zone ${i + 1}`, {
          x,
          y: CORPS_Y + ETIQUETTE_H,
          cx: largeur,
          cy: hauteurZone,
        })
      );
    })
    .join("");
}

/**
 * Un vrai tableau, en-tête nommé et lignes vides.
 *
 * SIX LIGNES, et ce nombre est un compromis assumé : assez pour qu'on voie
 * qu'il s'agit d'un tableau et pour qu'un rent roll court tienne sans être
 * retouché, assez peu pour qu'elles restent lisibles à la projection. Celui
 * qui en veut douze en ajoute, ce qui prend cinq secondes ; celui qui en
 * reçoit vingt vides doit toutes les supprimer.
 */
const LIGNES_TABLEAU = 6;

function corpsTableau(colonnes: readonly string[], charte: Charte): string {
  const encre = encreLisible(charte.principale);
  const largeur = Math.round(CORPS_L / colonnes.length);
  const hauteurEntete = Math.round(0.38 * EMU_PAR_POUCE);
  const hauteurLigne = Math.min(
    Math.round(0.42 * EMU_PAR_POUCE),
    Math.round((CORPS_H - hauteurEntete) / LIGNES_TABLEAU),
  );

  let id = 10;
  const entete = colonnes
    .map((colonne, c) =>
      rect({
        id: id++,
        nom: `En-tête ${c + 1}`,
        zone: {
          x: MARGE + c * largeur,
          y: CORPS_Y,
          cx: largeur,
          cy: hauteurEntete,
        },
        fond: charte.principale,
        textes: [{ contenu: colonne, taille: 1000, couleur: encre, gras: true }],
        ancre: "ctr",
      }),
    )
    .join("");

  const lignes = Array.from({ length: LIGNES_TABLEAU }, (_, l) =>
    colonnes
      .map((_colonne, c) =>
        rect({
          id: id++,
          nom: `Cellule ${l + 1}.${c + 1}`,
          zone: {
            x: MARGE + c * largeur,
            y: CORPS_Y + hauteurEntete + l * hauteurLigne,
            cx: largeur,
            cy: hauteurLigne,
          },
          trait: GRIS_ZONE,
          ancre: "ctr",
        }),
      )
      .join(""),
  ).join("");

  return entete + lignes;
}

function corpsChiffres(indicateurs: readonly string[]): string {
  const n = Math.min(indicateurs.length, 4) || 1;
  const largeur = Math.round((CORPS_L - (n - 1) * GOUTTIERE) / n);
  const hauteurPave = Math.round(CORPS_H * 0.45);

  let id = 10;
  const paves = indicateurs
    .slice(0, 4)
    .map((indicateur, i) => {
      const x = MARGE + i * (largeur + GOUTTIERE);
      return (
        rect({
          id: id++,
          nom: `Libellé ${i + 1}`,
          zone: { x, y: CORPS_Y, cx: largeur, cy: ETIQUETTE_H },
          textes: [
            { contenu: indicateur, taille: 1000, couleur: GRIS_PIED, gras: true },
          ],
          ancre: "ctr",
          retrait: 0,
        }) +
        zoneVide(id++, `Valeur ${i + 1}`, {
          x,
          y: CORPS_Y + ETIQUETTE_H,
          cx: largeur,
          cy: hauteurPave,
        })
      );
    })
    .join("");

  // Sous les pavés, la place du commentaire : un indicateur sans phrase qui
  // l'interprète se retourne contre celui qui le présente.
  const hautCommentaire = CORPS_Y + ETIQUETTE_H + hauteurPave + GOUTTIERE;
  return (
    paves +
    zoneVide(id++, "Commentaire", {
      x: MARGE,
      y: hautCommentaire,
      cx: CORPS_L,
      cy: CORPS_Y + CORPS_H - hautCommentaire,
    })
  );
}

function corpsImage(): string {
  const hauteurLegende = Math.round(0.4 * EMU_PAR_POUCE);
  const hauteurReserve = CORPS_H - hauteurLegende - GOUTTIERE;
  // La réserve garde la proportion 3:2 des appareils courants tant que la
  // largeur le permet : une image posée dans un cadre 16:9 est recadrée par
  // celui qui la dépose, et il la recadre mal.
  const largeurReserve = Math.min(CORPS_L, Math.round(hauteurReserve * 1.5));
  const x = MARGE + Math.round((CORPS_L - largeurReserve) / 2);

  return (
    zoneVide(10, "Réserve d'image", {
      x,
      y: CORPS_Y,
      cx: largeurReserve,
      cy: hauteurReserve,
    }) +
    zoneVide(11, "Légende", {
      x,
      y: CORPS_Y + hauteurReserve + GOUTTIERE,
      cx: largeurReserve,
      cy: hauteurLegende,
    })
  );
}

function diapoSection(
  section: DocumentSection,
  rang: number,
  total: number,
  charte: Charte,
): string {
  const gabarit = section.gabarit ?? "texte";

  const corps =
    gabarit === "colonnes"
      ? corpsColonnes(section.volets ?? ["", ""], charte)
      : gabarit === "tableau"
        ? corpsTableau(section.colonnes ?? [], charte)
        : gabarit === "chiffres"
          ? corpsChiffres(section.indicateurs ?? [])
          : gabarit === "image"
            ? corpsImage()
            : corpsTexte(gabarit === "legal");

  return slideXml(
    bandeau(section.label, rang, total, charte) + corps + pied(5, charte, GRIS_PIED),
  );
}

/* ── Les diapositives de cadre ───────────────────────────────────────────── */

function diapoTitre(kind: DocumentKind, charte: Charte): string {
  const encre = encreLisible(charte.principale);
  const bloc = HAUTEUR - 2 * BANDEAU;

  return slideXml(
    rect({
      id: 2,
      nom: "Titre",
      zone: { x: MARGE, y: BANDEAU, cx: LARGEUR - 2 * MARGE, cy: bloc },
      textes: [
        { contenu: kind.label, taille: 4400, couleur: encre, gras: true },
        // L'audience sous le titre : c'est ce qui empêche qu'un mémorandum
        // parte à qui devait recevoir un teaser. Elle est dans la taxonomie,
        // elle n'est pas réécrite ici.
        { contenu: kind.audience, taille: 1400, couleur: encre },
        { contenu: charte.entreprise, taille: 1800, couleur: encre },
      ],
      ancre: "ctr",
    }) +
      // Le filet reprend la couleur d'appui : c'est le seul endroit du document
      // où elle est visible en aplat, et il en faut au moins un pour que la
      // seconde couleur de la charte serve à quelque chose.
      rect({
        id: 3,
        nom: "Filet",
        zone: {
          x: MARGE,
          y: BANDEAU + bloc,
          cx: Math.round((LARGEUR - 2 * MARGE) / 4),
          cy: FILET,
        },
        fond: charte.secondaire ?? encre,
      }) +
      pied(4, charte, encre),
    charte.principale,
  );
}

/**
 * LE SOMMAIRE, en deux colonnes.
 *
 * C'est la diapositive qui transforme une pile de pages en dossier : elle
 * annonce ce qui est traité, donc aussi ce qui ne l'est pas, et elle donne au
 * lecteur pressé le droit d'aller directement à la page qui l'intéresse.
 *
 * Les rangs sont ceux des diapositives, pas ceux des sections : le sommaire
 * étant lui-même la deuxième page, la première section porte le rang 3. Un
 * sommaire dont les renvois sont décalés d'un cran est pire qu'aucun sommaire.
 */
function diapoSommaire(
  sections: readonly DocumentSection[],
  charte: Charte,
): string {
  const moitie = Math.ceil(sections.length / 2);
  const largeur = Math.round((CORPS_L - GOUTTIERE) / 2);

  const colonne = (depart: number, lot: readonly DocumentSection[], id: number) =>
    rect({
      id,
      nom: `Sommaire ${id}`,
      zone: {
        x: MARGE + (id === 10 ? 0 : largeur + GOUTTIERE),
        y: CORPS_Y,
        cx: largeur,
        cy: CORPS_H,
      },
      textes: lot.map((section, i) => ({
        contenu: `${String(depart + i).padStart(2, "0")}   ${section.label}`,
        taille: 1200,
        couleur: "#1f2733" as Hex,
        align: "l" as const,
      })),
      ancre: "t",
      retrait: 0,
    });

  return slideXml(
    bandeau("Sommaire", 2, sections.length + 3, charte) +
      colonne(3, sections.slice(0, moitie), 10) +
      colonne(3 + moitie, sections.slice(moitie), 11) +
      pied(5, charte, GRIS_PIED),
  );
}

/**
 * LA DERNIÈRE PAGE porte le contact, et rien d'autre.
 *
 * Un dossier qui se termine sur sa dernière section laisse le lecteur
 * convaincu sans savoir à qui écrire. C'est la page la plus rentable du
 * document, et celle qu'on oublie le plus souvent.
 */
function diapoContact(charte: Charte, rang: number, total: number): string {
  const encre = encreLisible(charte.principale);

  return slideXml(
    rect({
      id: 2,
      nom: "Contact",
      zone: {
        x: MARGE,
        y: BANDEAU,
        cx: LARGEUR - 2 * MARGE,
        cy: HAUTEUR - 2 * BANDEAU,
      },
      textes: [
        { contenu: charte.entreprise, taille: 3200, couleur: encre, gras: true },
        ...(charte.site
          ? [{ contenu: charte.site, taille: 1400, couleur: encre }]
          : []),
      ],
      ancre: "ctr",
    }) +
      rect({
        id: 3,
        nom: "Rang",
        zone: {
          x: MARGE,
          y: PIED_Y - PIED_HAUTEUR,
          cx: LARGEUR - 2 * MARGE,
          cy: PIED_HAUTEUR,
        },
        textes: [
          {
            contenu: `${String(rang).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
            taille: 1000,
            couleur: encre,
            align: "r",
          },
        ],
        ancre: "ctr",
        retrait: 0,
      }) +
      pied(4, charte, encre),
    charte.principale,
  );
}

/* ── Les pages de notes ─────────────────────────────────────────────────── */

/**
 * CE QUI FAIT LA DIFFÉRENCE ENTRE UNE TRAME ET UN DOSSIER.
 *
 * Chaque diapositive part avec sa page de notes : ce qu'on attend dans cette
 * section, dans quel ordre, et le piège du document. C'est la connaissance de
 * métier qui vaut le plus, et c'est exactement ce qu'une trame vide ne
 * transmet pas.
 *
 * LES NOTES, ET PAS LA DIAPOSITIVE. Un texte d'aide posé sur la page est un
 * texte d'aide qu'on oublie d'effacer, et qui part chez le client. Les notes
 * ne s'affichent jamais à la projection ; elles se lisent en préparant.
 */
function notesSlideXml(paragraphes: readonly string[]): string {
  const corps = paragraphes
    .filter(Boolean)
    .map(
      (texte) =>
        `<a:p><a:r><a:rPr lang="fr-FR" dirty="0"/>` +
        `<a:t>${escapeXml(texte)}</a:t></a:r></a:p>`,
    )
    .join("");

  return (
    ENTETE +
    `<p:notes ${NS_P}><p:cSld>` +
    spTree(
      "<p:sp>" +
        '<p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
        '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
        "<p:spPr/>" +
        `<p:txBody><a:bodyPr/><a:lstStyle/>${corps || "<a:p/>"}</p:txBody>` +
        "</p:sp>",
    ) +
    "</p:cSld></p:notes>"
  );
}

/**
 * Le masque des notes, réduit à ce que la spécification exige.
 *
 * PowerPoint refuse une présentation qui déclare des pages de notes sans le
 * masque qui les gouverne, et l'erreur affichée parle de fichier endommagé,
 * pas de masque manquant. Il ne porte donc aucun dessin : sa seule raison
 * d'être est d'exister et de renvoyer à un thème.
 */
function notesMasterXml(): string {
  return (
    ENTETE +
    `<p:notesMaster ${NS_P}><p:cSld>` +
    spTree("") +
    "</p:cSld>" +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"' +
    ' accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5"' +
    ' accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    "</p:notesMaster>"
  );
}

/** Les notes d'une section : ce qu'on y met, et d'où viennent les chiffres. */
function notesDeSection(section: DocumentSection, kind: DocumentKind): string[] {
  return [
    section.label,
    section.attendu ?? "",
    section.computed
      ? "Section alimentée par les moteurs de CorpusImmo : les valeurs arrivent calculées sur les mutations enregistrées. Elle se contrôle, elle ne se rédige pas."
      : "",
    `Document : ${kind.label}. ${kind.pitfall}`,
  ];
}

/* ── L'assemblage ────────────────────────────────────────────────────────── */

const TYPE_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.presentationml";

/**
 * La trame complète, pour un type de document et une charte.
 *
 * La liste des diapositives vient de `sectionsFor` et de nulle part ailleurs :
 * c'est ce qui garantit qu'un teaser ne recevra jamais de diapositive « Baux et
 * revenus ». Recopier ici une liste de sections serait la deuxième définition
 * qui finit par diverger de la première, et ce qui divergerait n'est pas
 * cosmétique — c'est le niveau de confidentialité du document.
 */
export function buildPptx(kind: DocumentKind, charte: Charte): Blob {
  const sections = sectionsFor(kind);

  /**
   * LE DOSSIER, ET NON UNE PILE DE SECTIONS.
   *
   * Couverture, sommaire, les sections dans l'ordre de la taxonomie, puis le
   * contact. Le total est calculé une fois et passé partout : c'est lui qui
   * apparaît dans « 04 / 17 » sur chaque page, et un total faux sur une seule
   * diapositive se voit immédiatement.
   */
  const total = sections.length + 3;
  const notes: readonly (readonly string[])[] = [
    [
      kind.label,
      `Pour : ${kind.audience}`,
      `Quand : ${kind.moment}`,
      `Volume habituel : ${kind.pages}`,
      kind.pitfall,
      ...(kind.notToConfuse ? [kind.notToConfuse] : []),
    ],
    [
      "Sommaire",
      "Retirez ici les sections que vous ne traitez pas, et supprimez les pages correspondantes. Un sommaire qui annonce une section absente se remarque tout de suite.",
    ],
    ...sections.map((section) => notesDeSection(section, kind)),
    [
      "Contact",
      "Un interlocuteur nommé, sa ligne directe et son adresse. Un contact générique fait perdre les deux jours qui comptent.",
    ],
  ];

  const slides = [
    diapoTitre(kind, charte),
    diapoSommaire(sections, charte),
    ...sections.map((section, i) =>
      diapoSection(section, i + 3, total, charte),
    ),
    diapoContact(charte, total, total),
  ];

  // rId1 est le masque, rId2 le thème, puis une relation par diapositive : les
  // identifiants doivent être stables entre le fichier de relations et la
  // présentation, d'où ce décalage calculé une seule fois.
  const relSlide = (index: number): string => `rId${index + 3}`;
  /** Le masque de notes vient APRÈS les diapositives, pour ne rien renuméroter. */
  const relNotesMaster = `rId${slides.length + 3}`;

  const contentTypes =
    ENTETE +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}.slideLayout+xml"/>` +
    slides
      .map(
        (_, i) =>
          `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT}.slide+xml"/>`,
      )
      .join("") +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="${CT}.notesMaster+xml"/>` +
    slides
      .map(
        (_, i) =>
          `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="${CT}.notesSlide+xml"/>`,
      )
      .join("") +
    "</Types>";

  const presentation =
    ENTETE +
    `<p:presentation ${NS_P}>` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    // L'ORDRE EST IMPOSÉ par le schéma : masques de diapositives, puis masque
    // de notes, puis la liste des diapositives. Interverti, le fichier est
    // refusé sans que rien ne dise pourquoi.
    `<p:notesMasterIdLst><p:notesMasterId r:id="${relNotesMaster}"/></p:notesMasterIdLst>` +
    "<p:sldIdLst>" +
    slides
      // 256 est le premier identifiant de diapositive admis par la
      // spécification ; en dessous, PowerPoint refuse le fichier.
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="${relSlide(i)}"/>`)
      .join("") +
    "</p:sldIdLst>" +
    `<p:sldSz cx="${LARGEUR}" cy="${HAUTEUR}"/>` +
    `<p:notesSz cx="${NOTES_L}" cy="${NOTES_H}"/>` +
    "</p:presentation>";

  const presentationRels =
    ENTETE +
    `<Relationships ${NS_REL}>` +
    `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/theme" Target="theme/theme1.xml"/>` +
    slides
      .map(
        (_, i) =>
          `<Relationship Id="${relSlide(i)}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="${relNotesMaster}" Type="${REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/>` +
    "</Relationships>";

  return zipStored(
    [
      { name: "[Content_Types].xml", content: contentTypes },
      {
        name: "_rels/.rels",
        content:
          ENTETE +
          `<Relationships ${NS_REL}>` +
          `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>` +
          "</Relationships>",
      },
      { name: "ppt/presentation.xml", content: presentation },
      { name: "ppt/_rels/presentation.xml.rels", content: presentationRels },
      { name: "ppt/slideMasters/slideMaster1.xml", content: masterXml() },
      {
        name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
        content:
          ENTETE +
          `<Relationships ${NS_REL}>` +
          `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
          `<Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/>` +
          "</Relationships>",
      },
      { name: "ppt/slideLayouts/slideLayout1.xml", content: layoutXml() },
      {
        name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
        content:
          ENTETE +
          `<Relationships ${NS_REL}>` +
          `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
          "</Relationships>",
      },
      { name: "ppt/theme/theme1.xml", content: themeXml(charte) },
      // Le masque de notes veut SON thème. Partager `theme1` entre deux
      // masques est toléré par certains lecteurs et refusé par d'autres ;
      // écrire deux fois le même contenu coûte trois kilo-octets et ne se
      // discute plus jamais.
      { name: "ppt/theme/theme2.xml", content: themeXml(charte) },
      { name: "ppt/notesMasters/notesMaster1.xml", content: notesMasterXml() },
      {
        name: "ppt/notesMasters/_rels/notesMaster1.xml.rels",
        content:
          ENTETE +
          `<Relationships ${NS_REL}>` +
          `<Relationship Id="rId1" Type="${REL}/theme" Target="../theme/theme2.xml"/>` +
          "</Relationships>",
      },
      ...slides.flatMap((_, i) => [
        {
          name: `ppt/notesSlides/notesSlide${i + 1}.xml`,
          content: notesSlideXml(notes[i] ?? []),
        },
        {
          name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`,
          content:
            ENTETE +
            `<Relationships ${NS_REL}>` +
            `<Relationship Id="rId1" Type="${REL}/notesMaster" Target="../notesMasters/notesMaster1.xml"/>` +
            `<Relationship Id="rId2" Type="${REL}/slide" Target="../slides/slide${i + 1}.xml"/>` +
            "</Relationships>",
        },
      ]),
      ...slides.flatMap((contenu, i) => [
        { name: `ppt/slides/slide${i + 1}.xml`, content: contenu },
        {
          name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
          content:
            ENTETE +
            `<Relationships ${NS_REL}>` +
            `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
            `<Relationship Id="rId2" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/>` +
            "</Relationships>",
        },
      ]),
    ],
    TYPE_MIME,
  );
}
