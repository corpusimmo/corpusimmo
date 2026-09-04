/**
 * Tracés PRÉCIS et COLORÉS des lignes de tram, métro et funiculaire de France.
 *
 * ── LICENCE, ET POURQUOI LE FICHIER RESTE SÉPARÉ ───────────────────────────
 * La sortie `public/geo/transports-lignes-osm.geojson` est une base DÉRIVÉE
 * d'OpenStreetMap. Elle est donc publiée sous ODbL 1.0, avec l'attribution
 * « © les contributeurs OpenStreetMap », toutes deux écrites en clair dans les
 * propriétés de tête du fichier pour qu'aucune copie ne circule sans elles.
 *
 * Ce fichier ne doit JAMAIS être fusionné avec les données DVF. Au sens de
 * l'ODbL, deux bases posées côte à côte forment une base collective, et le
 * partage à l'identique ne contamine alors que la base dérivée — ici, ce seul
 * GeoJSON. Les fusionner en produirait une base dérivée unique, et placerait
 * DVF sous ODbL avec. D'où deux sources MapLibre distinctes, deux fichiers
 * distincts, et aucune jointure hors ligne entre les deux.
 *
 * ── POURQUOI OSM PLUTÔT QUE LE GTFS OU LES TUILES ──────────────────────────
 * Trois sources, chacune amputée d'une moitié :
 *   · les tuiles vectorielles du fond ont une géométrie de voie exacte, mais
 *     ne portent NI numéro de ligne NI couleur ;
 *   · les `shapes.txt` des GTFS portent la couleur officielle de l'exploitant,
 *     mais sont schématiques : mesuré sur le jeu déjà produit, 112 des 123
 *     lignes ont plus de 200 m entre deux points, médiane 344 m. C'est un
 *     tracé d'arrêt à arrêt, pas un tracé de voie, et c'est pourquoi
 *     `COARSE_LINE_LAYERS` le laisse éteint dans `transports-gtfs.ts` ;
 *   · les relations d'itinéraire OSM ont la géométrie exacte ET les tags `ref`
 *     et `colour`.
 *
 * On prend donc la géométrie d'OSM, et la couleur du GTFS quand elle existe :
 * `route_color` est renseignée par l'exploitant lui-même, là où `colour` est
 * contribuée à la main et dérive parfois de quelques pour cent. Nantes le
 * montre bien : OSM dit #00A754 pour la ligne 1, l'exploitant #007A45.
 *
 * ── PIÈGES RENCONTRÉS, à ne pas redécouvrir ────────────────────────────────
 *   · les membres `way` d'une relation ne sont PAS tous du tracé. Les rôles
 *     `platform` portent des emprises de quai ; les chaîner produit des
 *     crochets absurdes en travers de la voie. Seul le rôle VIDE est du tracé.
 *   · les ways arrivent dans le désordre et souvent inversés. Il faut les
 *     chaîner par extrémités, pas les concaténer.
 *   · une ligne a plusieurs relations : une par sens, plus les variantes de
 *     service (`state=alternate`). Sans dédoublonnage, chaque tram est peint
 *     deux à six fois.
 *   · le tag `network` n'est pas stable À L'INTÉRIEUR d'une agglomération :
 *     à Nantes la ligne 1 est taguée `TAN` et les lignes 2 et 3 `Naolib`. La
 *     clé de regroupement prend donc `operator` d'abord (SEMITAN partout),
 *     et un second passage rapproche ce qui porte le même numéro à moins de
 *     quinze kilomètres.
 *   · l'instance Overpass principale sature régulièrement et répond une page
 *     HTML, pas du JSON. D'où le repli sur le miroir Kumi.
 *
 *   node scripts/agreger-lignes-osm.mjs
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/* ── Réglages ────────────────────────────────────────────────────────────── */

/**
 * Les deux instances Overpass, dans l'ordre d'essai.
 *
 * Toutes deux sont gratuites, sans clé, et servent une communauté entière :
 * on les traite en invité. Une requête par lot, des pauses entre les lots, et
 * un `timeout` généreux annoncé dans la requête elle-même, ce qui vaut mieux
 * qu'un client qui abandonne et relance.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Pause entre deux lots. Rien ne presse : le script tourne une fois par an. */
const PAUSE_MS = 4000;

