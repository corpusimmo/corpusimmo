/**
 * Lignes de tram, de métro et de funiculaire de France, avec leurs COULEURS
 * OFFICIELLES.
 *
 * POURQUOI CE SCRIPT EXISTE. Le calque `transports.ts` peint les lignes lues
 * dans les tuiles vectorielles du fond de carte. Ces tuiles (schéma
 * OpenMapTiles) ne portent NI le numéro de la ligne NI sa couleur : toutes les
 * lignes d'une agglomération sortent donc de la même teinte, et « le tram »
 * devient un trait indifférencié. Or la couleur d'une ligne EST son identité
 * dans la tête de l'habitant : à Nantes on ne dit pas « la ligne 1 », on
 * reconnaît le vert. Les GTFS publiés sur transport.data.gouv.fr portent, eux,
 * `route_color` et `route_text_color`, renseignés par l'exploitant lui-même.
 * On fige donc ici, hors ligne, un fichier autoportant plutôt que de demander
 * au navigateur de reconstituer tout cela à chaque visite.
 *
 * CE QUE LE SCRIPT RETIENT, ET CE QU'IL JETTE.
 *   · route_type 0 (tram), 1 (métro), 7 (funiculaire), plus leurs équivalents
 *     étendus (900+, 400+, 1400). Les bus et le train régional sont écartés :
 *     ils feraient exploser le poids du fichier pour une lisibilité nulle à
 *     l'échelle où on regarde des prix au m².
 *   · seules les licences ouvertement réutilisables (voir LICENCES_OUVERTES).
 *     Un jeu `notspecified` est jeté même s'il contient du tram.
 *   · les agrégats régionaux sont écartés : ils republient les réseaux déjà
 *     pris individuellement, et pèsent jusqu'à cent mégaoctets pour rien.
 *
 * PIÈGES RENCONTRÉS, à ne pas redécouvrir.
 *   · `route_color` arrive SANS croisillon, et peut être vide ou blanche.
 *     Sans repli explicite, la ligne se dessine invisible sur le fond clair.
 *   · un aller et un retour donnent deux `shape_id` quasi identiques. On ne
 *     garde que la plus longue par sens, sinon chaque ligne est peinte deux
 *     fois, ce qui double le poids et épaissit le trait au hasard.
 *   · `stop_times.txt` d'un gros réseau se compte en centaines de mégaoctets.
 *     On ne le déroule JAMAIS en entier : on le lit en flux, filtré sur la
 *     poignée de voyages déjà retenus.
 *   · le champ `modes` de l'API est parfois vide sur la ressource à jour et
 *     renseigné sur une ressource périmée du même jeu. D'où l'union des modes
 *     à l'échelle du JEU, et non de la ressource.
 *
 *   node scripts/agreger-transports.mjs
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const API = "https://transport.data.gouv.fr/api/datasets?type=public-transit";

/**
 * Licences acceptées, par leur code d'API.
 *
 * `lov2` et `fr-lo` sont la Licence Ouverte, `odc-odbl` l'ODbL,
 * `mobility-licence` la Licence Mobilités issue de la LOM. Toutes autorisent
 * la réutilisation commerciale ; les deux dernières imposent en contrepartie
 * de citer la source et de repartager les données dérivées, ce que prépare
 * l'attribution écrite dans les fichiers de sortie.
 *
 * `notspecified` est absent VOLONTAIREMENT : sans licence déclarée, rien ne
 * dit que la réutilisation soit permise.
 */
const LICENCES_OUVERTES = new Map([
  ["lov2", "Licence Ouverte 2.0"],
  ["fr-lo", "Licence Ouverte"],
  ["odc-odbl", "ODbL 1.0"],
  ["mobility-licence", "Licence Mobilités"],
]);

/** Modes annoncés par l'API qui valent la peine d'ouvrir le zip. */
const MODES_UTILES = new Set(["tramway", "tram", "subway", "metro", "funicular"]);

