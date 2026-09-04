/**
 * L'INVENTAIRE DES ROUTES INDEXABLES, dressé par la machine et non par nous.
 *
 * POURQUOI PAS UNE LISTE ÉCRITE À LA MAIN
 *   Une liste recopiée est juste le jour où on l'écrit. Elle devient fausse à
 *   la page suivante, et son échec est SILENCIEUX : la page manquante ne
 *   provoque aucune erreur, elle disparaît simplement de l'index, et personne
 *   ne s'en aperçoit avant des mois. Ici, l'inventaire est lu dans les sources
 *   de vérité qui existent déjà :
 *
 *     · l'arborescence `src/app/**` dit quelles pages EXISTENT ;
 *     · l'export `metadata` de chaque page dit si elle est indexable ;
 *     · `src/data/tools-catalogue.ts` dit quelles fiches outils existent ;
 *     · `src/config/navigation.ts` dit ce qui est réellement disponible.
 *
 *   Une page ajoutée demain entre donc au sitemap sans que personne y pense, et
 *   une page marquée `noindex` en sort pour la même raison.
 *
 * POURQUOI LIRE LE FICHIER PLUTÔT QU'IMPORTER LA PAGE
 *   Importer `page.tsx` pour lire son `metadata.robots` serait plus direct, et
 *   inutilisable : `/outils/[slug]/calculer` lit des cookies via `next/headers`, ce qui casse hors du rendu d'une requête, et
 *   entraînerait tout l'arbre React dans le module du sitemap. On lit donc le
 *   TEXTE du fichier, ce qui suffit à répondre à la seule question posée : la
 *   page se déclare-t-elle hors index ?
 *
 * CE QUI TOURNE QUAND
 *   Tout ceci s'exécute au BUILD, jamais à la requête (`sitemap.ts` porte
 *   `dynamic = "force-static"`). C'est ce qui autorise `node:fs` : à l'exécution
 *   sur Vercel, `src/` n'est pas dans le bundle.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { mainNavFlat, type ModuleStatus } from "@/config/navigation";
import { toolCatalogue } from "@/data/tools-catalogue";

/** Racine de l'arbre de routes. `process.cwd()` est la racine du dépôt au build. */
const APP_DIR = join(process.cwd(), "src", "app");

const PAGE_FILENAMES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);

/**
 * Le repli quand un fichier n'a pas de date lisible. Figé au chargement du
 * module, donc identique pour toutes les entrées d'un même build : deux dates
 * différentes pour un même build seraient un mensonge de plus.
 */
const BUILD_TIME = new Date();

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SeoRoute {
  /** Chemin servi, sans domaine ni barre finale. « / » pour l'accueil. */
  path: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
}

export interface DiscoveredPage {
  /** Motif de route, segments dynamiques compris : « /outils/[slug] ». */
  pattern: string;
  /** Chemin absolu du `page.tsx` qui produit cette route. */
  file: string;
  /** La page se déclare-t-elle hors index dans son propre export `metadata` ? */
  noindex: boolean;
}

/* ------------------------------------------------------------ le blog, plus tard */

/**
 * POINT D'EXTENSION — LE BLOG.
 *
 * `src/lib/blog/` est en cours de livraison par ailleurs et exposera
 * `blogSitemapEntries()`. Tant que ce module n'existe pas, l'importer d'ici
 * casserait le build ; et laisser la découverte ramasser `/blog/[slug]` sans
 * savoir énumérer les articles produirait une URL littérale « /blog/[slug] »
 * dans le sitemap, ce qui est pire que rien.
 *
 * Le préfixe est donc écarté de la découverte, et le branchement se fait en un
 * seul endroit, dans `src/app/sitemap.ts`, à l'endroit signalé.
 */
const EXCLUDED_PREFIXES = ["/blog", "/prix-immobilier"] as const;

/* ------------------------------------------------------- paramètres dynamiques */

/**
 * Les valeurs des segments dynamiques, lues dans leur source de vérité.
 *
 * Un motif dynamique absent de cette table n'est PAS deviné : il est signalé
 * par `unresolvedDynamicPatterns()`, et le test du sitemap échoue. Une route
 * paramétrée nouvelle doit se voir, pas s'oublier.
 */
const DYNAMIC_PARAMS: Readonly<Record<string, readonly string[]>> = {
  "/outils/[slug]": toolCatalogue.map((tool) => tool.id),
};

/**
 * Les fichiers qui portent le CONTENU d'une route, en plus de son `page.tsx`.
 *
 * Une fiche outil ne change presque jamais dans son `page.tsx` : ce qui bouge,
 * c'est le catalogue éditorial et la spécification de l'outil. Dater la page
 * sur son seul gabarit annoncerait aux moteurs une page figée alors que son
 * texte vient d'être réécrit.
 */