/**
 * La France découpée en six boîtes.
 *
 * Une requête unique sur la France entière fait tomber l'instance principale
 * en `timeout` avant même de commencer. Six lots passent, et un lot qui échoue
 * ne coûte que sa propre relance.
 *
 * L'outre-mer est absent : aucun tram, métro ni funiculaire n'y est cartographié
 * comme relation d'itinéraire, et six boîtes de plus pour zéro entité seraient
 * six requêtes offertes à personne.
 */
const BOITES = [
  [41.3, -5.2, 45.0, 1.0],
  [41.3, 1.0, 45.0, 4.5],
  [41.3, 4.5, 45.0, 9.7],
  [45.0, -5.2, 51.2, 1.0],
  [45.0, 1.0, 51.2, 4.5],
  [45.0, 4.5, 51.2, 9.7],
];

/** Modes retenus, tels qu'OSM les nomme dans le tag `route`. */
const ROUTES_OSM = ["tram", "subway", "light_rail", "funicular"];

/**
 * Vers le vocabulaire déjà employé par `transports-gtfs.ts`.
 *
 * `light_rail` rejoint le tram : en France c'est le tram-train, que personne
 * ne distingue du tram en regardant un plan de quartier.
 */
const MODES = {
  tram: "tram",
  light_rail: "tram",
  subway: "metro",
  funicular: "funiculaire",
};

/**
 * États qui décrivent une ligne qui n'existe pas encore.
 *
 * `alternate` est absent volontairement : c'est une variante de service d'une
 * ligne bien réelle, que le dédoublonnage se charge d'absorber.
 */
const ETATS_ECARTES = new Set(["proposed", "construction", "planned"]);

/**
 * Tolérance de Douglas-Peucker, en degrés.
 *
 * 0,00002° ≈ 2,2 m : aucun point du tracé publié ne s'écarte de plus de deux
 * mètres du tracé OSM. Volontairement FINE, contrairement aux contours
 * administratifs simplifiés au kilomètre : tout l'intérêt de ce fichier est sa
 * précision, un tracé lissé ne vaudrait pas mieux que le GTFS déjà écarté.
 *
 * Le réglage a été balayé plutôt que deviné : 5,5 m donne 207 ko pour un
 * espacement médian de 101 m, 2,2 m donne 310 ko pour 58 m, 1,1 m donne 421 ko
 * pour 38 m. Le budget étant de deux mégaoctets, on paie volontiers cent
 * kilooctets pour diviser l'espacement par deux ; en dessous, le gain visuel
 * disparaît sous l'épaisseur du trait.
 */
const TOLERANCE = 0.00002;

/** Cinq décimales ≈ 1,1 m, soit la moitié de la tolérance : sans perte utile. */
const PRECISION = 5;

/** Rayon de rapprochement d'une ligne OSM et d'une ligne GTFS, en mètres. */
const RAYON_APPARIEMENT = 40000;

/** Rayon de fusion de deux clés de réseau divergentes, en mètres. */
const RAYON_FUSION = 15000;

/** Teinte de repli, quand ni le GTFS ni OSM ne disent la couleur. */
const COULEUR_DEFAUT = "#6b7280";

const SORTIE = "public/geo/transports-lignes-osm.geojson";

/* ── Géométrie ───────────────────────────────────────────────────────────── */

/**
 * Distance en mètres, projection équirectangulaire locale.
 *
 * La haversine serait plus juste sur un arc de mille kilomètres ; ici on mesure
 * des segments de dix mètres, et le cosinus de la latitude suffit.
 */
function distance(a, b) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(lat) * 111320;
  const dy = (b[1] - a[1]) * 110540;
  return Math.hypot(dx, dy);
}

function longueur(parties) {
  let total = 0;
  for (const partie of parties) {
    for (let i = 1; i < partie.length; i += 1) {
      total += distance(partie[i - 1], partie[i]);
    }
  }
  return total;
}

/** Distance perpendiculaire d'un point au segment [a, b], en degrés. */
function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy));
}

/**
 * Douglas-Peucker, itératif.
 *
 * Repris de `contours-territoires.mjs`, et itératif pour la même raison : une
 * ligne de tram traversant une agglomération compte des milliers de points, et
 * la version récursive fait exploser la pile.
 */
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

/* ── Chaînage des membres ────────────────────────────────────────────────── */

