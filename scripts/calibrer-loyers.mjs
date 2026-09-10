/**
 * CALER LES LOYERS D'ANNONCE SUR LES LOYERS RÉELLEMENT PRATIQUÉS.
 *
 * ── LE PROBLÈME, ET IL EST MESURABLE ───────────────────────────────────────
 * La carte des loyers (ANIL/DGALN) couvre les 34 900 communes, mais avec des
 * loyers d'ANNONCE, charges comprises, estimés par modèle. Les observatoires
 * locaux des loyers relèvent, eux, des loyers de BAUX SIGNÉS, hors charges,
 * auprès des bailleurs — mais sur une cinquantaine d'agglomérations seulement.
 *
 * Là où les deux se recouvrent, l'écart n'est ni aléatoire ni petit : sur les
 * zones appariées, l'annonce dépasse le bail signé d'environ 15 %. Le produit
 * le disait déjà en toutes lettres (« ils surestiment le loyer net encaissé »)
 * sans jamais en tirer la conséquence : le chiffre affiché restait celui de
 * l'annonce. Une mise en garde n'est pas une correction.
 *
 * ── CE QUE CE SCRIPT CALCULE ───────────────────────────────────────────────
 * Un facteur de correction, fonction du NIVEAU de loyer, mesuré zone par zone :
 *
 *   1. chaque zone d'observatoire reçoit les communes de la carte des loyers
 *      dont le point représentatif tombe dedans ;
 *   2. le rapport « médiane observée / médiane d'annonce » est calculé par
 *      zone ;
 *   3. les zones sont rangées par niveau d'annonce et découpées en cinq
 *      tranches d'effectif égal ; chaque tranche donne un ancrage
 *      (niveau médian, rapport médian) ;
 *   4. entre deux ancrages, le facteur s'interpole linéairement ; au-delà, il
 *      reste constant.
 *
 * POURQUOI UNE FONCTION DU NIVEAU, ET PAS UN FACTEUR UNIQUE. Le rapport n'est
 * pas plat : il vaut environ 0,87 sur les marchés à 10 €/m² et 0,81 au-delà de
 * 18 €/m². Les charges pèsent proportionnellement moins cher quand le loyer
 * monte, et l'écart entre le prix demandé et le bail signé se creuse sur les
 * marchés tendus. Un facteur unique corrigerait Paris à l'aide de Guéret.
 *
 * ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────────────
 * Il ne touche À AUCUNE donnée source. `src/data/loyers.json` et
 * `public/geo/loyers/*.geojson` gardent les valeurs publiées : le brut reste
 * brut, et la correction est un calque qu'on peut relire, contester ou
 * retirer. Elle vit dans un fichier séparé, avec ses diagnostics.
 *
 * ── LE CONTRÔLE, PAR UNE TROISIÈME SOURCE ──────────────────────────────────
 * `data/loyers-oll-agglomerations.csv` est l'export agglomération par
 * agglomération du même réseau d'observatoires : une ligne « ensemble » par
 * périmètre, indépendante du découpage en zones utilisé pour le calage. Le
 * script compare la médiane calibrée à cette ligne et écrit l'écart obtenu.
 * Un calage qui ne se vérifie pas sur une source qu'il n'a pas servi à
 * construire ne vaut rien.
 *
 *   node scripts/calibrer-loyers.mjs
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RACINE = process.cwd();
const GEO = path.join(RACINE, "public/geo");
const CSV_CONTROLE = path.join(RACINE, "data/loyers-oll-agglomerations.csv");
const SORTIE = path.join(RACINE, "src/data/loyers-calibration.json");

/** Cinq tranches : assez pour voir la pente, assez peu pour que chacune tienne. */
const TRANCHES = 5;
/** Sous ce nombre de communes appariées, une zone ne cale rien. */
const MIN_COMMUNES = 2;

/* ─────────────────────────────────────────────────────── géométrie, au plus court */

function anneaux(geom) {
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}

function boite(geom) {
  let x0 = 180;
  let y0 = 90;
  let x1 = -180;
  let y1 = -90;
  for (const poly of anneaux(geom))
    for (const anneau of poly)
      for (const [x, y] of anneau) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return [x0, y0, x1, y1];
}

/** Lancer de rayon. Un point sur l'arête peut tomber d'un côté ou de l'autre ;
    à l'échelle d'une commune dans une zone d'agglomération, c'est sans effet. */
function dansAnneau(point, anneau) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    const traverse = yi > point[1] !== yj > point[1];
    if (traverse && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      dedans = !dedans;
    }
  }
  return dedans;
}

