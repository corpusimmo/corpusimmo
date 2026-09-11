/**
 * RETIRE LE POINT ISOLÉ DU SIGNE DE MARQUE.
 *
 * Le fichier livré portait, en bas à droite, une pastille détachée du corps
 * du signe : un reste du rendu d'origine, que personne n'avait remarqué tant
 * que la marque ne vivait qu'à vingt pixels dans l'en-tête. Agrandie sur une
 * icône de 512 pixels ou sur un logo de page LinkedIn, elle se lit comme une
 * poussière sur l'objectif.
 *
 * CE SCRIPT NE REDESSINE RIEN. Il repère les composantes connexes de pixels
 * opaques et efface celles qui pèsent moins d'un centième de la plus grande :
 * un signe est d'un seul tenant, ce qui flotte à côté n'en fait pas partie.
 * Le seuil est volontairement bas — il attrape une pastille de neuf pixels de
 * côté sans jamais menacer une forme portante.
 *
 * Il écrit PAR-DESSUS le fichier de marque : la version d'avant reste dans
 * l'historique, et laisser deux fichiers côte à côte garantirait qu'un jour
 * quelqu'un serve le mauvais.
 *
 *   PLAYWRIGHT_CORE=… node scripts/nettoyer-marque.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { chromium } = await import(
  process.env.PLAYWRIGHT_CORE ?? "playwright-core"
);

const RACINE = process.cwd();
const MARQUE = join(RACINE, "public/marque-violet.webp");
/** Le PNG que l'image sociale et le kit LinkedIn embarquent. */
const DERIVE = join(RACINE, "src/lib/seo/marque-violet.png");
/**
 * Sous ce poids relatif à la plus grande composante, c'est une poussière.
 *
 * Cinq pour cent, et non un : la pastille à retirer pesait 1,1 % du signe,
 * soit juste au-dessus d'un seuil trop serré. Le signe n'a que trois
 * composantes et la deuxième est cette pastille — la marge est donc large
 * des deux côtés.
 */
const SEUIL = 0.05;

const source = readFileSync(MARQUE).toString("base64");
const navigateur = await chromium.launch();
const page = await navigateur.newPage();

const resultat = await page.evaluate(
  async ({ source, seuil }) => {
    const image = new Image();
    image.src = "data:image/webp;base64," + source;
    await image.decode();

    const toile = document.createElement("canvas");
    toile.width = image.naturalWidth;
    toile.height = image.naturalHeight;
    const ctx = toile.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const donnees = ctx.getImageData(0, 0, toile.width, toile.height);
    const px = donnees.data;
    const vu = new Int32Array(toile.width * toile.height).fill(-1);
    const composantes = [];

    const rang = (x, y) => y * toile.width + x;

    for (let y = 0; y < toile.height; y += 1) {
      for (let x = 0; x < toile.width; x += 1) {
        const i = rang(x, y);
        if (vu[i] >= 0 || px[i * 4 + 3] < 20) continue;
        const numero = composantes.length;
        const pile = [[x, y]];
        vu[i] = numero;
        let taille = 0;
        while (pile.length > 0) {
          const [cx, cy] = pile.pop();
          taille += 1;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= toile.width || ny >= toile.height) {
              continue;
            }
            const j = rang(nx, ny);
            if (vu[j] >= 0 || px[j * 4 + 3] < 20) continue;
            vu[j] = numero;
            pile.push([nx, ny]);
          }
        }
        composantes.push(taille);
      }
    }

    const plusGrande = Math.max(...composantes);
    const aEffacer = new Set(
      composantes
        .map((taille, numero) => [numero, taille])
        .filter(([, taille]) => taille / plusGrande < seuil)
        .map(([numero]) => numero),
    );

    let effaces = 0;
    for (let i = 0; i < vu.length; i += 1) {
      if (vu[i] < 0 || !aEffacer.has(vu[i])) continue;
      px[i * 4 + 3] = 0;
      effaces += 1;
    }
    ctx.putImageData(donnees, 0, 0);

    /* Le PNG dérivé est tiré de la MÊME toile, à la hauteur qu'attend
       l'image sociale : deux conversions séparées finiraient par diverger. */
    const hauteur = 256;
    const largeur = Math.round((toile.width / toile.height) * hauteur);
    const grand = document.createElement("canvas");
    grand.width = largeur;
    grand.height = hauteur;
    grand.getContext("2d").drawImage(toile, 0, 0, largeur, hauteur);

    return {
      webp: toile.toDataURL("image/webp", 0.95),
      png: grand.toDataURL("image/png"),
      composantes: composantes.length,
      effaces,
    };
  },
  { source, seuil: SEUIL },
);

await navigateur.close();

const octets = (uri) => Buffer.from(uri.split(",")[1], "base64");
writeFileSync(MARQUE, octets(resultat.webp));
writeFileSync(DERIVE, octets(resultat.png));

process.stderr.write(
  `${resultat.composantes} composantes, ${resultat.effaces} pixels effacés\n` +
    `Écrit ${MARQUE}\nÉcrit ${DERIVE}\n`,
);
