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

/* ── Le logotype, repris de `src/lib/seo/og-image.tsx` ───────────────────── */

const PAGE =
  "M7.5 3h11L26 10.5v16.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 27.5v-23A1.5 1.5 0 0 1 7.5 3z";
const TOIT = "M11 18.5 16 13.5l5 5";
const MURS = "M12.6 18.5v4M19.4 18.5v4";
const SIGNATURE = "M10.5 25h11";

function marque(taille) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${taille}" height="${taille}">` +
    `<path d="${PAGE}" fill="none" stroke="${RESERVE}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<g fill="none" stroke="${RESERVE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${TOIT}"/><path d="${MURS}"/></g>` +
    `<path d="${SIGNATURE}" stroke="${VIOLET}" stroke-width="2" stroke-linecap="round"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ── Gabarits ────────────────────────────────────────────────────────────── */

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length <= 1 ? children[0] : children },
});

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
    el("img", { src: marque(taille), width: taille, height: taille }),
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
function banniere({ titre, sous, qui }) {
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
          /* La photo de profil mord le coin bas-gauche sur 300 px environ, et
             la carte du profil recouvre le bas sur mobile : le texte part de
             470 px et s'arrête à 300 px du bas. */
          padding: "0 80px 96px 470px",
          width: "100%",
        },
      },
      logotype(56, 46),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 40,
            color: RESERVE,
            letterSpacing: -1,
            lineHeight: 1.15,
            /* Satori ne coupe pas sur un « \n » sans cela : la ligne se
               recollait avec une double espace au milieu. */
            whiteSpace: "pre-line",
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
            fontSize: 23,
            color: VIOLET_PALE,
            lineHeight: 1.35,
          },
        },
        sous,
      ),
      qui
        ? el(
            "div",
            {
              style: {
                display: "flex",
                alignSelf: "flex-start",
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
        titre: "L'estimation, sur des actes.\nPas sur des annonces.",
        sous: "Estimateur, carte des ventes, observatoire et outils de calcul.",
        qui: "Mathieu Guicheteau · cofondateur, produit et données",
      }),
  },
  {
    fichier: "banniere-gael.png",
    taille: [1584, 396],
    arbre: () =>
      banniere({
        titre: "L'estimation, sur des actes.\nPas sur des annonces.",
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
