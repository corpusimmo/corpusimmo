/**
 * Contours des régions et départements, simplifiés, porteurs de leur médiane.
 *
 * À lancer APRÈS `agreger-territoires.mjs`, dont il consomme la sortie.
 *
 * TROIS DÉCISIONS.
 *
 * 1. La médiane est écrite DANS les propriétés du GeoJSON, plutôt que jointe à
 *    l'exécution. La carte reçoit un fichier autoportant : pas de jointure à
 *    tenir, pas d'état intermédiaire, et une expression MapLibre lit
 *    directement `["get", "ppsm"]`.
 *
 * 2. Les contours sont SIMPLIFIÉS ici, pas à l'affichage. Le tracé IGN complet
 *    pèse plusieurs mégaoctets — à un zoom où la France tient dans l'écran, on
 *    ne verra jamais la différence entre deux points distants de cent mètres,
 *    mais le visiteur, lui, paierait le téléchargement.
 *
 * 3. Un territoire sans médiane publiable garde sa géométrie et reçoit
 *    `ppsm: null`. Il sera dessiné sans remplissage, avec son contour : « pas
 *    assez de ventes pour publier » se montre, ça ne s'efface pas.
 *
 *   node scripts/contours-territoires.mjs
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Contours administratifs, sous Licence Ouverte (IGN ADMIN EXPRESS via
 * `france-geojson`).
 *
 * Ce n'est PAS `geo.api.gouv.fr` : cette API a cessé de servir les contours —
 * `format=geojson&geometry=contour` renvoie aujourd'hui une simple liste de
 * codes, sans géométrie. Vérifié avant de changer de source.
 */
const GEO = "https://france-geojson.gregoiredavid.fr/repo";

/**
 * Tolérances de Douglas-Peucker, en degrés.
 *
 * Les régions ne s'affichent qu'à très petite échelle, elles supportent une
 * tolérance plus grossière que les départements. 0,01° ≈ 1,1 km ;
 * 0,004° ≈ 450 m.
 */
const TOLERANCE = { regions: 0.01, departements: 0.004 };

/** Quatre décimales ≈ 11 m : au-delà, on transporte du bruit. */
const PRECISION = 4;

/* ── Simplification ──────────────────────────────────────────────────────── */

/** Distance perpendiculaire d'un point au segment [a, b], en degrés. */
function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy));
}

/** Douglas-Peucker, itératif : une côte bretonne fait exploser la pile. */
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
      if (d > worst) { worst = d; index = i; }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function round(point) {
  return [
    Number(point[0].toFixed(PRECISION)),
    Number(point[1].toFixed(PRECISION)),
  ];
}

/** Un anneau doit rester fermé et garder au moins un triangle. */
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
    coordinates: geometry.coordinates.map((poly) =>
      poly.map((r) => simplifyRing(r, tolerance)),
    ),
  };
}

/* ── Ancrage des libellés ────────────────────────────────────────────────── */

/**
 * Un point par territoire, pas un par morceau de géométrie.
 *
 * MapLibre pose une étiquette sur CHAQUE polygone d'un multi-polygone : la
 * Bretagne apparaissait deux fois, une pour le continent et une pour ses
 * îles. On calcule donc ici un point unique — le centroïde de l'anneau
 * extérieur le plus VASTE, qui est le morceau principal — et les libellés
 * prennent leur propre source.
 */
function largestRing(geometry) {
  const rings =
    geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0]);
  let best = rings[0];
  let bestArea = -Infinity;
  for (const ring of rings) {
    const area = Math.abs(shoelace(ring));
    if (area > bestArea) { bestArea = area; best = ring; }
  }
  return best;
}

function shoelace(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return sum / 2;
}

/** Centroïde d'aire de l'anneau — pas la moyenne des sommets, qui dérive vers
 *  les côtes découpées où les points s'accumulent. */
function ringCentroid(ring) {
  const area = shoelace(ring);
  if (area === 0) return ring[0];
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  return [
    Number((x / (6 * area)).toFixed(PRECISION)),
    Number((y / (6 * area)).toFixed(PRECISION)),
  ];
}

/* ── Programme ───────────────────────────────────────────────────────────── */

async function build(kind, stats) {
  const url = `${GEO}/${kind}.geojson`;
  const source = await fetch(url).then((r) => r.json());
  const byCode = new Map(stats.map((s) => [s.code, s]));

  const features = source.features.map((feature) => {
    const code = feature.properties.code;
    const s = byCode.get(code);
    return {
      type: "Feature",
      properties: {
        code,
        nom: feature.properties.nom,
        // `null` traverse le JSON et se lit dans une expression MapLibre :
        // c'est ce qui permet de dessiner « pas de donnée » plutôt que rien.
        ppsm: s?.ppsm ?? null,
        count: s?.count ?? 0,
      },
      geometry: simplifyGeometry(feature.geometry, TOLERANCE[kind]),
    };
  });

  const out = path.join(process.cwd(), `public/geo/${kind}.geojson`);
  await mkdir(path.dirname(out), { recursive: true });
  const body = JSON.stringify({ type: "FeatureCollection", features });
  await writeFile(out, body, "utf8");

  const points = {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: f.properties,
      geometry: { type: "Point", coordinates: ringCentroid(largestRing(f.geometry)) },
    })),
  };
  await writeFile(
    path.join(process.cwd(), `public/geo/${kind}-points.geojson`),
    JSON.stringify(points),
    "utf8",
  );

  const withData = features.filter((f) => f.properties.ppsm !== null).length;
  process.stderr.write(
    `${kind} : ${features.length} entités, ${withData} avec médiane, ` +
      `${(body.length / 1024).toFixed(0)} ko\n`,
  );
}

async function main() {
  const raw = await readFile(
    path.join(process.cwd(), "src/data/territoires.json"),
    "utf8",
  );
  const data = JSON.parse(raw);
  await build("regions", data.regions);
  await build("departements", data.departements);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