/**
 * Jeux écartés avant tout téléchargement.
 *
 * Les agrégats régionaux rassemblent des réseaux déjà publiés séparément :
 * les garder produirait deux fois chaque ligne, avec des couleurs parfois
 * divergentes selon la version republiée. Le jeu SNCF national relève du train
 * régional, hors cadrage.
 */
const JEUX_ECARTES = /^(Agrégat des réseaux|Réseau SNCF)/i;

/**
 * Tolérance de Douglas-Peucker, en degrés. 0,00012° ≈ 13 m.
 *
 * Un tracé de tram se regarde entre z12 et z17 : en deçà de la largeur du
 * trait, on ne transporte plus que du bruit GPS.
 */
const TOLERANCE = 0.00012;

/** Cinq décimales ≈ 1,1 m, cohérent avec la tolérance ci-dessus. */
const PRECISION = 5;

/**
 * Replis de couleur, par mode.
 *
 * Servent quand `route_color` est vide, blanche ou illisible. Volontairement
 * ternes : une ligne sans couleur déclarée ne doit pas se faire passer pour
 * une ligne identifiée.
 */
const COULEUR_DEFAUT = { tram: "#7a5c9e", metro: "#1f5c9e", funiculaire: "#7a6ba8" };

/* ── Lecture des GTFS ────────────────────────────────────────────────────── */

/**
 * Analyseur CSV conforme au RFC 4180.
 *
 * Les libellés d'arrêts contiennent des virgules et des guillemets échappés :
 * un `split(",")` les casserait et décalerait toutes les colonnes suivantes.
 */
function parseCsvLine(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

/** En-tête d'un GTFS : marque d'ordre des octets fréquente, et espaces
 *  parasites autour des noms de colonnes. */
function parseHeader(line) {
  return parseCsvLine(line.replace(/^\uFEFF/, "")).map((h) => h.trim());
}

/**
 * Déroule un membre du zip en FLUX, ligne par ligne.
 *
 * `unzip -p` évite d'écrire sur disque un `stop_times.txt` d'un gigaoctet, et
 * `onRow` peut renvoyer `false` pour couper la lecture dès qu'on a ce qu'il
 * faut.
 */
async function readMember(zipPath, member, onRow) {
  const child = spawn("unzip", ["-p", zipPath, member], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let header = null;
  try {
    for await (const line of rl) {
      if (line.trim() === "") continue;
      if (header === null) {
        header = parseHeader(line);
        continue;
      }
      const cells = parseCsvLine(line);
      const row = {};
      for (let i = 0; i < header.length; i += 1) row[header[i]] = cells[i] ?? "";
      if (onRow(row) === false) break;
    }
  } catch {
    // Membre absent du zip : `unzip` ferme le tuyau. Un GTFS sans `shapes.txt`
    // est légal, ce n'est pas une erreur de traitement.
  } finally {
    rl.close();
    child.stdout.destroy();
    child.kill("SIGKILL");
  }
}

/* ── Normalisations ──────────────────────────────────────────────────────── */

/**
 * `route_type` vers un mode lisible.
 *
 * Les valeurs étendues (extended route types) sont acceptées : plusieurs
 * réseaux les emploient pour distinguer un tram d'un tram-train ou un métro
 * d'un métro léger, et les ignorer ferait disparaître des lignes bien réelles.
 */
export function modeDeRouteType(routeType) {
  const t = Number.parseInt(String(routeType), 10);
  if (!Number.isFinite(t)) return null;
  if (t === 0 || (t >= 900 && t <= 906)) return "tram";
  if (t === 1 || (t >= 400 && t <= 405)) return "metro";
  if (t === 7 || t === 1400) return "funiculaire";
  return null;
}

/** Luminance relative, pour décider si un texte reste lisible sur ce fond. */
function luminance(hex) {
  const v = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * `route_color` vers `#rrggbb`.
 *
 * Le GTFS l'écrit sans croisillon, parfois vide, parfois `FFFFFF` : du blanc
 * sur un fond de carte clair, c'est une ligne invisible. On préfère un repli
 * assumé à une couleur qui ment.
 */
export function normaliserCouleur(brut, mode) {
  const hex = String(brut ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return COULEUR_DEFAUT[mode];
  const couleur = `#${hex.toLowerCase()}`;
  return luminance(couleur) > 0.88 ? COULEUR_DEFAUT[mode] : couleur;
}

/**
 * Couleur du numéro dans la pastille.
 *
 * Celle déclarée si elle contraste avec le fond, sinon noir ou blanc. Certains
 * réseaux laissent `route_text_color` vide ou identique à `route_color` : le
 * numéro disparaîtrait dans sa propre pastille.
 */
export function normaliserCouleurTexte(brut, fond) {
  const hex = String(brut ?? "").trim().replace(/^#/, "");
  const auto = luminance(fond) > 0.42 ? "#111111" : "#ffffff";
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return auto;
  const couleur = `#${hex.toLowerCase()}`;
  return Math.abs(luminance(couleur) - luminance(fond)) < 0.2 ? auto : couleur;
}

/**
 * Numéro affiché.
 *
 * Tous les GTFS ne renseignent pas `route_short_name` ; le nom long prend
 * alors le relais, tronqué pour rester tenable dans une pastille.
 */
export function referenceLigne(shortName, longName) {
  const court = String(shortName ?? "").trim();
  if (court !== "") return court.slice(0, 5);
  return String(longName ?? "").trim().slice(0, 5) || "?";
}

/* ── Simplification, reprise de contours-territoires.mjs ─────────────────── */

function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy));
}

/** Douglas-Peucker, itératif : une forme de tram compte des milliers de points
 *  et la version récursive fait exploser la pile. */
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
  return [
    Number(point[0].toFixed(PRECISION)),
    Number(point[1].toFixed(PRECISION)),
  ];
}

/** L'arrondi peut coller deux points voisins : on les fusionne, sinon le
 *  GeoJSON transporte des segments de longueur nulle. */
function simplifierTrace(points) {
  const out = [];
  for (const p of simplifyLine(points, TOLERANCE).map(round)) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  return out;
}

/** Longueur en degrés. Suffisante pour COMPARER deux variantes d'une même
 *  ligne, ce qui est son seul usage ici. */
function longueur(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
  }
  return total;
}


