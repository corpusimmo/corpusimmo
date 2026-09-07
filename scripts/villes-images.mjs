/**
 * LES PHOTOGRAPHIES DE COMMUNE, PRISES CHEZ WIKIPÉDIA.
 *
 * Ce script tourne À LA MAIN, jamais au build, et écrit un fichier de données
 * relu ensuite comme n'importe quel autre. Trois raisons, et la première suffit.
 *
 * 1. UN BUILD NE DOIT PAS DÉPENDRE D'UN SERVEUR TIERS. Wikipédia répond bien,
 *    mais un déploiement qui échoue parce qu'une API met deux secondes de trop
 *    est un déploiement qu'on ne peut plus faire un vendredi soir.
 *
 * 2. LA LICENCE SE VÉRIFIE UNE FOIS, PAS À CHAQUE VISITE. Une image de
 *    Wikipédia n'est pas libre par défaut : certaines sont sous exception de
 *    courte citation, et celles-là ne peuvent pas être reprises. Le tri est
 *    fait ici, à froid, et le résultat est lisible dans le dépôt.
 *
 * 3. LE CRÉDIT EST UNE OBLIGATION, PAS UNE POLITESSE. Les licences Creative
 *    Commons exigent le nom de l'auteur, le nom de la licence et un lien vers
 *    elle. Les trois sont enregistrés avec l'image ; sans eux, on n'enregistre
 *    pas l'image du tout.
 *
 *   node scripts/villes-images.mjs            toutes les communes
 *   node scripts/villes-images.mjs nantes     une seule, pour vérifier
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const SORTIE = join(RACINE, "src/data/cities/images.json");

/**
 * Wikimedia demande un agent qui l'identifie et qui donne un moyen de contact.
 * Sans lui, l'API répond 403 après quelques appels, et le message d'erreur ne
 * dit pas pourquoi.
 */
const AGENT = "CorpusImmo/1.0 (https://corpus.immo; contact@corpus.immo)";

/**
 * LES LICENCES ACCEPTÉES, ET RIEN D'AUTRE.
 *
 * La liste est une liste BLANCHE, pas une liste noire : une licence inconnue
 * est refusée. C'est l'inverse du réflexe habituel, et c'est volontaire, parce
 * que le coût d'une erreur n'est pas symétrique. Une image manquante est un
 * espace vide ; une image reprise sans droit est une mise en demeure.
 */
const LICENCES_OK = [
  /^cc0/i,
  /^cc[ -]by(-sa)?[ -]?\d/i,
  /^public domain/i,
  /^pd([ -]|$)/i,
];

const licenceAcceptable = (nom) =>
  typeof nom === "string" && LICENCES_OK.some((r) => r.test(nom.trim()));

/** Le balisage HTML que Wikimedia met parfois dans le champ « auteur ». */
const texteSeul = (html) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

async function api(params) {
  const url = new URL("https://fr.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) {
    url.searchParams.set(k, String(v));
  }
  const reponse = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!reponse.ok) throw new Error(`Wikipédia a répondu ${reponse.status}`);
  return reponse.json();
}

/**
 * L'article d'une commune, trouvé par son NOM et son département.
 *
 * Le nom seul ne suffit pas : « Nice » est aussi un patronyme, et une bonne
 * douzaine de communes françaises partagent leur nom avec autre chose. On
 * demande donc l'article dont les coordonnées tombent près du centre connu de
 * la commune, ce qui tranche sans ambiguïté et sans liste d'exceptions.
 */
const RAYON_TERRE = 6371;

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE * Math.asin(Math.sqrt(h));
}

async function trouverArticle(commune) {
  /* LE TITRE D'ABORD, LA GÉOGRAPHIE ENSUITE, et jamais l'inverse.
     Une première version cherchait par coordonnées : à six kilomètres du
     centre de Nantes, l'article le plus proche était « Boulevard
     Gabriel-Lauriol ». La géographie sert à VÉRIFIER un titre, pas à le
     trouver. */
  const direct = await api({
    action: "query",
    titles: commune.name,
    prop: "coordinates",
    redirects: 1,
  });
  const page = direct?.query?.pages?.[0];
  const co = page?.coordinates?.[0];
  if (page && !page.missing && co) {
    const ecart = distanceKm(commune.center, { lat: co.lat, lng: co.lon });
    /* Vingt kilomètres : de quoi absorber l'écart entre le centre d'une
       commune étendue et le point que Wikipédia retient, sans laisser passer
       un homonyme situé à l'autre bout du pays. */
    if (ecart < 20) return page.title;
  }

  const geo = await api({
    action: "query",
    list: "geosearch",
    gscoord: `${commune.center.lat}|${commune.center.lng}`,
    gsradius: 10000,
    gslimit: 50,
    gsnamespace: 0,
  });
  const candidats = geo?.query?.geosearch ?? [];
  const exact = candidats.find((c) => c.title === commune.name);
  return exact?.title ?? null;
}

