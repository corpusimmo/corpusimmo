/**
 * LES ICÔNES, TIRÉES DU SIGNE EN PILE.
 *
 * Ce script tourne À LA MAIN et écrit dans `public/icons`. Les icônes ne
 * changent qu'avec la marque, c'est à dire presque jamais : les regénérer à
 * chaque build ferait dépendre le déploiement d'un navigateur sans profit.
 *
 * LE FOND EST PLEIN, ET C'EST LA RÈGLE. Une icône d'onglet est posée sur un
 * fond que nous ne choisissons pas, clair chez les uns et sombre chez les
 * autres. Le carré marine lui donne le sien, et le signe, dont les liserés
 * sont blancs, s'y détache dans les deux cas.
 *
 * DEUX MARGES, PAS UNE. Les icônes ordinaires laissent une marge courte, pour
 * que le signe reste grand à seize pixels. Les icônes « maskable » en laissent
 * une large : Android les recadre en cercle ou en écusson, et tout ce qui
 * dépasse du cercle intérieur peut être rogné.
 *
 *   PLAYWRIGHT_CORE=… node scripts/icones.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* Playwright n'est PAS une dépendance du projet : il ne sert qu'ici, et une
   fois par changement de marque. On le charge donc à l'exécution, depuis
   l'installation qu'on veut bien lui indiquer.

     PLAYWRIGHT_CORE=/chemin/vers/playwright-core node scripts/icones.mjs */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");

const RACINE = process.cwd();
const MARINE = "#0c1b2e";
/* Le signe en bleu et argent : c'est celui qui tient sur le marine sans
   dépendre du thème choisi par le visiteur, puisqu'une icône ne change pas. */
const SIGNE = join(RACINE, "public/marque-stack-argent.webp");

const FORMATS = [
  { fichier: "icone-32.png", taille: 32, part: 0.9, rond: 0.18 },
  { fichier: "icone-192.png", taille: 192, part: 0.82, rond: 0.18 },
  { fichier: "icone-384.png", taille: 384, part: 0.82, rond: 0.18 },
  { fichier: "icone-512.png", taille: 512, part: 0.82, rond: 0.18 },
  { fichier: "apple-touch-icon.png", taille: 180, part: 0.76, rond: 0 },
  { fichier: "icone-maskable-192.png", taille: 192, part: 0.58, rond: 0 },
  { fichier: "icone-maskable-512.png", taille: 512, part: 0.58, rond: 0 },
];

const source = readFileSync(SIGNE).toString("base64");
const navigateur = await chromium.launch();
const page = await navigateur.newPage();

for (const format of FORMATS) {
  const donnees = await page.evaluate(
    async ({ source, taille, part, rond, marine }) => {
      const image = new Image();
      image.src = "data:image/webp;base64," + source;
      await image.decode();

      const toile = document.createElement("canvas");
      toile.width = taille;
      toile.height = taille;
      const c = toile.getContext("2d");

      if (rond > 0) {
        const r = taille * rond;
        c.beginPath();
        c.roundRect(0, 0, taille, taille, r);
        c.clip();
      }
      c.fillStyle = marine;
      c.fillRect(0, 0, taille, taille);

      const large = taille * part;
      const echelle = Math.min(large / image.width, large / image.height);
      const l = image.width * echelle;
      const h = image.height * echelle;
      c.drawImage(image, (taille - l) / 2, (taille - h) / 2, l, h);
      return toile.toDataURL("image/png");
    },
    { source, taille: format.taille, part: format.part, rond: format.rond, marine: MARINE },
  );
  writeFileSync(
    join(RACINE, "public/icons", format.fichier),
    Buffer.from(donnees.split(",")[1], "base64"),
  );
  console.log(`✓ ${format.fichier} (${format.taille}px)`);
}

await navigateur.close();
