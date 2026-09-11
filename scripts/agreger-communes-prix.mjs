/**
 * LES MÉDIANES DVF PAR COMMUNE, hors ligne.
 *
 * POURQUOI. Le produit sait déjà agréger DVF au département et à la région
 * (`agreger-territoires.mjs`), et calcule à la volée ce qui tient dans une
 * vue. Ce qui manquait est l'échelon COMMUNE pour la France entière : sans
 * lui, impossible de croiser un prix de vente avec un loyer, qui est publié
 * commune par commune. C'est ce croisement que la couche « Rendement »
 * demande.
 *
 * MÊME RÈGLE DE CALCUL QUE PARTOUT AILLEURS. Une mutation s'étale sur
 * plusieurs lignes CSV — une par local et par parcelle — avec
 * `valeur_fonciere` répétée à l'identique. On regroupe par `id_mutation`, on
 * prend le prix UNE fois, on somme les surfaces bâties. Sommer les lignes
 * sans regrouper gonflerait le dénominateur et abaisserait tous les prix.
 *
 * UNE MUTATION MULTI-COMMUNES EST ÉCARTÉE. Elle existe (deux parcelles de
 * part et d'autre d'une limite) et on ne sait pas répartir son prix : la
 * compter dans les deux communes publierait deux fois la même vente.
 *
 * LE SEUIL D'EFFECTIF EST CELUI DU RESTE DU PRODUIT. Sous 30 ventes, la
 * commune n'a pas de médiane publiable : le secret statistique n'est pas une
 * gêne qu'on contourne, et une médiane tirée de cinq ventes revient à
 * republier ces cinq ventes. Le seuil est ici plus bas que les 50 des
 * territoires, parce qu'une commune est mille fois plus petite qu'un
 * département et qu'à 50 on effacerait la France rurale entière ; 30 est le
 * seuil que l'ANIL retient elle-même pour ses propres indicateurs.
 *
 *   node scripts/agreger-communes-prix.mjs
 */

import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Trois millésimes : assez pour qu'une commune moyenne atteigne le seuil. */
const YEARS = [2023, 2024, 2025];

const BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv";

const PPSM_MIN = 200;
const PPSM_MAX = 30_000;
const MIN_AREA = 9;
const MIN_SALES = 30;

const TYPES = { Maison: "house", Appartement: "apartment" };

function splitCsv(line) {
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

/**
 * Lit un département-année et verse les prix au m² dans `parCommune`.
 *
 * En flux : un département-année pèse plusieurs dizaines de méga-octets
 * décompressés, et il y en a près de trois cents. Rien n'est gardé en mémoire
 * au-delà des mutations du fichier courant.
 */
async function lireDepartementAnnee(dep, annee, parCommune) {
  const url = `${BASE}/${annee}/departements/${dep}.csv.gz`;
  const reponse = await fetch(url);
  if (!reponse.ok) return 0;

  const flux = Readable.fromWeb(reponse.body).pipe(createGunzip());
  const lignes = createInterface({ input: flux, crlfDelay: Infinity });

  let cols = null;
  const mutations = new Map();

  for await (const ligne of lignes) {
    if (!ligne) continue;
    if (!cols) {
      const entete = splitCsv(ligne);
      cols = {
        id: entete.indexOf("id_mutation"),
        prix: entete.indexOf("valeur_fonciere"),
        type: entete.indexOf("type_local"),
        surf: entete.indexOf("surface_reelle_bati"),
        commune: entete.indexOf("code_commune"),
      };
      for (const [nom, index] of Object.entries(cols)) {
        if (index === -1) throw new Error(`colonne ${nom} absente de ${url}`);
      }
      continue;
    }

    const f = splitCsv(ligne);
    const famille = TYPES[f[cols.type]];
    if (!famille) continue;

    const prix = Number(f[cols.prix]);
    const surf = Number(f[cols.surf]);
    if (!Number.isFinite(prix) || prix <= 0) continue;
    if (!Number.isFinite(surf) || surf <= 0) continue;

    const id = f[cols.id];
    let m = mutations.get(id);
    if (!m) {
      m = { prix, surface: 0, familles: new Set(), communes: new Set() };
      mutations.set(id, m);
    }
    m.prix = prix;
    m.surface += surf;
    m.familles.add(famille);
    m.communes.add(f[cols.commune]);
  }

  let retenues = 0;
  for (const m of mutations.values()) {
    // Un seul type et une seule commune : sinon on ne sait pas à qui
    // attribuer le prix, et répartir au prorata inventerait une donnée.
    if (m.familles.size !== 1 || m.communes.size !== 1) continue;
    if (m.surface < MIN_AREA) continue;
    const ppsm = m.prix / m.surface;
    if (ppsm < PPSM_MIN || ppsm > PPSM_MAX) continue;

    const code = [...m.communes][0];
    const famille = [...m.familles][0];
    let commune = parCommune.get(code);
    if (!commune) {
      commune = { house: [], apartment: [] };
      parCommune.set(code, commune);
    }
    commune[famille].push(ppsm);
    retenues += 1;
  }
  return retenues;
}

function mediane(valeurs) {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = tri.length >> 1;
  const v = tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
  return Math.round(v);
}

async function main() {
  const meta = await fetch(
    "https://geo.api.gouv.fr/departements?fields=code",
  ).then((r) => r.json());
  const departements = meta.map((d) => d.code);

  const parCommune = new Map();
  let total = 0;

  for (const dep of departements) {
    let duDep = 0;
    for (const annee of YEARS) {
      duDep += await lireDepartementAnnee(dep, annee, parCommune);
    }
    total += duDep;
    process.stderr.write(`  ${dep} : ${duDep} mutations retenues\n`);
  }

  const communes = {};
  let publiables = 0;
  for (const [code, echantillons] of [...parCommune.entries()].sort()) {
    const tous = [...echantillons.house, ...echantillons.apartment];
    if (tous.length < MIN_SALES) continue;
    publiables += 1;
    communes[code] = {
      ppsm: mediane(tous),
      n: tous.length,
      app:
        echantillons.apartment.length >= MIN_SALES
          ? mediane(echantillons.apartment)
          : null,
      nApp: echantillons.apartment.length,
      mai:
        echantillons.house.length >= MIN_SALES
          ? mediane(echantillons.house)
          : null,
      nMai: echantillons.house.length,
    };
  }

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "Demandes de Valeurs Foncières (DGFiP), via files.data.gouv.fr",
    annees: YEARS,
    seuil: MIN_SALES,
    precautions: [
      "Médiane du prix au m² des ventes de gré à gré d'un logement, regroupées par mutation.",
      "Une commune sous trente ventes sur trois ans n'a pas de médiane publiée : ni zéro, ni la valeur du voisin.",
      "Les mutations portant sur plusieurs communes ou plusieurs types de biens sont écartées : leur prix n'est pas répartissable.",
    ],
    communes,
  };

  const sortie = path.join(process.cwd(), "src/data/prix-communes.json");
  await mkdir(path.dirname(sortie), { recursive: true });
  await writeFile(sortie, `${JSON.stringify(payload)}\n`, "utf8");

  process.stderr.write(
    `\nÉcrit ${sortie}\n` +
      `  ${total} mutations retenues, ${parCommune.size} communes rencontrées, ` +
      `${publiables} au-dessus du seuil de ${MIN_SALES}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
