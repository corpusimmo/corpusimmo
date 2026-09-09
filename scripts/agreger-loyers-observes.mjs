/**
 * Loyers OBSERVÉS des observatoires locaux des loyers (réseau ANIL / OLL).
 *
 * POURQUOI UNE SECONDE SOURCE. La « carte des loyers » (`agreger-loyers.mjs`)
 * couvre toute la France, mais avec des loyers d'ANNONCE, charges comprises,
 * estimés par modèle. Les observatoires locaux, eux, relèvent des loyers de
 * BAUX SIGNÉS, hors charges, auprès des bailleurs et des gestionnaires. C'est
 * la seule source publique française de loyers réellement pratiqués. Elle ne
 * couvre qu'une cinquantaine d'agglomérations, découpées en zones : là où
 * elle existe, elle prime ; ailleurs, la carte des loyers reste.
 *
 * CE QU'ON RETIENT. Chaque observatoire publie un zip par an : un CSV de
 * résultats croisant zone × type × époque × pièces × ancienneté, un CSV de
 * zonage (IRIS → zone) et des KML de contours. On ne garde que la ligne
 * « ensemble » de chaque zone de calcul (tous logements confondus), plus la
 * médiane appartement et la médiane maison de la même zone, et les contours
 * de ces zones. Les croisements fins existent, mais un loyer par époque de
 * construction et nombre de pièces sur une zone de 3 000 logements repose sur
 * quelques dizaines d'observations : ce n'est pas un chiffre de carte.
 *
 * MILLÉSIME. Tous les observatoires ne publient pas chaque année. On prend,
 * pour chacun, le plus récent des deux derniers millésimes, et on l'écrit
 * dans les propriétés : deux zones voisines peuvent porter deux années.
 *
 * ATTRIBUTION : « Observatoires locaux des loyers, réseau ANIL ».
 *
 * Dépendance : la commande `unzip` (présente sur macOS et sur toute Debian).
 *
 *   node scripts/agreger-loyers-observes.mjs
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

const CATALOGUE =
  "https://www.data.gouv.fr/api/1/datasets/resultats-des-observatoires-locaux-des-loyers-par-agglomeration/";

const ATTRIBUTION = "Observatoires locaux des loyers, réseau ANIL";

/** Le zip porte le millésime et le code observatoire dans son nom. */
const NOM_ZIP = /Base_OP_(\d{4})_(L[0-9A-Z]{4})\.zip$/;

/**
 * Observatoires ENGLOBANTS, à écarter quand leurs parties sont publiées.
 *
 * L7500 est « l'agglomération parisienne » entière ; L7501 (Paris) et L7502
 * (hors Paris) la redécoupent plus finement. Garder les trois superposerait
 * deux médianes au même endroit sans que la carte sache laquelle montrer.
 */
const ENGLOBANTS = new Set(["L7500"]);

/** Douglas-Peucker : 0,0004° ≈ 45 m. Les zones OLL sont tracées à l'IRIS. */
const TOLERANCE = 0.0004;
const PRECISION = 4;

/* ── Simplification ──────────────────────────────────────────────────────── */

function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy));
}