/* ── Sélection des jeux de données ───────────────────────────────────────── */

/**
 * Titre de jeu vers nom d'usage du réseau.
 *
 * L'API préfixe le nom commercial d'une formule administrative (« Réseau
 * urbain », « Réseaux urbains et interurbains de la… ») que personne ne lit.
 * On la retire mot à mot plutôt qu'avec une expression unique : les
 * combinaisons sont trop nombreuses pour être énumérées, et une expression
 * gourmande mangerait le nom lui-même sur « Réseau urbain STAR ».
 */
const MOTS_ADMINISTRATIFS = new Set([
  "urbain", "urbains", "interurbain", "interurbains", "périurbain",
  "périurbains", "suburbain", "suburbains", "scolaire", "scolaires",
  "et", "de", "du", "des", "la", "le", "les", "d",
]);

export function nomReseau(titre) {
  const brut = String(titre ?? "").trim();
  if (!/^Réseaux?\b/i.test(brut)) return brut;
  const mots = brut.split(/\s+/).slice(1);
  while (mots.length > 1) {
    // « d'Île-de-France » : l'élision colle le mot vide au nom. On coupe sur
    // l'apostrophe, et le reste doit RETOURNER dans la liste, sans quoi la
    // boucle réexamine indéfiniment le même mot.
    const coupe = mots[0].match(/^([^'’]*)['’](.+)$/);
    const tete = (coupe ? coupe[1] : mots[0]).toLowerCase();
    if (!MOTS_ADMINISTRATIFS.has(tete)) break;
    mots.shift();
    if (coupe) mots.unshift(coupe[2]);
  }
  return mots.join(" ").trim() || brut;
}

/**
 * Clé d'identité d'un réseau, insensible à la casse et aux accents.
 *
 * Mulhouse publie « Solea » et « Soléa », Le Mans publie « SETRAM » deux fois :
 * sans cette clé, chaque ligne concernée serait dessinée en double, avec deux
 * pastilles superposées et deux fois le poids.
 */
export function cleReseau(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Une entrée par ressource GTFS d'un jeu dont AU MOINS UNE ressource annonce
 * du tram, du métro ou du funiculaire.
 *
 * L'union des modes se calcule à l'échelle du JEU parce que le champ est
 * parfois vide sur la ressource à jour et renseigné sur une ressource périmée
 * du même jeu. La ressource retenue, elle, est choisie en préférant celle qui
 * annonce elle-même un mode utile : plusieurs autorités publient un flux
 * « tram » et un flux « bus » côte à côte, et le plus récent des deux est
 * souvent le second.
 */
export function choisirRessources(datasets) {
  const out = [];
  for (const jeu of datasets) {
    const licence = LICENCES_OUVERTES.get(jeu.licence);
    if (!licence) continue;
    if (JEUX_ECARTES.test(jeu.title ?? "")) continue;

    const gtfs = (jeu.resources ?? []).filter(
      (r) => String(r.format ?? "").toLowerCase() === "gtfs",
    );
    if (gtfs.length === 0) continue;

    const modes = new Set(gtfs.flatMap((r) => r.modes ?? []));
    if (![...modes].some((m) => MODES_UTILES.has(m))) continue;

    const utile = (r) => ((r.modes ?? []).some((m) => MODES_UTILES.has(m)) ? 1 : 0);
    const choisie = gtfs
      .filter((r) => r.is_available !== false)
      .sort(
        (a, b) =>
          utile(b) - utile(a) ||
          String(b.updated ?? "").localeCompare(String(a.updated ?? "")),
      )[0];
    if (!choisie) continue;

    const reseau = nomReseau(jeu.title);
    out.push({
      reseau,
      cle: cleReseau(reseau),
      licence,
      url: choisie.url,
      id: choisie.id,
      maj: String(choisie.updated ?? ""),
    });
  }
  // Le plus récent d'abord : la déduplication garde alors la publication la
  // plus fraîche de chaque ligne.
  return out.sort((a, b) => b.maj.localeCompare(a.maj));
}

/* ── Extraction d'un réseau ──────────────────────────────────────────────── */

/**
 * Deux tracés d'une même ligne se ressemblent-ils au point d'être le même ?
 *
 * L'aller et le retour d'un tram sont deux `shape_id` distincts qui suivent la
 * même rue à cinq mètres près. Les dessiner tous les deux double le poids du
 * fichier ET superpose deux pastilles de numéro au même endroit. On les
 * reconnaît à leurs extrémités : rapprochées à moins de 0,005° (≈ 500 m), et
 * indifférentes au sens de parcours.
 */
function memesExtremites(a, b) {
  const bornes = (pts) =>
    [pts[0], pts[pts.length - 1]].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const [a1, a2] = bornes(a);
  const [b1, b2] = bornes(b);
  const proche = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.005;
  return proche(a1, b1) && proche(a2, b2);
}

async function extraireReseau(zipPath, meta) {
  /* 1. Les lignes qui nous intéressent. */
  const routes = new Map();
  await readMember(zipPath, "routes.txt", (r) => {
    const mode = modeDeRouteType(r.route_type);
    if (!mode) return;
    const couleur = normaliserCouleur(r.route_color, mode);
    routes.set(r.route_id, {
      mode,
      couleur,
      couleurTexte: normaliserCouleurTexte(r.route_text_color, couleur),
      ref: referenceLigne(r.route_short_name, r.route_long_name),
      nom: String(r.route_long_name || r.route_short_name || "").trim(),
    });
  });
  if (routes.size === 0) return null;

  /* 2. Les voyages, groupés par ligne ET par sens.
   *
   *    `formes` retient un voyage par `shape_id` : c'est lui qui servira à
   *    retrouver les arrêts. `sansForme` retient TOUS les voyages des sens
   *    dépourvus de tracé, parce qu'un GTFS sans `shapes.txt` est parfaitement
   *    légal et que c'est le cas de plusieurs réseaux de tram français. */
  const formes = new Map();
  const sensDeVoyage = new Map();
  await readMember(zipPath, "trips.txt", (t) => {
    if (!routes.has(t.route_id)) return;
    const cle = `${t.route_id} ${t.direction_id ?? ""}`;
    if (t.shape_id) {
      let bucket = formes.get(cle);
      if (!bucket) {
        bucket = new Map();
        formes.set(cle, bucket);
      }
      if (!bucket.has(t.shape_id)) bucket.set(t.shape_id, t.trip_id);
    } else {
      sensDeVoyage.set(t.trip_id, cle);
    }
  });
  if (formes.size === 0 && sensDeVoyage.size === 0) return null;

  /* 3. Les points de forme, pour les seules formes candidates. */
  const voulues = new Set();
  for (const bucket of formes.values()) for (const s of bucket.keys()) voulues.add(s);
  const traces = new Map();
  await readMember(zipPath, "shapes.txt", (s) => {
    if (!voulues.has(s.shape_id)) return;
    const lon = Number.parseFloat(s.shape_pt_lon);
    const lat = Number.parseFloat(s.shape_pt_lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    let pts = traces.get(s.shape_id);
    if (!pts) {
      pts = [];
      traces.set(s.shape_id, pts);
    }
    pts.push([Number.parseInt(s.shape_pt_sequence, 10) || pts.length, lon, lat]);
  });

  /* 4. Un tracé par sens : la forme la plus longue. */
  const parSens = new Map();
  for (const [cle, bucket] of formes) {
    let meilleur = null;
    for (const [shapeId, tripId] of bucket) {
      const brut = traces.get(shapeId);
      if (!brut || brut.length < 2) continue;
      brut.sort((a, b) => a[0] - b[0]);
      const pts = simplifierTrace(brut.map((p) => [p[1], p[2]]));
      if (pts.length < 2) continue;
      const l = longueur(pts);
      if (!meilleur || l > meilleur.l) meilleur = { l, pts, tripId, source: "shapes" };
    }
    if (meilleur) parSens.set(cle, meilleur);
    else for (const tripId of bucket.values()) sensDeVoyage.set(tripId, cle);
  }

  /* 5. Un seul passage sur `stop_times.txt`, le plus gros fichier d'un GTFS :
   *    lu en flux, il sert à la fois aux arrêts des sens déjà tracés et à la
   *    reconstitution des sens qui n'ont pas de forme. */
  const voyagesRetenus = new Map();
  for (const [cle, m] of parSens) voyagesRetenus.set(m.tripId, cle);
  const sequences = new Map();
  await readMember(zipPath, "stop_times.txt", (st) => {
    const cle = voyagesRetenus.has(st.trip_id)
      ? voyagesRetenus.get(st.trip_id)
      : sensDeVoyage.get(st.trip_id);
    if (cle === undefined) return;
    let seq = sequences.get(st.trip_id);
    if (!seq) {
      seq = [];
      sequences.set(st.trip_id, seq);
    }
    seq.push([Number.parseInt(st.stop_sequence, 10) || seq.length, st.stop_id]);
  });

  /* 6. Les sens sans forme prennent la desserte la plus complète : le voyage
   *    qui compte le plus d'arrêts. Le tracé obtenu joint les arrêts en ligne
   *    droite — c'est une approximation, signalée par `trace: "arrets"`, et
   *    c'est tout ce que le GTFS contient dans ce cas. */
  const meilleurVoyage = new Map();
  for (const [tripId, cle] of sensDeVoyage) {
    const n = sequences.get(tripId)?.length ?? 0;
    if (n < 2) continue;
    const actuel = meilleurVoyage.get(cle);
    if (!actuel || n > actuel.n) meilleurVoyage.set(cle, { tripId, n });
  }

  /* 7. Les arrêts référencés, une fois les voyages représentatifs connus. */
  for (const [cle, v] of meilleurVoyage) voyagesRetenus.set(v.tripId, cle);
  const stopsVoulus = new Set();
  for (const tripId of voyagesRetenus.keys()) {
    for (const [, stopId] of sequences.get(tripId) ?? []) stopsVoulus.add(stopId);
  }
  const stops = new Map();
  await readMember(zipPath, "stops.txt", (s) => {
    if (!stopsVoulus.has(s.stop_id)) return;
    const lon = Number.parseFloat(s.stop_lon);
    const lat = Number.parseFloat(s.stop_lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    stops.set(s.stop_id, { nom: String(s.stop_name ?? "").trim(), lon, lat });
  });

  for (const [cle, v] of meilleurVoyage) {
    const ordonnee = [...(sequences.get(v.tripId) ?? [])].sort((a, b) => a[0] - b[0]);
    const pts = simplifierTrace(
      ordonnee
        .map(([, id]) => stops.get(id))
        .filter((s) => s !== undefined)
        .map((s) => [s.lon, s.lat]),
    );
    if (pts.length < 2) continue;
    parSens.set(cle, { l: longueur(pts), pts, tripId: v.tripId, source: "arrets" });
  }

  /* 8. Les tracés, un aller et un retour fusionnés en un seul. */
  const parLigne = new Map();
  for (const [cle, m] of parSens) {
    const routeId = cle.split(" ")[0];
    let liste = parLigne.get(routeId);
    if (!liste) {
      liste = [];
      parLigne.set(routeId, liste);
    }
    const jumeau = liste.find((autre) => memesExtremites(autre.pts, m.pts));
    if (!jumeau) liste.push(m);
    else if (m.l > jumeau.l) liste[liste.indexOf(jumeau)] = m;
  }

  const lignes = [];
  const routeDeVoyage = new Map();
  for (const [routeId, liste] of parLigne) {
    const route = routes.get(routeId);
    if (!route) continue;
    for (const m of liste) {
      routeDeVoyage.set(m.tripId, routeId);
      lignes.push({
        type: "Feature",
        properties: {
          reseau: meta.reseau,
          ref: route.ref,
          mode: route.mode,
          couleur: route.couleur,
          couleurTexte: route.couleurTexte,
          nom: route.nom,
          licence: meta.licence,
          trace: m.source,
        },
        geometry: { type: "LineString", coordinates: m.pts },
      });
    }
  }
  if (lignes.length === 0) return null;

  /* 9. Les arrêts. Un arrêt de tram, c'est deux quais, donc deux `stop_id` à
   *    dix mètres l'un de l'autre. On regroupe sur le nom ET la position
   *    arrondie au centième de degré : le nom seul fusionnerait deux « Gare »
   *    distantes de trois villes. */
  const groupes = new Map();
  for (const [tripId, routeId] of routeDeVoyage) {
    for (const [, stopId] of sequences.get(tripId) ?? []) {
      const s = stops.get(stopId);
      if (!s) continue;
      const cle = `${s.nom} ${s.lon.toFixed(2)} ${s.lat.toFixed(2)}`;
      let g = groupes.get(cle);
      if (!g) {
        g = { nom: s.nom, lon: 0, lat: 0, n: 0, routes: new Set() };
        groupes.set(cle, g);
      }
      if (!g.routes.has(routeId)) {
        g.lon += s.lon;
        g.lat += s.lat;
        g.n += 1;
      }
      g.routes.add(routeId);
    }
  }

  const arrets = [];
  for (const g of groupes.values()) {
    const desservantes = [...g.routes]
      .map((id) => routes.get(id))
      .filter((r) => r !== undefined);
    const principal = desservantes[0];
    if (!principal || g.n === 0) continue;
    arrets.push({
      type: "Feature",
      properties: {
        reseau: meta.reseau,
        nom: g.nom,
        // Un arrêt desservi par un métro se dessine comme un point de métro,
        // même si un tram y passe aussi : c'est le mode le plus structurant.
        mode: desservantes.some((r) => r.mode === "metro") ? "metro" : principal.mode,
        couleur: principal.couleur,
        lignes: [...new Set(desservantes.map((r) => r.ref))].sort().join(" "),
        licence: meta.licence,
      },
      geometry: { type: "Point", coordinates: round([g.lon / g.n, g.lat / g.n]) },
    });
  }

  return { lignes, arrets };
}

/* ── Programme ───────────────────────────────────────────────────────────── */

async function main() {
  const datasets = await fetch(API).then((r) => r.json());
  const cibles = choisirRessources(datasets);
  process.stderr.write(`${cibles.length} jeux candidats\n`);

  const dir = await mkdtemp(path.join(tmpdir(), "gtfs-"));
  const lignes = [];
  const arrets = [];
  const reseaux = [];
  const licences = new Set();
  // Deux autorités publient parfois le même réseau. La clé porte le réseau, le
  // mode et le numéro : deux lignes différentes ne se marchent jamais dessus,
  // deux publications de la même ligne, si.
  const vuesLignes = new Set();
  const vusArrets = new Set();

  for (const cible of cibles) {
    const zipPath = path.join(dir, `${cible.id}.zip`);
    try {
      const res = await fetch(cible.url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));
    } catch (error) {
      process.stderr.write(`  ${cible.reseau} : téléchargement impossible (${String(error)})\n`);
      continue;
    }

    let extrait = null;
    try {
      extrait = await extraireReseau(zipPath, cible);
    } catch (error) {
      process.stderr.write(`  ${cible.reseau} : illisible (${String(error)})\n`);
    }
    await rm(zipPath, { force: true });
    if (!extrait) continue;

    let retenues = 0;
    for (const f of extrait.lignes) {
      const cle = `${cible.cle} ${f.properties.mode} ${f.properties.ref}`;
      if (vuesLignes.has(cle)) continue;
      vuesLignes.add(cle);
      lignes.push(f);
      retenues += 1;
    }
    let arretsRetenus = 0;
    for (const f of extrait.arrets) {
      const [lon, lat] = f.geometry.coordinates;
      const cle = `${cible.cle} ${f.properties.nom} ${lon.toFixed(2)} ${lat.toFixed(2)}`;
      if (vusArrets.has(cle)) continue;
      vusArrets.add(cle);
      arrets.push(f);
      arretsRetenus += 1;
    }
    if (retenues === 0) continue;

    reseaux.push({ nom: cible.reseau, lignes: retenues });
    licences.add(cible.licence);
    process.stderr.write(
      `  ${cible.reseau} : ${retenues} tracés, ${arretsRetenus} arrêts, ${cible.licence}\n`,
    );
  }
  await rm(dir, { recursive: true, force: true });

  const attribution =
    "Lignes, numéros et couleurs officielles : GTFS des exploitants publiés " +
    `sur transport.data.gouv.fr (${[...licences].sort().join(", ")})`;

  const out = path.join(process.cwd(), "public/geo");
  await mkdir(out, { recursive: true });
  const ecrire = async (nom, features) => {
    const body = JSON.stringify({ type: "FeatureCollection", attribution, features });
    await writeFile(path.join(out, nom), body, "utf8");
    return body.length;
  };

  const tailleLignes = await ecrire("transports-lignes.geojson", lignes);
  const tailleArrets = await ecrire("transports-arrets.geojson", arrets);

  process.stderr.write(
    `\n${reseaux.length} réseaux, ${lignes.length} tracés, ${arrets.length} arrêts\n` +
      `lignes ${(tailleLignes / 1024).toFixed(0)} ko, ` +
      `arrêts ${(tailleArrets / 1024).toFixed(0)} ko, ` +
      `total ${((tailleLignes + tailleArrets) / 1024 / 1024).toFixed(2)} Mo\n`,
  );
}

// Lancé en ligne de commande seulement : les fonctions pures ci-dessus sont
// exportées, et un simple `import` ne doit pas déclencher deux gigaoctets de
// téléchargements.
if (process.argv[1]?.endsWith("agreger-transports.mjs")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
