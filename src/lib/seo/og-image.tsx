/**
 * L'IMAGE SOCIALE, composée au build par `next/og`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS CALQUES, ET C'EST VOLONTAIRE
 *
 *   1. LE FOND      — aujourd'hui : le papier chaud de la marque, une trame de
 *                     plan cadastral et le logotype en filigrane. Demain : une
 *                     PHOTOGRAPHIE. Le jour où les visuels existeront, ce calque
 *                     se remplace par un `<img>` en `objectFit: "cover"` et RIEN
 *                     d'autre ne bouge. C'est la raison d'être du découpage.
 *   2. LE VOILE     — le calque qui garantit la lisibilité du texte quoi qu'il y
 *                     ait dessous. Il est presque invisible sur le papier actuel ;
 *                     il deviendra un dégradé bleu nuit dès qu'une photographie
 *                     passera derrière. Le laisser en place maintenant évite
 *                     d'avoir à redessiner la composition à ce moment-là.
 *   3. LE TEXTE     — le logotype, le surtitre, le titre, la phrase, le domaine.
 *                     Aucun chiffre : une image sociale est mise en cache un an
 *                     par les réseaux qui la relaient, et un prix médian affiché
 *                     dessus serait faux bien avant d'être remplacé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE REGISTRE : UN ACTE, PAS UNE ILLUSTRATION
 *   La trame est un relevé, le filigrane est un titre de propriété, le filet
 *   bleu nuit en pied est la tranche du document. Rien n'est décoratif : c'est
 *   la même thèse que le logotype, à l'échelle d'une vignette de partage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES COULEURS SONT LITTÉRALES, ET C'EST UNE EXCEPTION ASSUMÉE
 *   Exactement comme dans `src/app/icon.svg`. Ce rendu ne se fait pas dans un
 *   navigateur : Satori compose l'image hors de toute feuille de style, et
 *   `var(--primary)` n'y vaut rien. Ces valeurs DOIVENT donc être tenues à jour
 *   à la main si la palette de `globals.css` bouge.
 *     #1B3349 bleu nuit (--primary)       · #F6F5F2 papier (--canvas)
 *     #D5CFC1 papier ombré (--paper-300)  · #C2A468 bronze aplat (--accent-rule)
 *     #8A6A2F bronze texte (--accent)     · #12233D encre (--ink)
 *     #4A5A70 encre douce (--ink-muted)   · #FFFFFF réserve (--primary-fg)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA TYPOGRAPHIE, ET SA CONTRAINTE
 *   Aucune police n'est chargée : `next/og` embarque Noto Sans en graisse
 *   normale, et elle seule. Aller chercher Inter ou Source Serif supposerait un
 *   appel réseau pendant le build, donc un build qui peut échouer pour une
 *   image. La hiérarchie ne repose donc sur aucun gras : elle tient par les
 *   corps, l'interlettrage, la couleur et les filets. C'est aussi ce qui donne
 *   à la composition son air de document plutôt que d'affiche.
 */

import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/* ------------------------------------------------------------------ palette */

const NAVY = "#1b3349";
const PAPER = "#f6f5f2";
const PAPER_SHADE = "#d5cfc1";
const BRONZE_RULE = "#c2a468";
const BRONZE_TEXT = "#8a6a2f";
const INK = "#12233d";
const INK_MUTED = "#4a5a70";
const RESERVE = "#ffffff";

/* --------------------------------------------------------------- le logotype */

/**
 * La géométrie EXACTE du logotype, reprise de
 * `src/components/layout/brand-mark.tsx` : la page, le coin corné, le toit avec
 * ses murs, et la ligne de signature en bronze.
 *
 * Elle est recopiée ici parce que Satori ne sait pas rendre un composant React
 * de l'application dans une image : il lui faut du SVG autonome. Les deux
 * fichiers doivent donc bouger ensemble, et c'est le seul point de duplication
 * de la marque.
 */