function dansPolygone(point, geom) {
  for (const poly of anneaux(geom)) {
    if (!dansAnneau(point, poly[0])) continue;
    let trou = false;
    for (let k = 1; k < poly.length; k += 1) {
      if (dansAnneau(point, poly[k])) {
        trou = true;
        break;
      }
    }
    if (!trou) return true;
  }
  return false;
}

/**
 * Point représentatif d'une commune : la moyenne des sommets de son contour
 * extérieur.
 *
 * Ce n'est pas le centroïde d'aire, et c'est assez. On ne mesure pas une
 * surface, on décide dans quelle zone d'agglomération une commune tombe ; les
 * seules communes où les deux diffèrent assez pour changer de zone sont celles
 * qui chevauchent déjà une frontière de zone.
 */
function centre(geom) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const poly of anneaux(geom))
    for (const [x, y] of poly[0]) {
      sx += x;
      sy += y;
      n += 1;
    }
  return n === 0 ? null : [sx / n, sy / n];
}

/* ─────────────────────────────────────────────────────────────────── statistique */

function mediane(valeurs) {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = tri.length >> 1;
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

function quantile(valeurs, p) {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.min(tri.length - 1, Math.floor(tri.length * p))];
}

const arrondi = (v, n = 3) => Number(v.toFixed(n));

/* ────────────────────────────────────────────────────────────────── appariement */

async function chargerZones() {
  const fichier = path.join(GEO, "loyers-observes.geojson");
  const fc = JSON.parse(await readFile(fichier, "utf8"));
  return fc.features
    .map((f) => ({
      p: f.properties,
      geom: f.geometry,
      bb: boite(f.geometry),
      annonces: [],
    }))
    .filter((z) => typeof (z.p.app ?? z.p.m2) === "number");
}

async function apparier(zones) {
  const dossier = path.join(GEO, "loyers");
  const fichiers = (await readdir(dossier)).filter((n) => n.endsWith(".geojson"));
  let communes = 0;
  for (const nom of fichiers) {
    const fc = JSON.parse(await readFile(path.join(dossier, nom), "utf8"));
    for (const f of fc.features) {
      const app = f.properties.app;
      if (typeof app !== "number") continue;
      const point = centre(f.geometry);
      if (!point) continue;
      for (const zone of zones) {
        if (
          point[0] < zone.bb[0] ||
          point[0] > zone.bb[2] ||
          point[1] < zone.bb[1] ||
          point[1] > zone.bb[3]
        ) {
          continue;
        }
        if (!dansPolygone(point, zone.geom)) continue;
        zone.annonces.push(app);
        communes += 1;
        break;
      }
    }
  }
  return communes;
}

/* ──────────────────────────────────────────────────────────────────── ancrages */

function ancrages(paires) {
  const rangees = [...paires].sort((a, b) => a.annonce - b.annonce);
  const taille = Math.ceil(rangees.length / TRANCHES);
  const points = [];
  for (let i = 0; i < rangees.length; i += taille) {
    const tranche = rangees.slice(i, i + taille);
    if (tranche.length === 0) continue;
    points.push({
      niveau: arrondi(mediane(tranche.map((r) => r.annonce)), 2),
      facteur: arrondi(mediane(tranche.map((r) => r.rapport))),
      zones: tranche.length,
    });
  }

  /* LA PENTE EST FORCÉE DÉCROISSANTE. Sur cinq tranches, une inversion d'un
     millième relève du bruit d'échantillon, pas d'un marché où l'annonce
     serait soudain plus honnête. Une courbe qui remonte au milieu produirait,
     elle, un chiffre corrigé qui dépasse le chiffre voisin non corrigé. */
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].facteur > points[i - 1].facteur) {
      points[i].facteur = points[i - 1].facteur;
    }
  }
  return points;
}

function facteurA(niveau, points) {
  if (points.length === 0) return 1;
  if (niveau <= points[0].niveau) return points[0].facteur;
  const dernier = points[points.length - 1];
  if (niveau >= dernier.niveau) return dernier.facteur;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (niveau > b.niveau) continue;
    const t = (niveau - a.niveau) / (b.niveau - a.niveau);
    return a.facteur + t * (b.facteur - a.facteur);
  }
  return dernier.facteur;
}

/* ─────────────────────────────────────────────────────────────────── contrôle */

