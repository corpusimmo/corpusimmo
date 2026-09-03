/**
 * Rapatrie la « carte des loyers » de l'ANIL, hors ligne, une fois par an.
 *
 * POURQUOI CE JEU DE DONNÉES. DVF dit à quel prix un logement s'est VENDU. Il
 * ne dit rien de ce qu'il rapporterait loué, et c'est pourtant la question que
 * pose tout acheteur qui n'habitera pas le bien. La « carte des loyers »
 * (DGALN / ANIL, avec leboncoin et le Groupe SeLoger) est la seule source
 * publique, nationale et communale qui approche ce chiffre. Croisée avec nos
 * médianes DVF, elle donne un rendement — et rien de plus qu'un rendement
 * BRUT, ce que `src/lib/loyers/rendement.ts` répète à chaque fonction.
 *
 * POURQUOI HORS LIGNE. Deux CSV de 4,7 Mo chacun, 34 900 communes, publiés une
 * fois l'an : les télécharger à la volée serait 9 Mo de trafic pour lire une
 * ligne. Ce script fait le voyage une fois et laisse un JSON que le produit
 * peut servir.
 *
 * ── CE QUE LA SOURCE MESURE, ET SURTOUT CE QU'ELLE NE MESURE PAS ───────────
 * Ce sont des loyers d'ANNONCE, pas des loyers constatés dans des baux. Trois
 * écarts systématiques avec ce qu'un bailleur encaisse vraiment, et aucun ne
 * joue dans le sens de la prudence :
 *
 *   · CHARGES COMPRISES. L'indicateur inclut les charges. Le loyer « hors
 *     charges » qui alimente un calcul de rendement est donc PLUS BAS que le
 *     chiffre publié ici, de l'ordre de 10 à 20 % selon le bien.
 *   · ANNONCE ≠ BAIL. Un prix affiché se négocie, et les biens qui se relouent
 *     sans annonce (donc souvent moins cher) sont absents du corpus.
 *   · VIDE, PAS MEUBLÉ. Les annonces retenues portent sur du non meublé.
 *
 * Le champ `echelle` porte la quatrième limite, la plus vicieuse : pour une
 * commune où aucune annonce n'est parue, la valeur publiée est celle d'une
 * MAILLE de communes voisines jugées semblables. C'est une estimation de
 * voisinage présentée dans la même colonne qu'une estimation locale. On la
 * conserve — elle vaut mieux que rien — mais on la NOMME, pour que l'affichage
 * puisse la traiter autrement.
 *
 * Les précautions d'emploi de l'ANIL invitent à se méfier quand R² < 0,5, quand
 * la commune compte moins de 30 observations, ou quand l'intervalle de
 * prédiction est très large. On stocke donc `r2`, `obs`, `bas` et `haut` :
 * conformément au principe tenu dans `src/lib/cities/types.ts`, le jeu de
 * données ne porte que des faits, et c'est le code de lecture qui refuse.
 *
 * ATTRIBUTION exigée par la licence, à reproduire partout où le chiffre est
 * montré : « Estimations ANIL, à partir des données du Groupe SeLoger et de
 * leboncoin ».
 *
 *   node scripts/agreger-loyers.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * On ne code pas l'URL des CSV en dur.
 *
 * L'ANIL publie un NOUVEAU jeu de données chaque année, avec un identifiant et
 * des URL horodatées différents ; une URL figée aurait gelé le millésime 2025
 * pour toujours, sans que personne s'en aperçoive. On interroge donc le
 * catalogue, et on prend l'année la plus récente qu'il annonce.
 */
const CATALOGUE = "https://www.data.gouv.fr/api/1/datasets/?q=carte+des+loyers";