function simplifyLine(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let index = -1;
    let worst = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpendicular(points[i], points[first], points[last]);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function round(point) {
  return [Number(point[0].toFixed(PRECISION)), Number(point[1].toFixed(PRECISION))];
}

function simplifyRing(ring) {
  const simplified = simplifyLine(ring, TOLERANCE).map(round);
  if (simplified.length < 4) return ring.map(round);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
  return simplified;
}

/* ── CSV (mêmes pièges que la carte des loyers : cp1252, `;`, virgules) ── */

function decoder(octets) {
  return new TextDecoder("windows-1252").decode(octets);
}

function decouper(ligne) {
  const champs = [];
  let champ = "";
  let cite = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i];
    if (cite) {
      if (c === '"') {
        if (ligne[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else cite = false;
      } else champ += c;
    } else if (c === '"') cite = true;
    else if (c === ";") {
      champs.push(champ);
      champ = "";
    } else champ += c;
  }
  champs.push(champ);
  return champs;
}

function nombre(valeur) {
  if (valeur === undefined || valeur.trim() === "") return null;
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Lignes du CSV sous forme d'objets, colonnes lues par leur nom. */
function lireCsv(octets) {
  const lignes = decoder(octets).split(/\r?\n/).filter((l) => l.trim() !== "");
  const entete = decouper(lignes[0] ?? "").map((c) => c.replace(/^﻿/, "").trim());
  return lignes.slice(1).map((ligne) => {
    const champs = decouper(ligne);
    const objet = {};
    entete.forEach((nom, i) => {
      objet[nom] = (champs[i] ?? "").trim();
    });
    return objet;
  });
}

/* ── KML ─────────────────────────────────────────────────────────────────── */

/**
 * Lecture minimale : un `Placemark` par zone, son `VAR4` comme code, ses
 * polygones avec anneaux extérieurs et intérieurs. Pas de bibliothèque XML :
 * les fichiers viennent d'un seul producteur, au même gabarit depuis 2014.
 */
function lireKml(texte) {
  const zones = [];
  const placemarks = texte.match(/<Placemark>[\s\S]*?<\/Placemark>/g) ?? [];
  for (const bloc of placemarks) {
    const code = /<SimpleData name="VAR4">([^<]*)<\/SimpleData>/.exec(bloc)?.[1]?.trim() ?? null;
    const polygones = [];
    for (const poly of bloc.match(/<Polygon>[\s\S]*?<\/Polygon>/g) ?? []) {
      const exterieur = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(poly)?.[1];
      if (!exterieur) continue;
      const anneaux = [lireAnneau(exterieur)];
      for (const trou of poly.match(/<innerBoundaryIs>[\s\S]*?<\/innerBoundaryIs>/g) ?? []) {
        const coords = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(trou)?.[1];
        if (coords) anneaux.push(lireAnneau(coords));
      }
      polygones.push(anneaux.map(simplifyRing));
    }
    if (polygones.length === 0) continue;
    zones.push({
      code,
      geometry:
        polygones.length === 1
          ? { type: "Polygon", coordinates: polygones[0] }
          : { type: "MultiPolygon", coordinates: polygones },
    });
  }
  return zones;
}

function lireAnneau(texte) {
  return texte
    .trim()
    .split(/\s+/)
    .map((paire) => {
      const [lon, lat] = paire.split(",").map(Number);
      return [lon, lat];
    })
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

/* ── Catalogue ───────────────────────────────────────────────────────────── */

/** Le nom lisible de l'agglomération, tiré du titre de la ressource. */
function nomAgglomeration(titre) {
  return titre
    .replace(/^Niveau des loyers en \d{4} pour\s+/i, "")
    .replace(/^l'agglomérations?\s+(d'|de\s+|du\s+|de la\s+)/i, "")
    .replace(/^l'/i, "")
    .trim();
}

async function trouverObservatoires() {
  const reponse = await fetch(CATALOGUE, { headers: { accept: "application/json" } });
  if (!reponse.ok) throw new Error(`data.gouv.fr a répondu ${reponse.status}`);
  const { resources = [] } = await reponse.json();

  const parCode = new Map();
  for (const ressource of resources) {
    const trouve = NOM_ZIP.exec(ressource.url ?? "");
    if (!trouve) continue;
    const annee = Number(trouve[1]);
    const code = trouve[2];
    if (ENGLOBANTS.has(code)) continue;
    const courant = parCode.get(code);
    if (!courant || courant.annee < annee) {
      parCode.set(code, { code, annee, url: ressource.url, nom: nomAgglomeration(ressource.title ?? code) });
    }
  }
  if (parCode.size === 0) throw new Error("Aucun zip Base_OP dans le catalogue : le nommage a changé.");

  // Deux derniers millésimes seulement : un observatoire muet depuis trois ans
  // décrit un marché qui n'existe plus.
  const plusRecent = Math.max(...[...parCode.values()].map((o) => o.annee));
  return [...parCode.values()]
    .filter((o) => o.annee >= plusRecent - 1)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/* ── Un observatoire ─────────────────────────────────────────────────────── */

/** Vrai pour la ligne « tous logements » d'un niveau géographique. */
function estEnsemble(ligne) {
  return (
    ligne.Type_habitat === "" &&
    ligne.epoque_construction_local === "" &&
    ligne.epoque_construction_homogene === "" &&
    ligne.anciennete_locataire_local === "" &&
    ligne.anciennete_locataire_homogene === "" &&
    ligne.nombre_pieces_local === "" &&
    ligne.nombre_pieces_homogene === ""
  );
}

/** Vrai pour la ligne « appartement » ou « maison », sans autre croisement. */
function estParType(ligne, type) {
  return (
    ligne.Type_habitat === type &&
    ligne.epoque_construction_local === "" &&
    ligne.epoque_construction_homogene === "" &&
    ligne.anciennete_locataire_local === "" &&
    ligne.anciennete_locataire_homogene === "" &&
    ligne.nombre_pieces_local === "" &&
    ligne.nombre_pieces_homogene === ""
  );
}

function indicateur(ligne) {
  if (!ligne) return null;
  const m2 = nombre(ligne.loyer_median);
  if (m2 === null || m2 <= 0) return null;
  return {
    m2,
    q1: nombre(ligne.loyer_1_quartile),
    q3: nombre(ligne.loyer_3_quartile),
    mensuel: nombre(ligne.loyer_mensuel_median),
    surface: nombre(ligne.surface_moyenne),
    obs: nombre(ligne.nombre_observations) ?? 0,
    logements: nombre(ligne.nombre_logements) ?? 0,
  };
}

async function traiter(observatoire) {
  const { code, annee, url, nom } = observatoire;
  const dossier = await mkdtemp(path.join(os.tmpdir(), "oll-"));
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`${url} a répondu ${reponse.status}`);
    const zip = path.join(dossier, "base.zip");
    await writeFile(zip, Buffer.from(await reponse.arrayBuffer()));
    await exec("unzip", ["-o", "-q", zip, "-d", dossier]);

    const fichiers = await readdir(dossier);
    const csvBase = fichiers.find((f) => /^Base_OP_\d{4}_L[0-9A-Z]{4}\.csv$/i.test(f));
    const csvZonage = fichiers.find((f) => /Zonage\d{4}\.csv$/i.test(f));
    const kmlZones = fichiers.filter((f) => /_zone_cal_\d{4}.*\.kml$/i.test(f));
    const kmlAgglo = fichiers.find((f) => /_agglo_\d{4}\.kml$/i.test(f));
    if (!csvBase) throw new Error(`${code} : CSV de résultats introuvable`);

    const lignes = lireCsv(await readFile(path.join(dossier, csvBase)));

    // Libellés des zones : « 01 » → « Nantes1 ». Le code de zone de calcul
    // finit par le même numéro que la colonne ZONE du zonage.
    const libelles = new Map();
    if (csvZonage) {
      for (const l of lireCsv(await readFile(path.join(dossier, csvZonage)))) {
        if (l.ZONE && l.LIB_ZONE && !libelles.has(l.ZONE)) libelles.set(l.ZONE, l.LIB_ZONE);
      }
    }

    const agglo = indicateur(lignes.find((l) => l.Zone_calcul === "" && l.Zone_complementaire === "" && estEnsemble(l)));

    const features = [];
    const contours = [];
    for (const f of kmlZones) contours.push(...lireKml(await readFile(path.join(dossier, f), "utf8")));

    if (contours.length > 0) {
      for (const zone of contours) {
        const propres = lignes.filter((l) => l.Zone_calcul === zone.code);
        const ensemble = indicateur(propres.find(estEnsemble));
        if (!ensemble) continue;
        const suffixe = zone.code?.split(".").pop() ?? "";
        features.push({
          type: "Feature",
          properties: {
            niveau: "zone",
            obs_code: code,
            agglo: nom,
            annee,
            zone: zone.code,
            zone_nom: libelles.get(suffixe) ?? null,
            m2: ensemble.m2,
            q1: ensemble.q1,
            q3: ensemble.q3,
            mensuel: ensemble.mensuel,
            surface: ensemble.surface,
            obs: ensemble.obs,
            logements: ensemble.logements,
            app: indicateur(propres.find((l) => estParType(l, "Appartement")))?.m2 ?? null,
            mai: indicateur(propres.find((l) => estParType(l, "Maison")))?.m2 ?? null,
            agglo_m2: agglo?.m2 ?? null,
          },
          geometry: zone.geometry,
        });
      }
    } else if (kmlAgglo && agglo) {
      // Pas de zonage publié : l'agglomération entière porte sa médiane.
      const [contour] = lireKml(await readFile(path.join(dossier, kmlAgglo), "utf8"));
      if (contour) {
        const racine = lignes.filter((l) => l.Zone_calcul === "" && l.Zone_complementaire === "");
        features.push({
          type: "Feature",
          properties: {
            niveau: "agglo",
            obs_code: code,
            agglo: nom,
            annee,
            zone: code,
            zone_nom: null,
            m2: agglo.m2,
            q1: agglo.q1,
            q3: agglo.q3,
            mensuel: agglo.mensuel,
            surface: agglo.surface,
            obs: agglo.obs,
            logements: agglo.logements,
            app: indicateur(racine.find((l) => estParType(l, "Appartement")))?.m2 ?? null,
            mai: indicateur(racine.find((l) => estParType(l, "Maison")))?.m2 ?? null,
            agglo_m2: agglo.m2,
          },
          geometry: contour.geometry,
        });
      }
    }

    process.stderr.write(`  ${code} ${annee} ${nom} : ${features.length} zone(s)\n`);
    return features;
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

/* ── Programme ───────────────────────────────────────────────────────────── */

async function main() {
  const observatoires = await trouverObservatoires();
  process.stderr.write(`${observatoires.length} observatoires\n`);

  const features = [];
  const agglomerations = [];
  for (const observatoire of observatoires) {
    try {
      const zones = await traiter(observatoire);
      features.push(...zones);
      if (zones.length > 0) {
        agglomerations.push({ code: observatoire.code, nom: observatoire.nom, annee: observatoire.annee, zones: zones.length });
      }
    } catch (error) {
      // Un observatoire cassé ne doit pas priver la carte des cinquante autres.
      process.stderr.write(`  ${observatoire.code} ignoré : ${String(error)}\n`);
    }
  }
  if (features.length === 0) throw new Error("Aucune zone produite.");

  const dossier = path.join(process.cwd(), "public/geo");
  await mkdir(dossier, { recursive: true });
  const body = JSON.stringify({ type: "FeatureCollection", features });
  await writeFile(path.join(dossier, "loyers-observes.geojson"), body, "utf8");

  const annees = [...new Set(agglomerations.map((a) => a.annee))].sort();
  await writeFile(
    path.join(dossier, "loyers-observes-index.json"),
    JSON.stringify({
      generatedAt: new Date().toISOString().slice(0, 10),
      source: "Résultats des observatoires locaux des loyers par agglomération (ANIL)",
      attribution: ATTRIBUTION,
      page: "https://www.data.gouv.fr/datasets/resultats-des-observatoires-locaux-des-loyers-par-agglomeration",
      annees,
      precautions: [
        "Loyers de baux en cours au 1er janvier du millésime, hors charges, parc privé, relevés auprès des bailleurs et gestionnaires.",
        "Médiane de tous les logements de la zone, appartements et maisons confondus ; les médianes par type sont fournies à part.",
        "Chaque observatoire publie à son rythme : deux zones voisines peuvent porter deux millésimes différents.",
      ],
      agglomerations,
    }),
    "utf8",
  );

  process.stderr.write(
    `\nÉcrit public/geo/loyers-observes.geojson : ${features.length} zones, ` +
      `${agglomerations.length} agglomérations, millésimes ${annees.join(" et ")}, ` +
      `${(body.length / 1024).toFixed(0)} ko\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
