/**
 * Contours des communes, par département, porteurs du loyer d'annonce ANIL.
 *
 * À lancer APRÈS `agreger-loyers.mjs`, dont il consomme `src/data/loyers.json`.
 *
 * POURQUOI UN FICHIER PAR DÉPARTEMENT. Les 35 800 communes de métropole pèsent
 * 23 Mo de contours bruts ; simplifiées, encore 6 à 8 Mo. Personne ne regarde
 * la France entière au niveau communal : la carte ne charge que les
 * départements présents à l'écran, et un département fait 60 à 250 ko.
 *
 * MÊME PRINCIPE QUE `contours-territoires.mjs` : l'indicateur voyage DANS les
 * propriétés du GeoJSON, pas de jointure à l'exécution. Et une commune sans
 * indicateur garde son contour avec `app: null` — « pas estimé » se dessine
 * sans remplissage, il ne s'efface pas.
 *
 * L'ÉCHELLE DE COULEUR EST FIXÉE ICI, UNE FOIS, sur l'ensemble des communes.
 * Contrairement aux pastilles de prix, dont les quintiles suivent la vue, un
 * loyer doit se comparer d'une ville à l'autre : la même teinte doit dire le
 * même loyer à Brest et à Nice. Les bornes sont écrites dans `index.json`.
 *
 *   node scripts/contours-communes-loyers.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Contours IGN ADMIN EXPRESS, Licence Ouverte, via `france-geojson`. */
const CONTOURS = "https://france-geojson.gregoiredavid.fr/repo/communes.geojson";

/** Douglas-Peucker, en degrés : 0,0006° ≈ 65 m. Invisible sous le zoom 13. */
const TOLERANCE = 0.0006;
/** Quatre décimales ≈ 11 m. */
const PRECISION = 4;
/** Cinq classes, donc quatre bornes, arrondies au demi-euro. */
const CLASSES = 5;
const ROUNDING = 0.5;

/* ── Simplification (copie de contours-territoires.mjs) ─────────────────── */

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

function simplifyRing(ring, tolerance) {
  const simplified = simplifyLine(ring, tolerance).map(round);
  if (simplified.length < 4) return ring.map(round);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
  return simplified;
}

function simplifyGeometry(geometry, tolerance) {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((r) => simplifyRing(r, tolerance)),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((poly) => poly.map((r) => simplifyRing(r, tolerance))),
  };
}

/* ── Outils ──────────────────────────────────────────────────────────────── */

/** Le département d'un code commune : « 2A », « 2B », « 971 » ou deux chiffres. */
function departement(code) {
  if (code.startsWith("97")) return code.slice(0, 3);
  return code.slice(0, 2);
}

function bbox(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

function merge(a, b) {
  if (!a) return b;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function quantile(sorted, q) {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Les propriétés d'un indicateur, aplaties sous un préfixe : MapLibre lit
 *  `["get", "app"]`, pas un objet imbriqué. */
function flatten(prefix, indicateur) {
  if (!indicateur) {
    return { [prefix]: null, [`${prefix}_bas`]: null, [`${prefix}_haut`]: null, [`${prefix}_ech`]: null, [`${prefix}_obs`]: 0 };
  }
  return {
    [prefix]: indicateur.m2,
    [`${prefix}_bas`]: indicateur.bas,
    [`${prefix}_haut`]: indicateur.haut,
    [`${prefix}_ech`]: indicateur.echelle,
    [`${prefix}_obs`]: indicateur.obs,
  };
}

/* ── Programme ───────────────────────────────────────────────────────────── */

async function main() {
  const loyers = JSON.parse(
    await readFile(path.join(process.cwd(), "src/data/loyers.json"), "utf8"),
  );

  process.stderr.write(`Contours ← ${CONTOURS}\n`);
  const contours = await fetch(CONTOURS).then((r) => {
    if (!r.ok) throw new Error(`${CONTOURS} a répondu ${r.status}`);
    return r.json();
  });

  const parDepartement = new Map();
  const boites = {};
  let jointes = 0;

  for (const feature of contours.features) {
    const code = feature.properties.code;
    const dep = departement(code);
    const commune = loyers.communes[code];
    if (commune) jointes += 1;

    const geometry = simplifyGeometry(feature.geometry, TOLERANCE);
    const out = {
      type: "Feature",
      properties: {
        code,
        nom: feature.properties.nom,
        ...flatten("app", commune?.appartement ?? null),
        ...flatten("mai", commune?.maison ?? null),
      },
      geometry,
    };
    if (!parDepartement.has(dep)) parDepartement.set(dep, []);
    parDepartement.get(dep).push(out);
    boites[dep] = merge(boites[dep], bbox(geometry));
  }

  const dossier = path.join(process.cwd(), "public/geo/loyers");
  await mkdir(dossier, { recursive: true });

  let total = 0;
  for (const [dep, features] of [...parDepartement.entries()].sort()) {
    const body = JSON.stringify({ type: "FeatureCollection", features });
    await writeFile(path.join(dossier, `${dep}.geojson`), body, "utf8");
    total += body.length;
  }

  // Bornes : quintiles des loyers d'appartement de toutes les communes
  // estimées. Le fichier index les porte pour que la carte et sa légende
  // lisent les mêmes chiffres.
  const valeurs = Object.values(loyers.communes)
    .map((c) => c.appartement?.m2)
    .filter((v) => typeof v === "number")
    .sort((a, b) => a - b);
  const breaks = [];
  for (let i = 1; i < CLASSES; i += 1) {
    const brute = quantile(valeurs, i / CLASSES);
    const arrondie = Math.round(brute / ROUNDING) * ROUNDING;
    if (breaks.length === 0 || arrondie > breaks[breaks.length - 1]) breaks.push(arrondie);
  }

  const index = {
    generatedAt: new Date().toISOString().slice(0, 10),
    annee: loyers.annee,
    source: loyers.source,
    attribution: loyers.attribution,
    page: loyers.page,
    surfacesType: loyers.surfacesType,
    breaks,
    departements: Object.fromEntries(
      Object.entries(boites).map(([dep, b]) => [dep, b.map((v) => Number(v.toFixed(PRECISION)))]),
    ),
  };
  await writeFile(path.join(dossier, "index.json"), JSON.stringify(index), "utf8");

  process.stderr.write(
    `\nÉcrit ${parDepartement.size} départements dans ${dossier}\n` +
      `  ${contours.features.length} communes, ${jointes} avec indicateur, ` +
      `${(total / 1024 / 1024).toFixed(1)} Mo au total\n` +
      `  bornes appartement : ${breaks.join(" / ")} €/m²\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