const CONTENT_SOURCES: Readonly<Record<string, readonly string[]>> = {
  "/outils": ["src/data/tools-catalogue.ts", "src/lib/tools/definitions.ts"],
  "/outils/[slug]": ["src/data/tools-catalogue.ts", "src/lib/tools/definitions.ts"],
};

/* ------------------------------------------------------ politique par section */

interface SectionPolicy {
  changeFrequency: ChangeFrequency;
  priority: number;
}

/**
 * La cadence et le poids sont décidés par SECTION, jamais page par page.
 *
 * C'est ce qui rend l'inventaire automatique utile : une page ajoutée sous
 * `/outils` hérite de la cadence des outils sans qu'on ait à l'inscrire
 * quelque part. Et la cadence annoncée correspond à la réalité — la carte et
 * l'observatoire suivent les publications DVF, une fiche outil ne bouge qu'à
 * la révision d'un barème, une mention légale ne bouge pas.
 */
const SECTION_POLICIES: Readonly<Record<string, SectionPolicy>> = {
  // L'accueil, seule page de profondeur zéro.
  "": { changeFrequency: "weekly", priority: 1 },
  estimer: { changeFrequency: "monthly", priority: 0.9 },
  carte: { changeFrequency: "weekly", priority: 0.9 },
  observatoire: { changeFrequency: "weekly", priority: 0.8 },
  outils: { changeFrequency: "monthly", priority: 0.8 },
  // Conservée bien que les quatre pages « solutions » soient hors index
  // aujourd'hui : elles y reviendront le jour où l'offre ouvrira, et une
  // politique qu'il faut réinventer à ce moment-là ne sert à rien.
  solutions: { changeFrequency: "monthly", priority: 0.6 },
  "a-propos": { changeFrequency: "yearly", priority: 0.4 },
  // Les pages d'information légale. Elles doivent être indexées (une politique
  // de cookies introuvable est une politique de cookies inexistante) mais elles
  // ne se disputent aucune requête : priorité basse, cadence annuelle.
  "mentions-legales": { changeFrequency: "yearly", priority: 0.2 },
  confidentialite: { changeFrequency: "yearly", priority: 0.2 },
  cookies: { changeFrequency: "yearly", priority: 0.2 },
};

/** Une section inconnue entre quand même, sobrement. Mieux vaut 0,5 qu'absente. */
const DEFAULT_POLICY: SectionPolicy = { changeFrequency: "monthly", priority: 0.5 };

/**
 * `preview` veut dire « interface crédible, moteur non construit » (voir
 * `src/config/navigation.ts`). Donner à ces pages le même poids qu'à un outil
 * qui tourne reviendrait à dire aux moteurs l'inverse de ce que la page dit à
 * ses lecteurs, qui y lisent « Bientôt disponible ».
 */
const STATUS_PENALTY: Readonly<Record<ModuleStatus, number>> = {
  live: 0,
  beta: 0,
  preview: -0.1,
};

/* -------------------------------------------------------------- la découverte */

function collectPageFiles(dir: string, found: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPageFiles(full, found);
    } else if (PAGE_FILENAMES.has(entry.name)) {
      found.push(full);
    }
  }
}

/**
 * Le motif de route d'un fichier `page.tsx`.
 *
 * Les groupes de routes `(site)` et les segments parallèles `@slot` ne
 * produisent pas d'URL : ils disparaissent. Les segments dynamiques `[slug]`
 * sont conservés tels quels et résolus plus loin.
 */