function normaliser(nom) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /^(agglomerations?|communaute d'agglomeration|communautes? de communes|departement)\s+(de la |de |du |des |d'|l')?/,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function lireControle() {
  let texte;
  try {
    texte = await readFile(CSV_CONTROLE, "utf8");
  } catch {
    return null;
  }
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/);
  const debut = lignes.findIndex((l) => l.startsWith('"Observatoire"'));
  if (debut < 0) return null;
  const entetes = lignes[debut].split(";").map((c) => c.replace(/^"|"$/g, ""));
  const iNom = entetes.indexOf("Périmètre d'observation");
  const iMed = entetes.indexOf("Mediane du loyer au m²");
  const iZone = entetes.indexOf("Zone de calcul");
  const par = new Map();
  for (const ligne of lignes.slice(debut + 1)) {
    if (!ligne.trim()) continue;
    const cellules = ligne.split(";").map((c) => c.replace(/^"|"$/g, ""));
    if (iZone >= 0 && cellules[iZone] !== "ALL") continue;
    const valeur = Number(cellules[iMed]);
    if (!Number.isFinite(valeur)) continue;
    par.set(normaliser(cellules[iNom]), valeur);
  }
  return par;
}

/* ───────────────────────────────────────────────────────────────────── sortie */

async function main() {
  const zones = await chargerZones();
  const communes = await apparier(zones);

  const paires = [];
  for (const zone of zones) {
    if (zone.annonces.length < MIN_COMMUNES) continue;
    const annonce = mediane(zone.annonces);
    const observe = typeof zone.p.app === "number" ? zone.p.app : zone.p.m2;
    if (!annonce || !observe) continue;
    paires.push({
      agglo: zone.p.agglo,
      annonce,
      observe,
      rapport: observe / annonce,
    });
  }

  if (paires.length < TRANCHES * 4) {
    throw new Error(
      `seulement ${paires.length} zones appariées : trop peu pour caler quoi que ce soit`,
    );
  }

  const points = ancrages(paires);
  const rapports = paires.map((p) => p.rapport);

  /* Le contrôle : par agglomération, la médiane des zones calibrées contre la
     ligne « ensemble » de l'export national. */
  const controleSource = await lireControle();
  let controle = null;
  if (controleSource) {
    const parAgglo = new Map();
    for (const paire of paires) {
      const clef = normaliser(paire.agglo);
      if (!parAgglo.has(clef)) parAgglo.set(clef, []);
      parAgglo
        .get(clef)
        .push(paire.annonce * facteurA(paire.annonce, points));
    }
    const ecarts = [];
    for (const [clef, calibres] of parAgglo) {
      const attendu = controleSource.get(clef);
      if (!attendu) continue;
      const obtenu = mediane(calibres);
      ecarts.push((obtenu - attendu) / attendu);
    }
    if (ecarts.length > 0) {
      controle = {
        agglomerations: ecarts.length,
        ecartMedian: arrondi(mediane(ecarts), 4),
        ecartAbsMedian: arrondi(mediane(ecarts.map(Math.abs)), 4),
        source:
          "Résultats des observatoires locaux des loyers par agglomération (ANIL), ligne « ensemble »",
      };
    }
  }

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    objet:
      "Facteur qui ramène un loyer d'annonce charges comprises (carte des loyers) à un loyer de bail signé hors charges (observatoires locaux des loyers).",
    methode:
      "Rapport médian « zone d'observatoire / communes d'annonce qu'elle contient », en cinq tranches de niveau de loyer, interpolé linéairement entre les ancrages.",
    ancrages: points,
    global: arrondi(mediane(rapports)),
    dispersion: {
      q10: arrondi(quantile(rapports, 0.1)),
      q25: arrondi(quantile(rapports, 0.25)),
      q75: arrondi(quantile(rapports, 0.75)),
      q90: arrondi(quantile(rapports, 0.9)),
    },
    appariement: { zones: paires.length, communes },
    controle,
    precautions: [
      "Le facteur est mesuré sur les agglomérations dotées d'un observatoire : l'appliquer ailleurs suppose que l'écart annonce/bail y est de même nature.",
      "Il corrige un biais MOYEN, pas le cas particulier : la moitié des zones s'écarte du facteur de plus de cinq points.",
      "Il ne transforme pas une estimation de voisinage en observation locale : une commune en échelle « maille » reste une commune sans annonce relevée.",
    ],
  };

  await mkdir(path.dirname(SORTIE), { recursive: true });
  await writeFile(SORTIE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  process.stderr.write(
    `Écrit ${SORTIE}\n` +
      `  ${paires.length} zones appariées, ${communes} communes\n` +
      `  facteur global ${payload.global}\n` +
      points
        .map((p) => `  ${p.niveau} €/m² → ${p.facteur} (${p.zones} zones)`)
        .join("\n") +
      "\n" +
      (controle
        ? `  contrôle : ${controle.agglomerations} agglomérations, écart médian ${(controle.ecartMedian * 100).toFixed(1)} %\n`
        : "  contrôle : absent (CSV manquant)\n"),
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
