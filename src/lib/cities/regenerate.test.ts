/**
 * LE SCRIPT DE RÉGÉNÉRATION DU JEU DE DONNÉES DES PAGES VILLES.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SCRIPT EST UN FICHIER DE TEST
 * ────────────────────────────────────────────────────────────────────────────
 * Le dépôt n'exécute du TypeScript que d'une seule façon : par Vitest. Il n'y a
 * ni `tsx`, ni `ts-node`, et `node --experimental-strip-types` ne résout ni
 * l'alias `@/` ni les imports sans extension du dépôt. Ajouter une dépendance
 * pour lancer un script qui tourne deux fois par an, au rythme des publications
 * DVF, coûterait plus cher que cette bizarrerie assumée.
 *
 * Le garde est un drapeau d'environnement, pas un `skip` discret : sans lui,
 * `pnpm vitest run` passe devant sans télécharger un octet.
 *
 * (L'environnement reste celui du dépôt, jsdom : `vitest.setup.ts` touche
 * `window` dès le chargement et refuserait un environnement `node`. Rien ici
 * n'a besoin d'un DOM ; `fetch` et `node:fs` sont ceux de Node dans les deux
 * cas.)
 *
 *     CITIES_REGENERATE=1 pnpm vitest run src/lib/cities/regenerate.test.ts
 *
 * Variables reconnues :
 *     CITIES_REGENERATE=1   arme le script (obligatoire) ;
 *     CITIES_LIMIT=5        ne traite que les N premières communes (essai) ;
 *     CITIES_YEARS=2022-2025  restreint les millésimes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI DES AGRÉGATS PRÉ-CALCULÉS PLUTÔT QU'UN APPEL AU BUILD
 * ────────────────────────────────────────────────────────────────────────────
 * Le fournisseur DVF télécharge UN FICHIER CSV PAR COMMUNE ET PAR MILLÉSIME
 * (voir `src/lib/dvf/providers/geodvf.ts`) : 2,2 Mo pour Nantes, et il en faut
 * cinq par commune. Cent communes, c'est sept cents fichiers et près d'un
 * gigaoctet. Appeler ça au build signifierait : un build de plusieurs minutes,
 * un build qui ÉCHOUE quand data.gouv.fr est indisponible, et un site dont le
 * contenu change sans qu'aucun commit ne le montre.
 *
 * Les agrégats sont donc calculés ici, une fois, et VERSIONNÉS. Trois
 * conséquences, toutes voulues :
 *   · le build ne fait aucun appel réseau et ne peut pas échouer pour ça ;
 *   · un changement de chiffre affiché se lit dans un diff, se relit, se
 *     réverte ;
 *   · durcir un seuil éditorial ne demande PAS de retélécharger quoi que ce
 *     soit, puisque le fichier ne porte que des faits (voir `types.ts`).
 *
 * Le coût est assumé et il est unique : les chiffres ont l'âge de la dernière
 * régénération. La page l'affiche, à la date près.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { cityCommunes, type CityCommune } from "@/data/cities/communes";
import { parseGeoDvfCsv } from "@/lib/dvf/normalize";
import { departmentCodeFromInsee, expandPlmCommune } from "@/lib/geo/insee";
import type { DvfTransaction } from "@/types/dvf";

import { buildCityAggregate } from "./aggregate";
import { DATASET_PATH, DATASET_VERSION } from "./dataset";
import type { CityAggregate, CityDataset } from "./types";

const BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv";

/** Premier millésime publié en DVF géolocalisé. 2020 répond 404. */
const FIRST_YEAR = 2021;

/** Téléchargements simultanés. Poli avec data.gouv.fr, et déjà rapide. */
const CONCURRENCY = 8;

/** Tentatives par fichier : le réseau tombe, la régénération ne doit pas. */
const ATTEMPTS = 4;

const armed = process.env.CITIES_REGENERATE === "1";