const PAGE =
  "M7.5 3h11L26 10.5v16.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 27.5v-23A1.5 1.5 0 0 1 7.5 3z";
const CORNER = "M18.5 3 26 10.5h-7.5z";
const ROOF = "M11 18.5 16 13.5l5 5";
const WALLS = "M12.6 18.5v4M19.4 18.5v4";
const SIGNATURE = "M10.5 25h11";

function dataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Le logotype plein, tel qu'il apparaît en tête de site. */
function brandMark(size: number): string {
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">` +
      `<path d="${PAGE}" fill="${NAVY}"/>` +
      `<path d="${CORNER}" fill="${RESERVE}" opacity="0.18"/>` +
      `<g fill="none" stroke="${RESERVE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="${ROOF}"/><path d="${WALLS}"/></g>` +
      `<path d="${SIGNATURE}" stroke="${BRONZE_RULE}" stroke-width="2" stroke-linecap="round"/>` +
      `</svg>`,
  );
}

/**
 * Le même signe, agrandi et détouré, en FILIGRANE.
 *
 * Un filigrane est ce qui distingue une pièce authentique d'une copie : c'est
 * le seul ornement que ce registre autorise. Il est tracé au trait plutôt que
 * plein, pour rester lisible comme un signe et non comme une tache.
 */
function brandWatermark(size: number): string {
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">` +
      `<g fill="none" stroke="${NAVY}" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round">` +
      `<path d="${PAGE}"/><path d="${CORNER}"/><path d="${ROOF}"/><path d="${WALLS}"/>` +
      `</g>` +
      `<path d="${SIGNATURE}" fill="none" stroke="${BRONZE_RULE}" stroke-width="0.9" stroke-linecap="round"/>` +
      `</svg>`,
  );
}

/**
 * La trame de fond : un relevé, un plan, du papier millimétré de géomètre.
 *
 * Les alphas sont écrits dans le SVG plutôt qu'en `opacity` sur l'élément, pour
 * que le filet bronze et le filet bleu gardent des intensités différentes.
 */