/**
 * Clé d'extrémité.
 *
 * Deux ways qui se touchent partagent le MÊME nœud OSM, donc exactement les
 * mêmes coordonnées : une comparaison à sept décimales colle sans tolérance
 * floue, qui souderait par erreur deux voies parallèles distantes d'un mètre.
 */
function cle(point) {
  return `${point[0].toFixed(7)},${point[1].toFixed(7)}`;
}

/**
 * Assemble des tronçons épars en polylignes continues.
 *
 * Les membres arrivent dans le désordre et souvent inversés : on part d'un
 * tronçon, on étend par les deux bouts tant qu'un voisin partage une extrémité,
 * puis on recommence. Les morceaux qui restent disjoints sont normaux — une
 * ligne coupée par un tunnel non cartographié, ou une relation incomplète — et
 * donnent une `MultiLineString`.
 */
function chainer(troncons) {
  const utiles = troncons.filter((t) => t.length >= 2);
  const utilise = new Array(utiles.length).fill(false);

  // Index des extrémités : sans lui, une relation de deux cents membres se
  // parcourt en quarante mille comparaisons par extension.
  const index = new Map();
  utiles.forEach((t, i) => {
    for (const point of [t[0], t[t.length - 1]]) {
      const k = cle(point);
      const liste = index.get(k);
      if (liste) liste.push(i);
      else index.set(k, [i]);
    }
  });

  const voisin = (point) => {
    for (const i of index.get(cle(point)) ?? []) if (!utilise[i]) return i;
    return -1;
  };

  const parties = [];
  for (let depart = 0; depart < utiles.length; depart += 1) {
    if (utilise[depart]) continue;
    utilise[depart] = true;
    const chaine = [...utiles[depart]];

    // Extension par la fin, puis par le début. Le tronçon accroché est
    // retourné si besoin pour qu'il PARTE du bout de la chaîne.
    for (;;) {
      const bout = chaine[chaine.length - 1];
      const i = voisin(bout);
      if (i === -1) break;
      utilise[i] = true;
      const t = utiles[i];
      const aligne = cle(t[0]) === cle(bout) ? t : [...t].reverse();
      chaine.push(...aligne.slice(1));
    }
    for (;;) {
      const bout = chaine[0];
      const i = voisin(bout);
      if (i === -1) break;
      utilise[i] = true;
      const t = utiles[i];
      const aligne = cle(t[0]) === cle(bout) ? t : [...t].reverse();
      // `aligne` part du bout : on l'insère à l'envers, privé de ce bout.
      for (const point of aligne.slice(1)) chaine.unshift(point);
    }
    parties.push(chaine);
  }
  return parties;
}

/* ── Couleurs ────────────────────────────────────────────────────────────── */

/**
 * Ramène une couleur écrite à la main à `#rrggbb`.
 *
 * OSM accepte `#ABC`, `#AABBCC`, et aussi des noms CSS que nous ne traduisons
 * pas : mieux vaut le repli explicite qu'une teinte inventée.
 */