/** Le millésime se lit dans le titre du jeu de données, pas ailleurs. */
const TITRE_MILLESIME = /loyers\s+d(?:’|')annonce\s+par\s+commune\s+en\s+(\d{4})/i;

/**
 * Les deux ressources retenues, reconnues à leur nom de fichier.
 *
 * `pred-app` couvre toutes les typologies d'appartement confondues ;
 * `pred-mai` les maisons. Le jeu publie aussi `pred-app12` et `pred-app3`
 * (T1-T2 et T3+) : les ignorer est un choix, parce que nos médianes DVF ne
 * sont pas ventilées par nombre de pièces et qu'un rendement croisant un T2
 * loué avec un prix au m² tous appartements confondus serait un faux.
 */
const RESSOURCES = {
  appartement: /pred-app-mef/i,
  maison: /pred-mai-mef/i,
};

/**
 * Surfaces du « bien type » sur lequel chaque indicateur est estimé.
 *
 * Elles ne servent aucun calcul ici, elles sont recopiées dans la sortie parce
 * qu'un loyer au m² dépend fortement de la surface : 14 €/m² pour 52 m² ne se
 * transpose pas tel quel à un studio de 20 m², qui se loue bien plus cher au
 * mètre. Ne pas transporter cette information reviendrait à laisser croire à
 * une valeur universelle.
 */
const SURFACES_TYPE = { appartement: 52, maison: 92 };

const ATTRIBUTION =
  "Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin";

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/**
 * Les fichiers sont en windows-1252, séparés par des points-virgules, terminés
 * en CRLF, et les décimales sont des VIRGULES. Quatre pièges dans un seul
 * fichier : `Number("14,50")` renvoie `NaN` sans prévenir, et un décodage en
 * UTF-8 transforme « La Bâtie-des-Fonds » en mojibake.
 */
function decoder(octets) {
  return new TextDecoder("windows-1252").decode(octets);
}

/** Découpage qui respecte les guillemets : un libellé peut porter un `;`. */
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

/** `null` et non `0` : une cellule vide veut dire « non estimé », pas « gratuit ». */
function nombre(valeur) {
  if (valeur === undefined || valeur.trim() === "") return null;
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function arrondir(valeur, decimales) {
  if (valeur === null) return null;
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/**
 * L'échelle réellement utilisée pour estimer la commune.
 *
 * La source écrit `commune`, `maille` ou `EPCI`. On normalise en minuscules et
 * on refuse de deviner : une valeur inconnue devient `null`, ce qui interdit à
 * l'affichage de la présenter comme une estimation communale.
 */
function echelle(typpred) {
  const valeur = (typpred ?? "").trim().toLowerCase();
  if (valeur === "commune" || valeur === "maille" || valeur === "epci") {
    return valeur;
  }
  return null;
}

/* ── Catalogue ───────────────────────────────────────────────────────────── */

/** Le jeu de données du millésime le plus récent, et ses deux CSV. */
async function trouverMillesime() {
  const reponse = await fetch(CATALOGUE, {
    headers: { accept: "application/json" },
  });
  if (!reponse.ok) {
    throw new Error(`data.gouv.fr a répondu ${reponse.status}`);
  }
  const { data = [] } = await reponse.json();

  const candidats = [];
  for (const jeu of data) {
    const trouve = TITRE_MILLESIME.exec(jeu.title ?? "");
    if (trouve) candidats.push({ annee: Number(trouve[1]), jeu });
  }
  if (candidats.length === 0) {
    throw new Error(
      "Aucun jeu « loyers d'annonce par commune » dans le catalogue : " +
        "le titre a probablement changé, corriger TITRE_MILLESIME.",
    );
  }

  candidats.sort((a, b) => b.annee - a.annee);
  const { annee, jeu } = candidats[0];

  const urls = {};
  for (const [famille, motif] of Object.entries(RESSOURCES)) {
    const ressource = (jeu.resources ?? []).find(
      (r) => r.format === "csv" && motif.test(r.url ?? ""),
    );
    if (!ressource) {
      throw new Error(
        `Ressource ${famille} introuvable dans le millésime ${annee} ` +
          `(motif ${motif}). Vérifier ${jeu.page}`,
      );
    }
    urls[famille] = ressource.url;
  }

  return { annee, page: jeu.page, urls };
}

/* ── Lecture d'un CSV ────────────────────────────────────────────────────── */

/**
 * Renvoie une Map code INSEE → indicateur, pour une famille de biens.
 *
 * Les colonnes sont lues par leur NOM, jamais par leur position : l'ANIL a
 * déjà réordonné ses fichiers d'un millésime à l'autre, et un décalage d'index
 * publierait silencieusement un R² à la place d'un loyer.
 */
async function lireIndicateurs(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) {
    throw new Error(`${url} a répondu ${reponse.status}`);
  }
  const texte = decoder(await reponse.arrayBuffer());
  const lignes = texte.split(/\r?\n/);

  const entete = decouper(lignes[0] ?? "");
  const colonnes = {
    insee: entete.indexOf("INSEE_C"),
    nom: entete.indexOf("LIBGEO"),
    dep: entete.indexOf("DEP"),
    loyer: entete.indexOf("loypredm2"),
    bas: entete.indexOf("lwr.IPm2"),
    haut: entete.indexOf("upr.IPm2"),
    echelle: entete.indexOf("TYPPRED"),
    obs: entete.indexOf("nbobs_com"),
    r2: entete.indexOf("R2_adj"),
  };
  for (const [nom, index] of Object.entries(colonnes)) {
    if (index === -1) {
      throw new Error(
        `Colonne « ${nom} » absente de ${url} : le format a changé, ` +
          `ne pas deviner, relire le dictionnaire de variables.`,
      );
    }
  }

  const parCommune = new Map();

  for (let i = 1; i < lignes.length; i += 1) {
    const ligne = lignes[i];
    if (!ligne) continue;
    const champs = decouper(ligne);

    const insee = (champs[colonnes.insee] ?? "").trim();
    if (!insee) continue;

    const loyer = arrondir(nombre(champs[colonnes.loyer]), 2);
    // Un loyer nul ou absent n'est pas un indicateur : on ne retient rien.
    if (loyer === null || loyer <= 0) continue;

    parCommune.set(insee, {
      nom: (champs[colonnes.nom] ?? "").trim(),
      dep: (champs[colonnes.dep] ?? "").trim(),
      indicateur: {
        m2: loyer,
        bas: arrondir(nombre(champs[colonnes.bas]), 2),
        haut: arrondir(nombre(champs[colonnes.haut]), 2),
        echelle: echelle(champs[colonnes.echelle]),
        obs: nombre(champs[colonnes.obs]) ?? 0,
        r2: arrondir(nombre(champs[colonnes.r2]), 3),
      },
    });
  }

  if (parCommune.size === 0) {
    throw new Error(`${url} n'a produit aucune commune exploitable.`);
  }
  return parCommune;
}

/* ── Programme ───────────────────────────────────────────────────────────── */

async function main() {
  const { annee, page, urls } = await trouverMillesime();
  process.stderr.write(`Millésime ${annee} — ${page}\n`);

  const familles = {};
  for (const [famille, url] of Object.entries(urls)) {
    process.stderr.write(`  ${famille} ← ${url}\n`);
    familles[famille] = await lireIndicateurs(url);
  }

  // Union et non intersection : une commune peut avoir un indicateur maison
  // sans indicateur appartement, et l'absence de l'un ne disqualifie pas
  // l'autre.
  const codes = new Set();
  for (const carte of Object.values(familles)) {
    for (const code of carte.keys()) codes.add(code);
  }

  const communes = {};
  for (const code of [...codes].sort()) {
    const appartement = familles.appartement.get(code);
    const maison = familles.maison.get(code);
    const identite = appartement ?? maison;

    communes[code] = {
      nom: identite.nom,
      dep: identite.dep,
      appartement: appartement?.indicateur ?? null,
      maison: maison?.indicateur ?? null,
    };
  }

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    annee,
    source: "Carte des loyers — indicateurs de loyers d'annonce (DGALN / ANIL)",
    attribution: ATTRIBUTION,
    page,
    ressources: urls,
    surfacesType: SURFACES_TYPE,
    /**
     * Recopié dans la sortie pour que personne n'ait à retrouver la note
     * méthodologique avant d'afficher un chiffre.
     */
    precautions: [
      "Loyers d'ANNONCE, charges comprises, biens loués vides : ils surestiment le loyer net encaissé.",
      "Une échelle « maille » ou « epci » signale une valeur estimée sur des communes voisines, pas sur la commune elle-même.",
      "L'ANIL invite à la prudence quand r2 < 0,5, obs < 30, ou quand l'écart bas–haut est très large.",
      "Indicateurs estimés pour un bien type (52 m² en appartement, 92 m² en maison) : ils ne se transposent pas à un studio.",
    ],
    communes,
  };

  const sortie = path.join(process.cwd(), "src/data/loyers.json");
  await mkdir(path.dirname(sortie), { recursive: true });
  // Sans indentation : 34 900 communes, l'indentation pèserait plus lourd que
  // les chiffres eux-mêmes, et ce fichier n'est pas relu à la main.
  await writeFile(sortie, `${JSON.stringify(payload)}\n`, "utf8");

  const avecAppartement = [...codes].filter((c) =>
    familles.appartement.has(c),
  ).length;
  const avecMaison = [...codes].filter((c) => familles.maison.has(c)).length;
  process.stderr.write(
    `\nÉcrit ${sortie}\n` +
      `  ${codes.size} communes — ${avecAppartement} appartement, ${avecMaison} maison\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
