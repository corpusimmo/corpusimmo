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
import type { DocumentKind } from "@/lib/generators/documents";
import { sectionsFor } from "@/lib/generators/documents";
import { escapeXml, zipStored } from "./zip";

/* ── Géométrie ───────────────────────────────────────────────────────────── */

const EMU_PAR_POUCE = 914_400;

/** 16:9, la seule proportion qu'on projette encore en rendez-vous. */
const LARGEUR = 12_192_000;
const HAUTEUR = 6_858_000;

/** Trois quarts de pouce : la marge des modèles PowerPoint natifs. */
const MARGE = Math.round(0.75 * EMU_PAR_POUCE);

/** Un pouce et quart : de quoi loger deux lignes de titre sans rogner. */
const BANDEAU = Math.round(1.25 * EMU_PAR_POUCE);

/** Un filet fin, assez visible pour marquer la charte sans faire bordure. */
const FILET = Math.round(0.05 * EMU_PAR_POUCE);

/** Le pied tient sur une demi-ligne, posée à un demi-pouce du bord bas. */
const PIED_HAUTEUR = Math.round(0.3 * EMU_PAR_POUCE);
const PIED_Y = HAUTEUR - Math.round(0.5 * EMU_PAR_POUCE);

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
  /** `l` à gauche, `ctr` centré. */
  align?: "l" | "ctr";
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
}): string {
  const { id, nom, zone, fond, trait, textes = [], ancre = "ctr" } = options;

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
    `<a:bodyPr wrap="square" lIns="137160" tIns="91440" rIns="137160" bIns="91440" anchor="${ancre}">` +
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
function piedTexte(charte: Charte): string {
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

function diapoSection(titre: string, charte: Charte): string {
  const encre = encreLisible(charte.principale);
  const hautZone = BANDEAU + FILET + Math.round(MARGE / 2);

  return slideXml(
    rect({
      id: 2,
      nom: "Bandeau",
      zone: { x: 0, y: 0, cx: LARGEUR, cy: BANDEAU },
      fond: charte.principale,
      textes: [
        {
          contenu: titre,
          taille: 2800,
          couleur: encre,
          gras: true,
          align: "l",
        },
      ],
      ancre: "ctr",
    }) +
      rect({
        id: 3,
        nom: "Filet",
        zone: { x: 0, y: BANDEAU, cx: LARGEUR, cy: FILET },
        fond: charte.secondaire ?? charte.principale,
      }) +
      // La zone à remplir reste VIDE : pas de puce d'exemple, pas de « Lorem ».
      // Un texte de remplissage oublié dans un document envoyé au client est
      // exactement l'accident que cette trame doit éviter.
      rect({
        id: 4,
        nom: "Zone à remplir",
        zone: {
          x: MARGE,
          y: hautZone,
          cx: LARGEUR - 2 * MARGE,
          cy: PIED_Y - Math.round(MARGE / 2) - hautZone,
        },
        trait: GRIS_ZONE,
        ancre: "t",
      }) +
      pied(5, charte, GRIS_PIED),
  );
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
  const slides = [
    diapoTitre(kind, charte),
    ...sections.map((section) => diapoSection(section.label, charte)),
  ];

  // rId1 est le masque, rId2 le thème, puis une relation par diapositive : les
  // identifiants doivent être stables entre le fichier de relations et la
  // présentation, d'où ce décalage calculé une seule fois.
  const relSlide = (index: number): string => `rId${index + 3}`;

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
    "</Types>";

  const presentation =
    ENTETE +
    `<p:presentation ${NS_P}>` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    "<p:sldIdLst>" +
    slides
      // 256 est le premier identifiant de diapositive admis par la
      // spécification ; en dessous, PowerPoint refuse le fichier.
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="${relSlide(i)}"/>`)
      .join("") +
    "</p:sldIdLst>" +
    `<p:sldSz cx="${LARGEUR}" cy="${HAUTEUR}"/>` +
    `<p:notesSz cx="${HAUTEUR}" cy="${LARGEUR}"/>` +
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
      ...slides.flatMap((contenu, i) => [
        { name: `ppt/slides/slide${i + 1}.xml`, content: contenu },
        {
          name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
          content:
            ENTETE +
            `<Relationships ${NS_REL}>` +
            `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
            "</Relationships>",
        },
      ]),
    ],
    TYPE_MIME,
  );
}