async function imageDeLArticle(titre) {
  /* `original` n'est pas toujours servi : selon la configuration de l'extension
     PageImages, seul `thumbnail` revient. On demande les deux et on prend ce
     qui vient, la vignette étant de toute façon assez large pour un bandeau. */
  const page = await api({
    action: "query",
    titles: titre,
    prop: "pageimages",
    piprop: "original|thumbnail|name",
    pithumbsize: 1600,
  });
  const p = page?.query?.pages?.[0];
  const source = p?.original?.source ?? p?.thumbnail?.source ?? null;
  if (!source && !p?.pageimage) return null;

  /* Le nom du fichier, pour aller chercher licence et auteur. Il est dans
     l'URL, encodé, et c'est le seul endroit fiable où le lire. */
  const fichier = p?.pageimage
    ? String(p.pageimage)
    : decodeURIComponent((source ?? "").split("/").pop() ?? "");
  const info = await api({
    action: "query",
    titles: `File:${fichier}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
  });
  const ii = info?.query?.pages?.[0]?.imageinfo?.[0];
  if (!ii) return null;

  const meta = ii.extmetadata ?? {};
  const licence = texteSeul(meta.LicenseShortName?.value);
  if (!licenceAcceptable(licence)) {
    return { refuse: licence || "licence inconnue" };
  }

  const auteur = texteSeul(meta.Artist?.value);
  if (!auteur) return { refuse: "auteur absent" };

  return {
    /* Les paramètres de suivi ajoutés par l'API n'ont rien à faire dans une
       URL servie au public : on ne garde que le chemin du fichier. */
    url: ii.url.split("?")[0],
    largeur: ii.width,
    hauteur: ii.height,
    auteur,
    licence,
    licenceUrl: texteSeul(meta.LicenseUrl?.value) || null,
    fichierUrl: ii.descriptionurl,
    article: `https://fr.wikipedia.org/wiki/${encodeURIComponent(titre.replace(/ /g, "_"))}`,
  };
}

/* ── Le passage ──────────────────────────────────────────────────────────── */

const source = readFileSync(join(RACINE, "src/data/cities/communes.ts"), "utf8");
const communes = [...source.matchAll(
  /slug: "([^"]+)",\s*\n\s*name: "([^"]+)",[\s\S]*?center: \{ lat: ([\d.-]+), lng: ([\d.-]+) \}/g,
)].map((m) => ({ slug: m[1], name: m[2], center: { lat: Number(m[3]), lng: Number(m[4]) } }));

const seul = process.argv[2];
const aFaire = seul ? communes.filter((c) => c.slug === seul) : communes;
if (aFaire.length === 0) {
  console.error(`Aucune commune pour « ${seul} ».`);
  process.exit(1);
}

let existant = {};
try {
  existant = JSON.parse(readFileSync(SORTIE, "utf8"));
} catch {
  // Premier passage : le fichier n'existe pas encore, et c'est normal.
}

const resultat = { ...existant };
let gardees = 0;
let refusees = 0;

for (const commune of aFaire) {
  try {
    const titre = await trouverArticle(commune);
    if (!titre) {
      console.log(`— ${commune.slug} : aucun article trouvé`);
      delete resultat[commune.slug];
      refusees += 1;
      continue;
    }
    const image = await imageDeLArticle(titre);
    if (!image) {
      console.log(`— ${commune.slug} : aucune image sur « ${titre} »`);
      delete resultat[commune.slug];
      refusees += 1;
    } else if (image.refuse) {
      console.log(`— ${commune.slug} : écartée, ${image.refuse}`);
      delete resultat[commune.slug];
      refusees += 1;
    } else {
      resultat[commune.slug] = image;
      gardees += 1;
      console.log(`✓ ${commune.slug} : ${image.licence}, ${image.auteur.slice(0, 40)}`);
    }
  } catch (erreur) {
    console.log(`— ${commune.slug} : ${erreur.message}`);
    refusees += 1;
  }
  /* Une pause entre deux appels. Wikimedia ne l'impose pas formellement, mais
     cent requêtes en rafale depuis une seule adresse est exactement ce que
     leur limitation guette. */
  await new Promise((r) => setTimeout(r, 220));
}

const ordonne = Object.fromEntries(Object.entries(resultat).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(SORTIE, JSON.stringify(ordonne, null, 2) + "\n");
console.log(`\n${gardees} gardée(s), ${refusees} écartée(s), ${Object.keys(ordonne).length} au total.`);
