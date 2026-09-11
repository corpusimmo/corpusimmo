/**
 * LE KIT LINKEDIN, DESSINÉ ICI PLUTÔT QUE DANS UN OUTIL DE DESIGN.
 *
 * POURQUOI DANS LE DÉPÔT. Une bannière de profil et des vignettes de section
 * « Sélection » portent la marque autant que le site : mêmes couleurs, même
 * logotype, même signature. Faites à la main dans un éditeur, elles dérivent
 * dès la première retouche de la palette — et personne ne s'en aperçoit,
 * parce que personne ne relit un PNG. Ici, elles se REGÉNÈRENT : la palette
 * change, on relance, tout suit.
 *
 * COMMENT. `next/og`, le même moteur que les vignettes de partage du site
 * (`src/lib/seo/og-image.tsx`), avec les mêmes fontes versionnées. Aucune
 * dépendance de plus, aucun appel réseau.
 *
 * CE QUE ÇA PRODUIT, dans `public/brand/linkedin/` :
 *   · trois bannières de profil 1584 × 396 — la marque seule, Mathieu, Gaël ;
 *   · quatre vignettes 1200 × 627 pour la section « Sélection ».
 *
 * LES DIMENSIONS SONT CELLES DE LINKEDIN, et la zone utile ne l'est pas : sur
 * une bannière de profil, la photo ronde mange le coin bas-gauche et la carte
 * du profil recouvre le bas sur mobile. Tout le texte tient donc dans la
 * moitié droite et au-dessus de la ligne des deux tiers.
 *
 *   node scripts/kit-linkedin.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og.js";

const RACINE = process.cwd();
const SORTIE = path.join(RACINE, "public/brand/linkedin");
const FONTES = path.join(RACINE, "src/lib/seo/fonts");

/* ── Palette, recopiée de globals.css ────────────────────────────────────── */

const NUIT = "#0f1e2b";
const VIOLET = "#8b7cc4";
const VIOLET_PALE = "#e9e4f6";
const RESERVE = "#ffffff";

const DISPLAY = "Manrope";
const BODY = "Inter";

/** Un nœud Satori, écrit à la main : ce script n'embarque pas de JSX. */
const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length <= 1 ? children[0] : children },
});

/* ── Les deux signes, lus sur le disque ──────────────────────────────────── */

/**
 * LE SIGNE DE CORPUSIMMO EST CELUI DU SITE, pas un tracé de substitution.
 *
 * Une première version redessinait un logotype en SVG, faute de pouvoir
 * rendre le composant React dans une image. Le résultat divergeait du signe
 * servi par le site : la bannière montrait une marque que personne ne
 * retrouvait en arrivant. Le fichier est donc embarqué, converti en PNG
 * parce que Satori ne lit pas le WebP.
 *
 * LE SIGNE DE SCALENVIA voyage à côté. Il n'appartient pas à ce produit, mais
 * la bannière de Mathieu doit porter les deux : CorpusImmo est ce qu'il
 * construit, Scalenvia est le studio qui le construit, et un profil qui tait
 * l'un des deux ment par omission sur ce qu'il fait de ses journées.
 */
async function dataPng(nom) {
  const octets = await readFile(path.join(RACINE, "scripts/assets", nom));
  return `data:image/png;base64,${octets.toString("base64")}`;
}

let SIGNE_CORPUSIMMO = "";
let SIGNE_SCALENVIA = "";

/**
 * Le signe sur sa plaque claire, comme le pied de page du site.
 *
 * Les deux signes ont des faces sombres : posés à même le fond nuit, ils s'y
 * enfoncent et il ne reste qu'un éclat. La plaque leur rend le fond pour
 * lequel ils ont été dessinés.
 */
function plaque(source, cote, largeur, hauteur, rayon) {
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: cote,
        height: cote,
        borderRadius: rayon,
        backgroundColor: RESERVE,
      },
    },
    el("img", { src: source, width: largeur, height: hauteur }),
  );
}

/* ── Gabarits ────────────────────────────────────────────────────────────── */


/**
 * LE FOND : nuit, une nappe violette en haut à droite, une trame de filets.
 *
 * La trame n'est pas un ornement gratuit : elle dit le corpus, la grille de
 * données, sans le mot. Elle reste sous 6 % d'opacité, où elle se sent plus
 * qu'elle ne se voit.
 */