describe.skipIf(!armed)("régénération des agrégats villes", () => {
  it(
    "télécharge DVF, calcule les agrégats et les écrit dans src/data/cities",
    async () => {
      const years = resolveYears();
      const communes = resolveCommunes();

      const cities: CityAggregate[] = [];
      let index = 0;
      for (const commune of communes) {
        index += 1;
        const aggregate = await buildOne(commune, years);
        cities.push(aggregate);
        report(
          `${String(index).padStart(3)}/${communes.length} ${commune.slug.padEnd(24)} ` +
            `${String(aggregate.dwellingSales).padStart(6)} ventes de logement`,
        );
      }

      const dataset: CityDataset = {
        version: DATASET_VERSION,
        generatedAt: new Date().toISOString().slice(0, 10),
        source: "geodvf",
        years,
        cities,
      };

      const target = join(process.cwd(), DATASET_PATH);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

      expect(dataset.cities.length).toBe(communes.length);
      report(`écrit : ${DATASET_PATH} (${dataset.cities.length} communes)`);
    },
    // Sept cents fichiers de quelques mégaoctets : la minute ne suffit pas.
    90 * 60 * 1000,
  );
});

/* -------------------------------------------------------------------------- */

async function buildOne(commune: CityCommune, years: number[]): Promise<CityAggregate> {
  // Paris, Lyon et Marseille n'ont pas de fichier : DVF publie un fichier par
  // arrondissement, et c'est aussi ce qui leur donne un découpage exact.
  const sourceCodes = [...expandPlmCommune(commune.insee)];

  const jobs: { code: string; year: number }[] = [];
  for (const code of sourceCodes) {
    for (const year of years) jobs.push({ code, year });
  }

  const transactions: DvfTransaction[] = [];
  let mutationsFound = 0;
  let mutationsKept = 0;

  await runWithConcurrency(jobs, CONCURRENCY, async (job) => {
    const csv = await fetchCommuneYear(job.code, job.year);
    if (csv === null) return;
    const { transactions: rows, report: normalization } = parseGeoDvfCsv(csv, {
      cityCode: job.code,
    });
    mutationsFound += normalization.mutations;
    mutationsKept += normalization.kept;
    for (const row of rows) transactions.push(row);
  });

  return buildCityAggregate({
    commune,
    sourceCodes,
    years,
    transactions,
    mutationsFound,
    mutationsKept,
  });
}

/** Le CSV d'une commune-millésime, ou `null` quand le fichier n'existe pas. */
async function fetchCommuneYear(cityCode: string, year: number): Promise<string | null> {
  const department = departmentCodeFromInsee(cityCode);
  if (!department) return null;
  const url = `${BASE_URL}/${year}/communes/${department}/${cityCode}.csv`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "text/csv" } });
      // 404 = aucune mutation publiée pour cette commune cette année-là. Ce
      // n'est pas une panne, c'est une information : on compte zéro.
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await pause(500 * attempt);
    }
  }
  throw new Error(`Téléchargement impossible : ${url} (${String(lastError)})`);
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function resolveYears(): number[] {
  const raw = process.env.CITIES_YEARS;
  const thisYear = new Date().getUTCFullYear();
  if (!raw) {
    // Le millésime en cours n'est jamais publié : DVF a six mois de retard.
    const last = thisYear - 1;
    return range(FIRST_YEAR, last);
  }
  const [from, to] = raw.split("-").map((value) => Number(value.trim()));
  if (!from || !to || from > to) throw new Error(`CITIES_YEARS illisible : ${raw}`);
  return range(Math.max(FIRST_YEAR, from), Math.min(thisYear, to));
}

function resolveCommunes(): CityCommune[] {
  const limit = Number(process.env.CITIES_LIMIT ?? "");
  return Number.isFinite(limit) && limit > 0 ? cityCommunes.slice(0, limit) : cityCommunes;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let year = from; year <= to; year += 1) out.push(year);
  return out;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function report(line: string): void {
  process.stdout.write(`${line}\n`);
}
