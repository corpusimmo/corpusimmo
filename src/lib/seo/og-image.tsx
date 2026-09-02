/**
 * L'IMAGE SOCIALE, composée au build par `next/og`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS CALQUES
 *
 *   1. LA PHOTOGRAPHIE — `og-fond.jpg`, une vue aérienne d'îlots haussmanniens
 *                        recadrée en 1200 × 630 et lue sur le disque au build.
 *                        Elle est encodée en base64 dans l'image : aucune
 *                        requête réseau ne peut faire échouer un build, et
 *                        aucune URL absolue n'est à tenir à jour. C'est une
 *                        ILLUSTRATION, jamais un bien du corpus (docs/images.md).
 *   2. LE VOILE        — un dégradé bleu nuit, presque opaque à gauche sous la
 *                        colonne de texte, ouvert à droite pour laisser voir
 *                        les toits. C'est lui qui garantit le contraste.
 *   3. LE TEXTE        — le logotype en réserve, le surtitre en pastille, le
 *                        titre, la phrase, le domaine. Aucun chiffre : une
 *                        image sociale est mise en cache un an par les réseaux
 *                        qui la relaient, et un prix médian y serait faux bien
 *                        avant d'être remplacé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES COULEURS SONT LITTÉRALES, ET C'EST UNE EXCEPTION ASSUMÉE
 *   Exactement comme dans `src/app/icon.svg`. Ce rendu ne se fait pas dans un
 *   navigateur : Satori compose l'image hors de toute feuille de style, et
 *   `var(--primary)` n'y vaut rien. Ces valeurs DOIVENT donc être tenues à jour
 *   à la main si la palette de `globals.css` bouge.
 *     #0F1E2B nuit profonde (--surface-inverted)
 *     #C2A468 or aplat (--accent-rule)    · #F6EFDF or pâle (--accent-soft)
 *     #FFFFFF réserve (--ink-inverted)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA TYPOGRAPHIE EST CELLE DU SITE, ET ELLE EST VERSÉE AU DÉPÔT
 *   `next/og` n'embarque que Noto Sans : sans rien faire, la vignette de
 *   partage s'écrivait dans une police que le site n'utilise nulle part.
 *   Manrope titre et Inter rédige, exactement comme dans le navigateur.
 *
 *   Les fichiers vivent dans `fonts/`, en TrueType, lus sur le disque au
 *   chargement du module. PAS de `fetch` vers Google Fonts : un appel réseau
 *   pendant un build est une panne qui attend son heure, et une image sociale
 *   ne vaut pas un déploiement échoué. Satori ne lit d'ailleurs pas le WOFF2,
 *   donc les fichiers que `next/font` met en cache ne serviraient à rien.
 *   340 Ko en tout, lus une fois, jamais expédiés au navigateur.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { PRODUCTION_URL } from "@/config/app-url";
import { siteConfig } from "@/config/site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/* ------------------------------------------------------------------ palette */

const NIGHT = "#0f1e2b";
const GOLD_RULE = "#c2a468";
const GOLD_SOFT = "#f6efdf";
const RESERVE = "#ffffff";

/**
 * LA PHOTOGRAPHIE DE FOND, lue sur le disque au build et encodée en base64.
 *
 * Satori ne suit pas de chemin relatif : il lui faut une URL. Une URL absolue
 * vers le site rendrait le build dépendant du déploiement précédent, et une
 * requête réseau pendant un build est une panne qui attend son heure. Le
 * fichier pèse 142 Ko ; il est lu UNE fois, au chargement du module.
 */
const PHOTO = `data:image/jpeg;base64,${readFileSync(
  join(process.cwd(), "src/lib/seo/og-fond.jpg"),
).toString("base64")}`;

/* -------------------------------------------------------------- typographie */

function font(file: string) {
  return readFileSync(join(process.cwd(), "src/lib/seo/fonts", file));
}

/**
 * Les trois fontes, dans l'ordre où Satori les essaie.
 *
 * Le nom de famille compte : `fontFamily: "Manrope"` dans un style ne trouve
 * la police que si elle est déclarée sous ce nom-là. Une faute de frappe ne
 * casse rien visiblement, elle retombe sur la première famille — d'où les deux
 * constantes, partagées avec les styles plus bas.
 */
const DISPLAY = "Manrope";
const BODY = "Inter";

const FONTS = [
  {
    name: DISPLAY,
    data: font("manrope-800.ttf"),
    weight: 800 as const,
    style: "normal" as const,
  },
  {
    name: DISPLAY,
    data: font("manrope-400.ttf"),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: BODY,
    data: font("inter-400.ttf"),
    weight: 400 as const,
    style: "normal" as const,
  },
];

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
const ROOF = "M11 18.5 16 13.5l5 5";
const WALLS = "M12.6 18.5v4M19.4 18.5v4";
const SIGNATURE = "M10.5 25h11";

function dataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Le logotype en RÉSERVE : le tirage au trait, celui du pied de page.
 *
 * Sur une photographie voilée de bleu nuit, la page pleine en bleu nuit
 * disparaîtrait purement et simplement. Le trait la rend, l'or ne bouge pas.
 * Le coin corné saute : à cette épaisseur de trait il encombre la forme.
 */