function fond(largeur, hauteur) {
  return {
    display: "flex",
    width: largeur,
    height: hauteur,
    backgroundColor: NUIT,
    backgroundImage:
      `radial-gradient(circle at 85% 15%, rgba(139,124,196,0.42), rgba(15,30,43,0) 58%),` +
      `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),` +
      `linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
    backgroundSize: `100% 100%, 44px 44px, 44px 44px`,
    position: "relative",
  };
}

function logotype(taille, corps) {
  return el(
    "div",
    { style: { display: "flex", alignItems: "center", gap: taille * 0.3 } },
    plaque(
      SIGNE_CORPUSIMMO,
      taille,
      Math.round(taille * 0.44),
      Math.round(taille * 0.66),
      Math.round(taille * 0.22),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: corps,
          color: RESERVE,
          letterSpacing: -1,
        },
      },
      el("span", {}, "Corpus"),
      el("span", { style: { color: VIOLET } }, "Immo"),
    ),
  );
}

/**
 * Une bannière de profil.
 *
 * `qui` est la ligne personnelle — le rôle de la personne — et reste
 * facultative : la marque seule sert à la page entreprise.
 */
function banniere({ titre, sous, qui, studio }) {
  return el(
    "div",
    { style: fond(1584, 396) },
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          /* LA ZONE UTILE N'EST NI LA SURFACE NI SON CENTRE.
             À gauche, la photo de profil mord le coin sur environ 300 px :
             le texte part de 470. En bas, la carte du profil recouvre une
             bande sur mobile : on lui laisse 72 px.

             Le reste doit être CENTRÉ DANS CE QUI RESTE, et c'était le
             défaut de la première version : un simple `padding-bottom` de
             96 px poussait tout le bloc vers le haut, collant le logotype au
             bord supérieur pendant qu'un vide s'ouvrait en bas. On rend donc
             au haut la moitié de ce qu'on retire au bas. */
          padding: "36px 80px 72px 470px",
          width: "100%",
        },
      },
      logotype(56, 46),
      /* UNE LIGNE PAR LIGNE, et non un « \n » dans une chaîne.
         Satori shape le texte avant de le couper : sur un saut de ligne, il
         laissait une double espace au raccord. Deux blocs empilés n'ont pas
         ce problème et donnent en prime l'interligne exact. */
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 40,
            color: RESERVE,
            /* SANS CRÉNAGE NÉGATIF. Satori l'applique après chaque glyphe
               sauf l'espace, qui paraissait alors deux fois trop large — on
               lisait « L'estimation  sur » comme une double frappe. */
            lineHeight: 1.15,
          },
        },
        ...titre.split("\n").map((ligne) => el("div", { style: { display: "flex" } }, ligne)),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: BODY,
            fontSize: 23,
            color: VIOLET_PALE,
            lineHeight: 1.35,
          },
        },
        sous,
      ),
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 14 } },
        qui
          ? el(
              "div",
              {
                style: {
                  display: "flex",
                  fontFamily: BODY,
                  fontSize: 19,
                  color: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: 999,
                  padding: "8px 18px",
                },
              },
              qui,
            )
          : el("div", { style: { display: "flex" } }),
        /* LE STUDIO, EN SECOND ET SANS PASTILLE. Il ne dispute pas la vedette
           au produit : c'est une signature, pas un second titre. */
        studio
          ? el(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 10 } },
              plaque(SIGNE_SCALENVIA, 44, 36, 36, 12),
              el(
                "div",
                {
                  style: {
                    display: "flex",
                    fontFamily: BODY,
                    fontSize: 18,
                    color: "rgba(255,255,255,0.68)",
                  },
                },
                studio,
              ),
            )
          : el("div", { style: { display: "flex" } }),
      ),
    ),
  );
}

/** Une vignette de la section « Sélection » : un titre, une phrase, une URL. */
function vignette({ surtitre, titre, sous, url }) {
  return el(
    "div",
    { style: fond(1200, 627) },
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
        },
      },
      logotype(52, 42),
      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 20 } },
        el(
          "div",
          {
            style: {
              display: "flex",
              alignSelf: "flex-start",
              fontFamily: BODY,
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: VIOLET_PALE,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 999,
              padding: "8px 18px",
            },
          },
          surtitre,
        ),
        el(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: 62,
              color: RESERVE,
              letterSpacing: -2,
              lineHeight: 1.08,
            },
          },
          titre,
        ),
        el(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: BODY,
              fontSize: 26,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.35,
              maxWidth: 900,
            },
          },
          sous,
        ),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: BODY,
            fontSize: 22,
            color: VIOLET,
          },
        },
        url,
      ),
    ),
  );
}

/**
 * LE LOGO CARRÉ DE LA PAGE ENTREPRISE, 400 × 400.
 *
 * LinkedIn le recadre en cercle à l'affichage : le signe tient donc dans le
 * cercle inscrit, et le fond va jusqu'aux bords. Un logo dessiné jusqu'aux
 * coins perdrait ses angles sans prévenir.
 */
function logoCarre() {
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 400,
        height: 400,
        backgroundColor: RESERVE,
      },
    },
    el("img", { src: SIGNE_CORPUSIMMO, width: 148, height: 220 }),
  );
}

/* ── Programme ───────────────────────────────────────────────────────────── */

const IMAGES = [
  {
    fichier: "banniere-corpusimmo.png",
    taille: [1584, 396],
    arbre: () =>
      banniere({
        titre: "Estimer, comparer, décider.",
        sous: "Sur les ventes réellement enregistrées, publiées par la DGFiP.",
        qui: "corpus.immo",
      }),
  },
  {
    fichier: "banniere-mathieu.png",
    taille: [1584, 396],
    arbre: () =>
      banniere({
        /* Sans virgule : Manrope 800 avec un crénage négatif ouvre une
           espace large après elle, qui se lit comme une double frappe. */
        /* Apostrophe TYPOGRAPHIQUE, et pas seulement par correction : Satori
           segmente le texte sur l'apostrophe droite et recolle les morceaux
           avec une espace en trop, d'où « L'estimation  sur » sur la
           bannière. La courbe est de toute façon la bonne en français. */
        titre: "L\u2019estimation sur des actes.\nPas sur des annonces.",
        sous: "Estimateur, carte des ventes, observatoire et outils de calcul.",
        qui: "Mathieu Guicheteau · cofondateur, produit et données",
        studio: "Studio Scalenvia",
      }),
  },
  {
    fichier: "logo-page-entreprise.png",
    taille: [400, 400],
    arbre: () => logoCarre(),
  },
  {
    fichier: "banniere-gael.png",
    taille: [1584, 396],
    arbre: () =>
      banniere({
        /* Sans virgule : Manrope 800 avec un crénage négatif ouvre une
           espace large après elle, qui se lit comme une double frappe. */
        /* Apostrophe TYPOGRAPHIQUE, et pas seulement par correction : Satori
           segmente le texte sur l'apostrophe droite et recolle les morceaux
           avec une espace en trop, d'où « L'estimation  sur » sur la
           bannière. La courbe est de toute façon la bonne en français. */
        titre: "L\u2019estimation sur des actes.\nPas sur des annonces.",
        sous: "Estimateur, carte des ventes, observatoire et outils de calcul.",
        qui: "Gaël Colin · associé",
      }),
  },
  {
    fichier: "selection-estimer.png",
    taille: [1200, 627],
    arbre: () =>
      vignette({
        surtitre: "Estimateur",
        titre: "Estimer un bien\nsur les ventes voisines",
        sous: "Les comparables autour de l'adresse exacte, avec leur effectif et leur dispersion. Gratuit, sans compte.",
        url: "corpus.immo",
      }),
  },
  {
    fichier: "selection-observatoire.png",
    taille: [1200, 627],
    arbre: () =>
      vignette({
        surtitre: "Observatoire",
        titre: "Un million de ventes,\nà l'échelle de la rue",
        sous: "Les mutations enregistrées depuis 2021, la carte des loyers calée sur les baux signés, le zonage et les transports.",
        url: "corpus.immo/observatoire",
      }),
  },
  {
    fichier: "selection-outils.png",
    taille: [1200, 627],
    arbre: () =>
      vignette({
        surtitre: "Outils",
        titre: "Net vendeur, rendement,\navis de valeur",
        sous: "Les calculs qu'un professionnel refait à chaque dossier, faits une fois et vérifiables.",
        url: "corpus.immo/outils",
      }),
  },
  {
    fichier: "selection-pros.png",
    taille: [1200, 627],
    arbre: () =>
      vignette({
        surtitre: "Pour les professionnels",
        titre: "Une estimation\nque le client peut vérifier",
        sous: "Chaque chiffre vient d'un acte notarié publié. Rien n'est extrapolé d'une annonce, et l'effectif accompagne toujours la médiane.",
        url: "corpus.immo",
      }),
  },
];

async function main() {
  const fontes = [
    {
      name: DISPLAY,
      data: await readFile(path.join(FONTES, "manrope-800.ttf")),
      weight: 800,
      style: "normal",
    },
    {
      name: DISPLAY,
      data: await readFile(path.join(FONTES, "manrope-400.ttf")),
      weight: 400,
      style: "normal",
    },
    {
      name: BODY,
      data: await readFile(path.join(FONTES, "inter-400.ttf")),
      weight: 400,
      style: "normal",
    },
  ];

  SIGNE_CORPUSIMMO = await dataPng("corpusimmo-mark.png");
  SIGNE_SCALENVIA = await dataPng("scalenvia-mark.png");

  await mkdir(SORTIE, { recursive: true });

  for (const image of IMAGES) {
    const [width, height] = image.taille;
    const reponse = new ImageResponse(image.arbre(), {
      width,
      height,
      fonts: fontes,
    });
    const octets = Buffer.from(await reponse.arrayBuffer());
    await writeFile(path.join(SORTIE, image.fichier), octets);
    process.stderr.write(
      `  ${image.fichier} — ${width}×${height}, ${(octets.length / 1024).toFixed(0)} Ko\n`,
    );
  }

  process.stderr.write(`\nÉcrit ${IMAGES.length} images dans ${SORTIE}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