function normaliserCouleur(valeur) {
  if (typeof valeur !== "string") return null;
  const brut = valeur.trim().toLowerCase();
  const court = /^#?([0-9a-f]{3})$/.exec(brut);
  if (court) {
    const [r, g, b] = court[1];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const long = /^#?([0-9a-f]{6})$/.exec(brut);
  return long ? `#${long[1]}` : null;
}

/**
 * Noir ou blanc, selon ce qui se lit sur la couleur de fond.
 *
 * Luminance relative WCAG, et le seuil est le rapport de contraste, pas une
 * demi-luminance arbitraire : un jaune vif et un bleu sombre de même
 * demi-luminance n'appellent pas la même encre.
 *
 * Ce calcul n'est qu'un REPLI. Quand l'exploitant a publié son couple
 * `route_color` / `route_text_color`, c'est lui qui gagne : sur le rouge du
 * tram 2 de Nantes, le contraste WCAG donne le noir de justesse (4,83 contre
 * 4,35) alors que tous les plans du réseau, et le GTFS de l'exploitant,
 * disent blanc. Séparer les deux moitiés d'un couple choisi ensemble
 * produirait une pastille qui ne ressemble à aucune signalétique réelle.
 */
function couleurTexte(fond) {
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = canal(parseInt(fond.slice(1, 3), 16));
  const g = canal(parseInt(fond.slice(3, 5), 16));
  const b = canal(parseInt(fond.slice(5, 7), 16));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contraste contre le blanc, contre le noir : on garde le meilleur.
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
}

/* ── Identité de ligne ───────────────────────────────────────────────────── */

/** Un numéro de ligne s'écrit `T 1`, `t1` ou `T1` selon le contributeur. */
function normaliserRef(valeur) {
  return String(valeur ?? "")
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
}

/** Réseau, opérateur : même établissement écrit de dix façons. */
function normaliserNom(valeur) {
  return String(valeur ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/* ── France ─────────────────────────────────────────────────────────────── */

/**
 * Les six boîtes débordent largement, et c'est inévitable.
 *
 * Un rectangle qui contient Strasbourg contient Karlsruhe, un autre qui
 * contient Lille contient Bruxelles. Sans filtre, la sortie comptait 110
 * réseaux dont Barcelone, Zurich et la Rhein-Main-Verkehrsverbund. Découper la
 * requête sur `area["ISO3166-1"="FR"]` ferait porter tout le travail à
 * Overpass ; on filtre donc ici, sur les contours déjà présents dans
 * `public/geo/departements.geojson`, qui ne coûtent aucune requête.
 *
 * Le test porte sur le CENTRE de la ligne, pas sur ses extrémités : un tram
 * strasbourgeois qui termine à Kehl reste français, un tram bâlois qui effleure
 * Saint-Louis ne l'est pas. C'est le bon arbitrage pour une carte de prix
 * immobiliers français.
 */
async function chargerFrance() {
  const chemin = path.join(process.cwd(), "public/geo/departements.geojson");
  const data = JSON.parse(await readFile(chemin, "utf8"));
  return data.features.flatMap((f) => {
    const polygones =
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    return polygones.map((anneaux) => ({ boite: boiteDe(anneaux[0]), anneaux }));
  });
}

function boiteDe(anneau) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of anneau) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Lancer de rayon horizontal, la méthode la plus courte qui soit exacte. */
function dansAnneau([x, y], anneau) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i, i += 1) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dedans = !dedans;
    }
  }
  return dedans;
}

function enFrance(point, france) {
  for (const { boite, anneaux } of france) {
    // La boîte englobante écarte 95 des 96 départements en quatre comparaisons.
    if (
      point[0] < boite[0] ||
      point[0] > boite[2] ||
      point[1] < boite[1] ||
      point[1] > boite[3]
    ) {
      continue;
    }
    if (!dansAnneau(point, anneaux[0])) continue;
    // Les trous d'un département (enclave) ne sont jamais de l'étranger en
    // pratique, mais les traiter coûte trois lignes.
    if (anneaux.slice(1).some((trou) => dansAnneau(point, trou))) continue;
    return true;
  }
  return false;
}

/* ── Overpass ────────────────────────────────────────────────────────────── */

function requete([sud, ouest, nord, est]) {
  return (
    `[out:json][timeout:600];\n` +
    `relation["type"="route"]["route"~"^(${ROUTES_OSM.join("|")})$"]` +
    `(${sud},${ouest},${nord},${est});\n` +
    `out geom;\n`
  );
}

const dodo = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Un lot, avec repli sur le miroir et reprise progressive.
 *
 * Trois pièges cumulés, tous rencontrés :
 *   · sans `User-Agent` identifiable, overpass-api.de répond 406. Un script
 *     anonyme est indistinguable d'un aspirateur, et il est traité comme tel.
 *   · saturée, une instance répond 200 avec une PAGE HTML d'erreur : le code
 *     de statut ne suffit pas, il faut vérifier que le corps est du JSON.
 *   · un 429 dit « trop vite », pas « jamais ». On repasse donc plusieurs fois
 *     sur les deux instances, en attendant de plus en plus longtemps.
 */
const ENTETES = {
  "User-Agent": "CorpusImmo/1.0 (agregation lignes tram, contact via corpusimmo)",
};

const TENTATIVES = 4;

async function interroger(boite) {
  const body = new URLSearchParams({ data: requete(boite) });
  let derniere = null;
  for (let tour = 0; tour < TENTATIVES; tour += 1) {
    for (const endpoint of ENDPOINTS) {
      try {
        const reponse = await fetch(endpoint, {
          method: "POST",
          headers: ENTETES,
          body,
        });
        const texte = await reponse.text();
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        if (!texte.trimStart().startsWith("{")) {
          throw new Error("réponse non JSON (instance saturée)");
        }
        return JSON.parse(texte).elements ?? [];
      } catch (error) {
        derniere = error;
        process.stderr.write(`  ${endpoint} : ${String(error.message)}\n`);
        await dodo(PAUSE_MS * (tour + 1));
      }
    }
  }
  throw derniere ?? new Error("aucune instance Overpass n'a répondu");
}

