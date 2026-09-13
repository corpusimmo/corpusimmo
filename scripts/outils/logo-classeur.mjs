/**
 * LE LOGO APPOSÉ SUR LES CLASSEURS : le signe, le nom et l'adresse du site.
 *
 * Il est tiré par le même moteur que les vignettes du site, avec les mêmes
 * fontes et le même signe, pour qu'un classeur ouvert dans Excel porte la
 * marque que le visiteur vient de quitter. Fond transparent : il se pose sur
 * la zone de titre blanche des onglets.
 *
 *   node scripts/outils/logo-classeur.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og.js";

const RACINE = process.cwd();
const FONTES = path.join(RACINE, "src/lib/seo/fonts");

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length <= 1 ? children[0] : children },
});

const signe = `data:image/png;base64,${(await readFile(path.join(RACINE, "scripts/assets/corpusimmo-mark.png"))).toString("base64")}`;

// Deux fois la taille d'affichage : Excel met l'image à l'échelle, et un logo
// net sur un écran Retina vaut les quelques kilo-octets de plus.
const LARGEUR = 760;
const HAUTEUR = 180;

const arbre = el(
  "div",
  { style: { display: "flex", alignItems: "center", width: LARGEUR, height: HAUTEUR, gap: 26, paddingLeft: 10 } },
  el("img", { src: signe, width: 104, height: 155 }),
  el(
    "div",
    { style: { display: "flex", flexDirection: "column", justifyContent: "center" } },
    el(
      "div",
      { style: { display: "flex", fontFamily: "Manrope", fontWeight: 800, fontSize: 78, color: "#1b1a2e", lineHeight: 1 } },
      el("span", {}, "Corpus"),
      el("span", { style: { color: "#6c5ab0" } }, "Immo"),
    ),
    el(
      "div",
      { style: { display: "flex", fontFamily: "Inter", fontSize: 34, color: "#6c5ab0", marginTop: 12 } },
      "www.corpus.immo",
    ),
  ),
);

const reponse = new ImageResponse(arbre, {
  width: LARGEUR,
  height: HAUTEUR,
  fonts: [
    { name: "Manrope", data: await readFile(path.join(FONTES, "manrope-800.ttf")), weight: 800, style: "normal" },
    { name: "Inter", data: await readFile(path.join(FONTES, "inter-400.ttf")), weight: 400, style: "normal" },
  ],
});
const sortie = path.join(RACINE, "scripts/assets/logo-classeur.png");
await writeFile(sortie, Buffer.from(await reponse.arrayBuffer()));
process.stderr.write(`Écrit ${sortie}\n`);