function surveyGrid(width: number, height: number): string {
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<defs>` +
      `<pattern id="fine" width="42" height="42" patternUnits="userSpaceOnUse">` +
      `<path d="M42 0H0V42" fill="none" stroke="rgba(27,51,73,0.055)" stroke-width="1"/>` +
      `</pattern>` +
      `<pattern id="coarse" width="210" height="210" patternUnits="userSpaceOnUse">` +
      `<path d="M210 0H0V210" fill="none" stroke="rgba(138,106,47,0.13)" stroke-width="1"/>` +
      `</pattern>` +
      `</defs>` +
      `<rect width="${width}" height="${height}" fill="url(#fine)"/>` +
      `<rect width="${width}" height="${height}" fill="url(#coarse)"/>` +
      `</svg>`,
  );
}

/* ------------------------------------------------------------------ l'entrée */

export interface OgImageInput {
  /**
   * Le surtitre, en capitales bronze. Le nom de la rubrique, jamais une
   * promesse : c'est lui qui situe la page dans le site.
   */
  eyebrow: string;
  /** Deux lignes au plus. Au-delà, le corps chute et la vignette devient illisible. */
  title: string;
  /** Une phrase. Ce que la page fait, sans superlatif ni chiffre. */
  subtitle?: string;
}

/** Le domaine tel qu'on l'affiche : sans protocole, sans barre finale. */
function displayHost(): string {
  return siteConfig.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * Le corps du titre s'adapte à sa longueur.
 *
 * Satori ne sait pas rétrécir un texte qui déborde : il le laisse sortir du
 * cadre. Trois paliers suffisent à couvrir tout ce que le site produit comme
 * titres, et évitent d'avoir à surveiller chaque page.
 */
function titleSize(title: string): number {
  if (title.length > 62) return 46;
  if (title.length > 40) return 54;
  return 62;
}

export function renderOgImage({ eyebrow, title, subtitle }: OgImageInput): ImageResponse {
  const { width, height } = OG_SIZE;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: PAPER,
        }}
      >
        {/* ═══════════════════════════════════════════════ CALQUE 1, LE FOND
            À REMPLACER PAR UNE PHOTOGRAPHIE le jour où il y en aura : un seul
            `<img src={photo} style={{ position: "absolute", inset: 0, width,
            height, objectFit: "cover" }} />` à la place de ce bloc, et la trame
            comme le filigrane disparaissent avec lui. */}
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width, height }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori compose
              hors navigateur : `next/image` n'a aucun sens ici. */}
          <img src={surveyGrid(width, height)} width={width} height={height} alt="" />
        </div>

        <div style={{ display: "flex", position: "absolute", top: 88, left: 726 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- idem. */}
          <img src={brandWatermark(614)} width={614} height={614} alt="" style={{ opacity: 0.1 }} />
        </div>

        {/* ══════════════════════════════════════════════ CALQUE 2, LE VOILE
            Presque invisible sur le papier actuel, indispensable sous une
            photographie. Il pousse le filigrane vers la droite et dégage la
            colonne de texte. Avec un visuel derrière, ce dégradé passera au
            bleu nuit (`rgba(27,51,73,0.88)` vers `rgba(27,51,73,0.35)`) sans
            qu'un seul réglage du calque de texte ne bouge. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundImage:
              "linear-gradient(100deg, rgba(246,245,242,0.97) 0%, rgba(246,245,242,0.93) 46%, rgba(246,245,242,0.55) 78%, rgba(246,245,242,0.35) 100%)",
          }}
        />

        {/* ══════════════════════════════════════════════ CALQUE 3, LE TEXTE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            width: "100%",
            height: "100%",
            padding: "72px 76px 64px 76px",
          }}
        >
          {/* Le logotype, et le filet qui ferme l'en-tête comme celui d'un acte. */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- idem. */}
            <img src={brandMark(84)} width={84} height={84} alt="" />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 22 }}>
              <span style={{ fontSize: 38, color: INK, letterSpacing: -0.8, lineHeight: 1.1 }}>
                {siteConfig.name}
              </span>
              <span style={{ fontSize: 22, color: INK_MUTED, marginTop: 2 }}>
                {siteConfig.signature}
              </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 1,
                backgroundColor: PAPER_SHADE,
                marginTop: 30,
              }}
            />
          </div>

          {/* Le propos de la page. */}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 830 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", width: 46, height: 3, backgroundColor: BRONZE_RULE }} />
              <span
                style={{
                  fontSize: 21,
                  color: BRONZE_TEXT,
                  letterSpacing: 4.5,
                  marginLeft: 16,
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </span>
            </div>

            <span
              style={{
                fontSize: titleSize(title),
                color: INK,
                lineHeight: 1.14,
                letterSpacing: -1,
                marginTop: 20,
              }}
            >
              {title}
            </span>

            {subtitle ? (
              <span style={{ fontSize: 27, color: INK_MUTED, lineHeight: 1.42, marginTop: 22 }}>
                {subtitle}
              </span>
            ) : null}
          </div>

          {/* Le pied : la provenance, et le domaine. */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 23, color: INK, letterSpacing: 0.2 }}>{displayHost()}</span>
            <div
              style={{
                display: "flex",
                width: 1,
                height: 26,
                backgroundColor: PAPER_SHADE,
                marginLeft: 22,
                marginRight: 22,
              }}
            />
            <span style={{ fontSize: 23, color: INK_MUTED }}>Données publiques DVF</span>
          </div>
        </div>

        {/* La tranche du document : le filet bleu nuit en pied, et le liseré
            bronze de la signature juste au-dessus. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: height - 18,
            width,
            height: 18,
            backgroundColor: NAVY,
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: height - 21,
            width,
            height: 3,
            backgroundColor: BRONZE_RULE,
          }}
        />
      </div>
    ),
    { ...OG_SIZE },
  );
}