/* ── Programme ───────────────────────────────────────────────────────────── */

/**
 * Index des couleurs officielles, lu dans la sortie GTFS déjà produite.
 *
 * L'appariement se fait sur le numéro, le mode et la PROXIMITÉ, pas sur le nom
 * du réseau : `network` côté OSM et `reseau` côté GTFS ne se ressemblent pas
 * toujours (Naolib contre TAN, TCL contre Keolis Lyon). Deux lignes portant le
 * même numéro dans le même mode à moins de quarante kilomètres sont la même.
 */
async function chargerCouleursGtfs() {
  const chemin = path.join(process.cwd(), "public/geo/transports-lignes.geojson");
  const data = JSON.parse(await readFile(chemin, "utf8"));
  return data.features.flatMap((f) => {
    const centre = centreDe(f.geometry);
    if (!centre) return [];
    return [
      {
        ref: normaliserRef(f.properties.ref),
        mode: f.properties.mode,
        couleur: normaliserCouleur(f.properties.couleur),
        // Retenue seulement si elle est franchement noire ou blanche : un
        // `route_text_color` doré sur violet existe dans le GTFS lyonnais, et
        // ne se lit pas à onze pixels.
        texte: ["#000000", "#ffffff"].includes(
          normaliserCouleur(f.properties.couleurTexte) ?? "",
        )
          ? normaliserCouleur(f.properties.couleurTexte)
          : null,
        centre,
      },
    ];
  });
}