function brandMark(size: number): string {
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">` +
      `<path d="${PAGE}" fill="none" stroke="${RESERVE}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="${RESERVE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="${ROOF}"/><path d="${WALLS}"/></g>` +
      `<path d="${SIGNATURE}" stroke="${GOLD_RULE}" stroke-width="2" stroke-linecap="round"/>` +
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

/**
 * Le domaine imprimé sur l'image, TOUJOURS celui de production.
 *
 * Et non `siteConfig.url`, qui vaut l'origine du rendu : en développement il
 * imprimait « localhost:3000 », et sur une préversion l'adresse jetable du
 * déploiement. Une vignette de partage circule hors de son contexte, souvent
 * en capture d'écran ; le seul domaine qu'elle puisse porter est celui où le
 * site vit vraiment.
 */
function displayHost(): string {
  return PRODUCTION_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
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

export function renderOgImage({
  eyebrow,
  title,
  subtitle,
}: OgImageInput): ImageResponse {
  const { width, height } = OG_SIZE;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: NIGHT,
        fontFamily: BODY,
      }}
    >
      {/* ═════════════════════════════════════ CALQUE 1, LA PHOTOGRAPHIE */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori compose
            hors navigateur : `next/image` n'a aucun sens ici. */}
      <img
        src={PHOTO}
        width={width}
        height={height}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          objectFit: "cover",
        }}
      />

      {/* ══════════════════════════════════════════════ CALQUE 2, LE VOILE
            Presque opaque sous la colonne de texte, ouvert à droite : les
            toits restent lisibles là où rien n'est écrit. Le second dégradé,
            vertical, rattrape le bas de l'image, où le titre s'approche des
            façades les plus claires. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          backgroundImage:
            "linear-gradient(100deg, rgba(15,30,43,0.96) 0%, rgba(15,30,43,0.92) 44%, rgba(15,30,43,0.68) 74%, rgba(15,30,43,0.42) 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          backgroundImage:
            "linear-gradient(180deg, rgba(15,30,43,0.35) 0%, rgba(15,30,43,0) 38%, rgba(15,30,43,0.55) 100%)",
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
          padding: "70px 76px 66px 76px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- idem. */}
            <img src={brandMark(76)} width={76} height={76} alt="" />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: 20,
              }}
            >
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: 36,
                  color: RESERVE,
                  letterSpacing: -1,
                  lineHeight: 1.1,
                }}
              >
                {siteConfig.name}
              </span>
              <span
                style={{
                  fontSize: 21,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 2,
                }}
              >
                {/* Pas la signature ici : elle est le titre juste en dessous,
                    et une marque qui se répète à deux lignes d'écart perd les
                    deux fois. */}
                Données publiques DVF
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              width: "100%",
              height: 1,
              backgroundColor: "rgba(255,255,255,0.16)",
              marginTop: 28,
            }}
          />
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}
        >
          {/* Le surtitre en pastille : le même composant que sur le site,
                transposé. Sur fond sombre il passe en réserve translucide, et
                son texte prend l'or pâle plutôt que l'or plein, qui ne tient
                pas 4,5:1 sur du bleu nuit. */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              alignItems: "center",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.12)",
              padding: "10px 22px",
            }}
          >
            {/* `nowrap` : la pastille est une forme fermée, un surtitre qui
                passe à la ligne la fait déborder par le bas au lieu de la faire
                grandir. Le corps et l'interlettrage sont calés pour que la plus
                longue énumération du site tienne sur une ligne. */}
            <span
              style={{
                fontSize: 18,
                color: GOLD_SOFT,
                letterSpacing: 3,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {eyebrow}
            </span>
          </div>

          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: titleSize(title),
              color: RESERVE,
              lineHeight: 1.06,
              // `pre-line` : un titre peut poser ses propres coupures. La
              // signature en pose une, entre le parcours et la preuve.
              whiteSpace: "pre-line",
              // Manrope est déjà serrée : au-delà, les jambages se touchent
              // au corps du titre.
              letterSpacing: -2,
              marginTop: 24,
            }}
          >
            {title}
          </span>

          {subtitle ? (
            <span
              style={{
                fontSize: 27,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.42,
                marginTop: 20,
              }}
            >
              {subtitle}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontSize: 23,
              color: RESERVE,
              letterSpacing: 0.2,
              whiteSpace: "nowrap",
            }}
          >
            {displayHost()}
          </span>
          <div
            style={{
              display: "flex",
              width: 1,
              height: 26,
              backgroundColor: "rgba(255,255,255,0.28)",
              marginLeft: 22,
              marginRight: 22,
            }}
          />
          {/* `nowrap` : l'énumération est une seule respiration, la couper en
              deux lignes la ferait lire comme deux listes. */}
          <span
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.7)",
              whiteSpace: "nowrap",
            }}
          >
            Estimateur, carte, observatoire, outils et ressources
          </span>
        </div>
      </div>

      {/* Le filet or en pied : la signature de l'acte, et la seule pièce du
            chrome qui touche les deux bords. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: height - 5,
          width,
          height: 5,
          backgroundColor: GOLD_RULE,
        }}
      />
    </div>,
    { ...OG_SIZE, fonts: FONTS },
  );
}