function patternFromFile(file: string): string {
  const segments = relative(APP_DIR, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => segment.length > 0)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .filter((segment) => !segment.startsWith("@"));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/**
 * La page se déclare-t-elle hors index ?
 *
 * Le jeton cherché est `index: false`, sous les deux seules formes que le dépôt
 * emploie : `robots: { index: false, ... }` écrit à la main, et
 * `pageMetadata({ ..., index: false })`.
 *
 * LE PIÈGE, ET IL EST ASSUMÉ : écrire `index: false` n'importe où ailleurs dans
 * un `page.tsx` (une branche d'erreur d'un `generateMetadata`, par exemple)
 * sortirait la page de l'index sans rien casser. C'est précisément pour ça que
 * `src/app/sitemap.test.ts` fige la liste des pages hors index et vérifie que
 * les dix fiches outils sont présentes : le piège existe, mais il ne peut pas
 * passer inaperçu.
 *
 * L'analyse fine du module serait plus sûre et n'est pas envisageable :
 * `/outils/[slug]/calculer` lit des cookies par `next/headers`, donc ne
 * s'importe pas hors du rendu d'une requête.
 */
const NOINDEX_PATTERN = /\bindex\s*:\s*false\b/;

/**
 * Le source, commentaires retirés.
 *
 * Sans ça, une simple phrase de documentation citant `index: false` sortirait
 * la page de l'index. Ce n'est pas une hypothèse : c'est arrivé en écrivant ce
 * fichier, et le test du sitemap l'a attrapé.
 *
 * Le garde `[^:]` devant `//` protège les URL (`https://`), qui sont du code et
 * non des commentaires.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function declaresNoindex(file: string): boolean {
  try {
    return NOINDEX_PATTERN.test(stripComments(readFileSync(file, "utf8")));
  } catch {
    // Illisible : on préfère l'exclure. Une page absente de l'index se corrige ;
    // une page interdite qui s'y retrouve, beaucoup moins vite.
    return true;
  }
}

function isExcluded(pattern: string): boolean {
  return EXCLUDED_PREFIXES.some(
    (prefix) => pattern === prefix || pattern.startsWith(`${prefix}/`),
  );
}

/** Toutes les pages de l'arbre, indexables ou non, motifs dynamiques compris. */
export function discoverPages(): DiscoveredPage[] {
  const files: string[] = [];
  collectPageFiles(APP_DIR, files);

  return files
    .map((file) => ({
      pattern: patternFromFile(file),
      file,
      noindex: declaresNoindex(file),
    }))
    .filter((page) => !isExcluded(page.pattern))
    .sort((a, b) => a.pattern.localeCompare(b.pattern));
}

/**
 * Les motifs dynamiques que personne n'a appris à énumérer.
 *
 * Existe pour être asserté vide par le test : c'est le garde-fou qui empêche
 * une future route paramétrée de sortir de l'index sans bruit.
 */
export function unresolvedDynamicPatterns(): string[] {
  return discoverPages()
    .filter((page) => !page.noindex)
    .map((page) => page.pattern)
    .filter((pattern) => pattern.includes("[") && DYNAMIC_PARAMS[pattern] === undefined);
}

/** Les motifs que les pages elles-mêmes déclarent hors index. */
export function noindexPatterns(): string[] {
  return discoverPages()
    .filter((page) => page.noindex)
    .map((page) => page.pattern);
}

/* ------------------------------------------------------------ dates et poids */

function newestMtime(files: readonly string[]): Date {
  let newest = 0;
  for (const file of files) {
    try {
      const { mtimeMs } = statSync(file);
      if (mtimeMs > newest) newest = mtimeMs;
    } catch {
      // Source annoncée mais absente : elle ne date rien, elle ne casse rien.
    }
  }
  return newest > 0 ? new Date(newest) : BUILD_TIME;
}

function sectionOf(path: string): string {
  const [, first = ""] = path.split("/");
  return first;
}

function policyFor(path: string): SectionPolicy {
  return SECTION_POLICIES[sectionOf(path)] ?? DEFAULT_POLICY;
}

/**
 * Le statut affiché par la navigation pour ce chemin, ou à défaut celui de sa
 * section : une sous-page de `/solutions` est aussi « bientôt disponible » que
 * `/solutions` lui-même.
 */
function statusFor(path: string): ModuleStatus | undefined {
  const exact = mainNavFlat.find((item) => item.href === path)?.status;
  if (exact) return exact;
  const section = sectionOf(path);
  return section ? mainNavFlat.find((item) => item.href === `/${section}`)?.status : undefined;
}

function priorityFor(path: string, policy: SectionPolicy): number {
  const depth = path === "/" ? 0 : path.split("/").length - 1;
  const depthPenalty = Math.max(0, depth - 1) * 0.1;
  const status = statusFor(path);
  const raw = policy.priority + (status ? STATUS_PENALTY[status] : 0) - depthPenalty;

  // Une priorité est un rapport entre pages du même site, jamais une note
  // absolue : la borner évite qu'un cumul de pénalités la rende négative.
  return Math.round(Math.min(1, Math.max(0.1, raw)) * 10) / 10;
}

/* ------------------------------------------------------------- l'inventaire */

/**
 * Les routes réellement indexables, prêtes pour le sitemap.
 *
 * Une page sort de cette liste dès qu'elle se déclare `noindex` : c'est la
 * page qui décide, pas le sitemap. Les deux ne peuvent donc pas se contredire.
 */
export function indexableRoutes(): SeoRoute[] {
  const routes: SeoRoute[] = [];

  for (const page of discoverPages()) {
    if (page.noindex) continue;

    const sources = [
      page.file,
      ...(CONTENT_SOURCES[page.pattern] ?? []).map((relativePath) =>
        join(process.cwd(), relativePath),
      ),
    ];
    const lastModified = newestMtime(sources);

    const paths = page.pattern.includes("[")
      ? (DYNAMIC_PARAMS[page.pattern] ?? []).map((value) =>
          page.pattern.replace(/\[[^\]]+\]/, value),
        )
      : [page.pattern];

    for (const path of paths) {
      const policy = policyFor(path);
      routes.push({
        path,
        lastModified,
        changeFrequency: policy.changeFrequency,
        priority: priorityFor(path, policy),
      });
    }
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