/** Milieu de la boîte englobante : suffisant pour dire « c'est la même ville ». */
function centreDe(geometry) {
  const lignes =
    geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ligne of lignes) {
    for (const [x, y] of ligne) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Une relation Overpass en une entité candidate, ou `null` si elle ne dit rien
 * d'utilisable.
 */
function candidat(relation) {
  const tags = relation.tags ?? {};
  if (ETATS_ECARTES.has(tags.state)) return null;
  const mode = MODES[tags.route];
  if (!mode) return null;
  const ref = String(tags.ref ?? "").trim();
  // Sans numéro, la pastille n'aurait rien à afficher et le dédoublonnage
  // n'aurait pas de clé : une telle relation est inexploitable ici.
  if (!ref) return null;

  const troncons = (relation.members ?? [])
    .filter((m) => m.type === "way" && !m.role && Array.isArray(m.geometry))
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const parties = chainer(troncons).filter((p) => p.length >= 2);
  if (parties.length === 0) return null;

  const reseau = String(tags.network ?? tags.operator ?? "").trim();
  return {
    ref,
    mode,
    centre: centreDe({ type: "MultiLineString", coordinates: parties }),
    reseau: reseau || "Réseau non renseigné",
    // `operator` d'abord : c'est lui qui reste stable quand `network` change
    // d'une ligne à l'autre du même réseau.
    groupe: normaliserNom(tags.operator || tags.network),
    couleurOsm: normaliserCouleur(tags.colour ?? tags["route:colour"]),
    parties,
    metres: longueur(parties),
  };
}

/**
 * Une entité par ligne réelle.
 *
 * Deux passages, parce qu'une seule clé ne suffit pas : le premier garde la
 * plus longue par (groupe, ref, mode), le second recolle les groupes qui ne
 * divergent que par l'orthographe du réseau, en s'appuyant sur la géographie.
 */
function dedoublonner(candidats) {
  const parCle = new Map();
  for (const c of candidats) {
    const k = `${c.groupe}/${normaliserRef(c.ref)}/${c.mode}`;
    const garde = parCle.get(k);
    if (!garde || c.metres > garde.metres) parCle.set(k, c);
  }

  const retenus = [];
  for (const c of parCle.values()) {
    const proche = retenus.find(
      (r) =>
        r.mode === c.mode &&
        normaliserRef(r.ref) === normaliserRef(c.ref) &&
        distance(r.centre, c.centre) < RAYON_FUSION,
    );
    if (!proche) retenus.push({ ...c });
    else if (c.metres > proche.metres) Object.assign(proche, c);
  }
  return retenus;
}

async function main() {
  const gtfs = await chargerCouleursGtfs();
  const france = await chargerFrance();

  const relations = [];
  // Régler la simplification demande une dizaine de passages ; les refaire
  // contre Overpass reviendrait à taper soixante fois sur une instance
  // offerte par des bénévoles. `CORPUSIMMO_OSM_CACHE` pointe alors le JSON
  // brut d'un passage précédent. Non renseignée, on interroge normalement.
  const cache = process.env.CORPUSIMMO_OSM_CACHE;
  if (cache) {
    relations.push(...JSON.parse(await readFile(cache, "utf8")));
    process.stderr.write(`cache : ${relations.length} relations\n`);
  } else {
    for (const [i, boite] of BOITES.entries()) {
      process.stderr.write(`lot ${i + 1}/${BOITES.length} ${boite.join(",")}\n`);
      const elements = await interroger(boite);
      process.stderr.write(`  ${elements.length} relations\n`);
      relations.push(...elements);
      if (i < BOITES.length - 1) await dodo(PAUSE_MS);
    }
  }

  // Une relation à cheval sur deux boîtes revient deux fois.
  const uniques = new Map(relations.map((r) => [r.id, r]));
  const bruts = [...uniques.values()].flatMap((r) => candidat(r) ?? []);
  const candidats = bruts.filter((c) => enFrance(c.centre, france));
  const lignes = dedoublonner(candidats);
  process.stderr.write(
    `${bruts.length} relations exploitables, ${candidats.length} en France\n`,
  );

  let depuisGtfs = 0;
  const espacements = [];
  const features = lignes.map((ligne) => {
    const officielle = gtfs.find(
      (g) =>
        g.mode === ligne.mode &&
        g.ref === normaliserRef(ligne.ref) &&
        g.couleur &&
        distance(g.centre, ligne.centre) < RAYON_APPARIEMENT,
    );
    if (officielle) depuisGtfs += 1;
    const couleur = officielle?.couleur ?? ligne.couleurOsm ?? COULEUR_DEFAUT;

    const parties = ligne.parties
      .map((p) => simplifyLine(p, TOLERANCE).map(round))
      .filter((p) => p.length >= 2);
    for (const p of parties) {
      for (let i = 1; i < p.length; i += 1) espacements.push(distance(p[i - 1], p[i]));
    }

    return {
      type: "Feature",
      properties: {
        reseau: ligne.reseau,
        ref: ligne.ref,
        mode: ligne.mode,
        couleur,
        couleurTexte: officielle?.texte ?? couleurTexte(couleur),
        // D'où vient la teinte : le jour où une couleur détonne, on saura
        // s'il faut corriger OSM ou attendre le prochain GTFS.
        sourceCouleur: officielle ? "gtfs" : ligne.couleurOsm ? "osm" : "defaut",
      },
      geometry:
        parties.length === 1
          ? { type: "LineString", coordinates: parties[0] }
          : { type: "MultiLineString", coordinates: parties },
    };
  });

  features.sort(
    (a, b) =>
      a.properties.reseau.localeCompare(b.properties.reseau, "fr") ||
      a.properties.ref.localeCompare(b.properties.ref, "fr", { numeric: true }),
  );

  const sortie = {
    type: "FeatureCollection",
    // En tête et en clair : aucune copie de ce fichier ne doit circuler sans
    // sa licence ni son attribution.
    licence: "ODbL 1.0",
    attribution: "© les contributeurs OpenStreetMap",
    source: "Relations type=route d'OpenStreetMap, via Overpass",
    genere: new Date().toISOString().slice(0, 10),
    features,
  };

  const chemin = path.join(process.cwd(), SORTIE);
  await mkdir(path.dirname(chemin), { recursive: true });
  const corps = JSON.stringify(sortie);
  await writeFile(chemin, corps, "utf8");

  espacements.sort((a, b) => a - b);
  const mediane = espacements[Math.floor(espacements.length / 2)] ?? 0;
  const reseaux = new Set(features.map((f) => f.properties.reseau)).size;
  process.stderr.write(
    `${features.length} lignes, ${reseaux} réseaux, ` +
      `${(corps.length / 1024).toFixed(0)} ko, ` +
      `espacement médian ${mediane.toFixed(1)} m, ` +
      `${depuisGtfs} couleurs du GTFS sur ${features.length}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
