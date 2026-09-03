/**
 * Agrège DVF au département et à la région, hors ligne.
 *
 * POURQUOI HORS LIGNE. Le fournisseur télécharge des CSV par COMMUNE : à
 * l'échelle de la France, il faudrait 34 000 fichiers pour calculer une
 * médiane. Aucune agrégation nationale n'est donc possible à la volée, et
 * colorier une région sur un échantillon tronqué reviendrait à inventer un
 * chiffre. Ce script fait le calcul une fois, sur les fichiers DÉPARTEMENTAUX,
 * et recrache quelques dizaines de kilo-octets que la carte peut servir.
 *
 * LA RÈGLE DE CALCUL est celle du reste du produit (`src/lib/dvf/normalize.ts`)
 * et pas une autre : une mutation s'étale sur PLUSIEURS lignes CSV — une par
 * local et par parcelle — avec `valeur_fonciere` répétée à l'identique. On
 * regroupe donc par `id_mutation`, on prend le prix UNE fois, et on somme les
 * surfaces bâties. Sommer les lignes sans regrouper gonflerait le
 * dénominateur et abaisserait artificiellement tous les prix au m².
 *
 * MÉDIANE, jamais moyenne : quelques ventes d'immeubles suffisent à emporter
 * une moyenne départementale.
 *
 *   node scripts/agreger-territoires.mjs
 */

import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Millésimes retenus. Trois ans : assez pour que la médiane d'un département
 * rural tienne debout, assez court pour parler du marché d'aujourd'hui.
 */
const YEARS = [2023, 2024, 2025];

const BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv";

/** Garde-fous sur le €/m². Larges : ils attrapent les accidents de saisie. */
const PPSM_MIN = 200;
const PPSM_MAX = 30_000;
/** Sous 9 m², ce n'est pas un logement. */
const MIN_AREA = 9;

/**
 * Effectif minimal pour publier une médiane.
 *
 * Le secret statistique (loi de 1951) et le décret du 28/12/2018 encadrent la
 * réutilisation de DVF : une valeur tirée de trois mutations revient à
 * republier ces mutations. Un territoire sous ce seuil reste sans couleur.
 */
const MIN_SALES = 50;

const TYPES = { Maison: "house", Appartement: "apartment" };

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/** Découpage qui respecte les guillemets : un nom de voie peut porter une virgule. */
function splitCsv(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

/* ── Lecture d'un département-année ──────────────────────────────────────── */

/** Renvoie une Map id_mutation → { prix, surface, types:Set }. */
async function readDepartmentYear(dep, year) {
  const url = `${BASE}/${year}/departements/${dep}.csv.gz`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const stream = Readable.fromWeb(response.body).pipe(createGunzip());
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  let cols = null;
  const mutations = new Map();

  for await (const line of lines) {
    if (!line) continue;
    if (!cols) {
      const header = splitCsv(line);
      cols = {
        id: header.indexOf("id_mutation"),
        prix: header.indexOf("valeur_fonciere"),
        type: header.indexOf("type_local"),
        surf: header.indexOf("surface_reelle_bati"),
      };
      continue;
    }
    const f = splitCsv(line);
    const family = TYPES[f[cols.type]];
    if (!family) continue;

    const prix = Number(f[cols.prix]);
    const surf = Number(f[cols.surf]);
    if (!Number.isFinite(prix) || prix <= 0) continue;
    if (!Number.isFinite(surf) || surf <= 0) continue;

    const id = f[cols.id];
    let m = mutations.get(id);
    if (!m) { m = { prix, surface: 0, types: new Set() }; mutations.set(id, m); }
    // `valeur_fonciere` est répétée sur chaque ligne : on la prend, pas on l'ajoute.
    m.prix = prix;
    m.surface += surf;
    m.types.add(family);
  }

  return mutations;
}

/* ── Statistiques ────────────────────────────────────────────────────────── */

function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function summarise(samples) {
  const all = [...samples.house, ...samples.apartment];
  if (all.length < MIN_SALES) return null;
  return {
    ppsm: median(all),
    count: all.length,
    house: samples.house.length >= MIN_SALES ? median(samples.house) : null,
    apartment:
      samples.apartment.length >= MIN_SALES ? median(samples.apartment) : null,
  };
}

/* ── Programme ───────────────────────────────────────────────────────────── */

async function main() {
  const meta = await fetch(
    "https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion",
  ).then((r) => r.json());
  const regionMeta = await fetch(
    "https://geo.api.gouv.fr/regions?fields=nom,code",
  ).then((r) => r.json());
  const regionName = new Map(regionMeta.map((r) => [r.code, r.nom]));

  const perDepartment = new Map();
  const perRegion = new Map();

  let done = 0;
  for (const dep of meta) {
    const samples = { house: [], apartment: [] };

    for (const year of YEARS) {
      const mutations = await readDepartmentYear(dep.code, year);
      if (!mutations) continue;
      for (const m of mutations.values()) {
        // Une mutation mêlant maison ET appartement est un lot composite :
        // son prix au m² ne se rattache à aucune des deux familles.
        if (m.types.size !== 1) continue;
        if (m.surface < MIN_AREA) continue;
        const ppsm = Math.round(m.prix / m.surface);
        if (ppsm < PPSM_MIN || ppsm > PPSM_MAX) continue;
        samples[[...m.types][0]].push(ppsm);
      }
    }

    const stats = summarise(samples);
    perDepartment.set(dep.code, {
      code: dep.code,
      nom: dep.nom,
      region: dep.codeRegion,
      ...(stats ?? { ppsm: null, count: samples.house.length + samples.apartment.length, house: null, apartment: null }),
    });

    let bucket = perRegion.get(dep.codeRegion);
    if (!bucket) { bucket = { house: [], apartment: [] }; perRegion.set(dep.codeRegion, bucket); }
    bucket.house.push(...samples.house);
    bucket.apartment.push(...samples.apartment);

    done += 1;
    process.stderr.write(`  ${done}/${meta.length} ${dep.code} ${dep.nom}\n`);
  }

  const regions = [...perRegion].map(([code, samples]) => {
    const stats = summarise(samples);
    return {
      code,
      nom: regionName.get(code) ?? code,
      ...(stats ?? { ppsm: null, count: 0, house: null, apartment: null }),
    };
  });

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    years: YEARS,
    minSales: MIN_SALES,
    source: "DVF géolocalisées (DGFiP / Etalab)",
    departements: [...perDepartment.values()].sort((a, b) => a.code.localeCompare(b.code)),
    regions: regions.sort((a, b) => a.code.localeCompare(b.code)),
  };

  const out = path.join(process.cwd(), "src/data/territoires.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stderr.write(`\nÉcrit ${out}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
