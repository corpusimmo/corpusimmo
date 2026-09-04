import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Charte } from "@/lib/brand/charte";
import { CHARTE_CORPUSIMMO } from "@/lib/brand/charte";
import { DOCUMENT_KINDS, documentKind, sectionsFor } from "@/lib/generators/documents";
import { buildPptx, piedTexte } from "./pptx";

/* ── Relire ce qu'on a écrit ─────────────────────────────────────────────── */

function octets(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(new Uint8Array(lecteur.result as ArrayBuffer));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsArrayBuffer(blob);
  });
}

/**
 * Décode l'archive depuis son annuaire central, sans rien réutiliser du
 * rédacteur : un test qui appellerait le code testé pour se vérifier
 * lui-même ne prouverait rien.
 */
function lireZip(brut: Uint8Array): Map<string, string> {
  const vue = new DataView(brut.buffer, brut.byteOffset, brut.byteLength);
  const decodeur = new TextDecoder();

  let eocd = brut.length - 22;
  while (eocd >= 0 && vue.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  expect(eocd, "fin d'annuaire central introuvable").toBeGreaterThanOrEqual(0);

  const nombre = vue.getUint16(eocd + 10, true);
  let curseur = vue.getUint32(eocd + 16, true);
  const parties = new Map<string, string>();

  for (let i = 0; i < nombre; i += 1) {
    expect(vue.getUint32(curseur, true)).toBe(0x02014b50);
    const taille = vue.getUint32(curseur + 24, true);
    const tailleNom = vue.getUint16(curseur + 28, true);
    const tailleExtra = vue.getUint16(curseur + 30, true);
    const tailleCom = vue.getUint16(curseur + 32, true);
    const local = vue.getUint32(curseur + 42, true);
    const nom = decodeur.decode(brut.subarray(curseur + 46, curseur + 46 + tailleNom));

    expect(vue.getUint32(local, true), `en-tête local de ${nom}`).toBe(0x04034b50);
    const debut = local + 30 + vue.getUint16(local + 26, true) + vue.getUint16(local + 28, true);
    parties.set(nom, decodeur.decode(brut.subarray(debut, debut + taille)));
    curseur += 46 + tailleNom + tailleExtra + tailleCom;
  }
  return parties;
}

/** Analyse un XML et échoue en nommant la partie fautive. */
function xml(source: string, nom: string): Document {
  const doc = new DOMParser().parseFromString(source, "application/xml");
  const erreur = doc.querySelector("parsererror");
  expect(erreur?.textContent ?? null, `XML mal formé dans ${nom}`).toBeNull();
  return doc;
}

/** Résout un `Target` relatif de relation vers un chemin de partie. */
function resoudre(sourceRels: string, cible: string): string {
  const base = sourceRels.replace(/_rels\/[^/]+$/, "");
  const segments = (base + cible).split("/");
  const pile: string[] = [];
  for (const segment of segments) {
    if (segment === "..") pile.pop();
    else if (segment !== "." && segment !== "") pile.push(segment);
  }
  return pile.join("/");
}

/* ── Chartes de test ─────────────────────────────────────────────────────── */

const CHARTE_CLIENT: Charte = {
  entreprise: "Dupont & Fils <Immobilier>",
  site: 'agence-"dupont".fr',
  logo: null,
  principale: "#7a1f3d",
  secondaire: "#c9a227",
  parDefaut: false,
};

/** Un jaune vif : le cas où poser du blanc donnerait un titre illisible. */
const CHARTE_JAUNE: Charte = {
  entreprise: "Solaris",
  principale: "#ffd400",
  parDefaut: false,
};

const AVIS = documentKind("avis-de-valeur")!;
const TEASER = documentKind("teaser")!;

/* ── L'archive est bien formée ───────────────────────────────────────────── */

describe("l'archive produite", () => {
  let parties: Map<string, string>;

  beforeAll(async () => {
    // On passe VRAIMENT par le disque : c'est le chemin qu'emprunte le
    // fichier chez le client, et une erreur d'octets ne se voit qu'ici.
    const dossier = mkdtempSync(join(tmpdir(), "corpusimmo-pptx-"));
    const chemin = join(dossier, "trame.pptx");
    writeFileSync(chemin, await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    parties = lireZip(new Uint8Array(readFileSync(chemin)));
  });

  it("s'annonce comme une présentation OOXML", () => {
    expect(buildPptx(AVIS, CHARTE_CLIENT).type).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
  });

  it("contient les parties obligatoires du format", () => {
    for (const nom of [
      "[Content_Types].xml",
      "_rels/.rels",
      "ppt/presentation.xml",
      "ppt/_rels/presentation.xml.rels",
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      "ppt/theme/theme1.xml",
      "ppt/slides/slide1.xml",
      "ppt/slides/_rels/slide1.xml.rels",
    ]) {
      expect(parties.has(nom), `partie manquante : ${nom}`).toBe(true);
    }
  });

  it("n'a aucune partie XML mal formée", () => {
    for (const [nom, contenu] of parties) xml(contenu, nom);
  });

  it("déclare un type de contenu pour chaque partie déclarée, et l'inverse", () => {
    const types = xml(parties.get("[Content_Types].xml")!, "[Content_Types].xml");
    const declarees = [...types.getElementsByTagName("Override")].map((o) =>
      o.getAttribute("PartName")!.slice(1),
    );

    for (const nom of declarees) {
      expect(parties.has(nom), `déclarée mais absente : ${nom}`).toBe(true);
    }
    // Réciproquement, toute partie qui n'est ni un `.rels` ni un `.xml` par
    // défaut doit être déclarée : c'est l'oubli qui fait dire « endommagé ».
    for (const nom of parties.keys()) {
      if (nom.endsWith(".rels") || nom === "[Content_Types].xml") continue;
      expect(declarees, `partie non déclarée : ${nom}`).toContain(nom);
    }
  });

  it("ne laisse aucune relation pointer dans le vide", () => {
    let verifiees = 0;
    for (const [nom, contenu] of parties) {
      if (!nom.endsWith(".rels")) continue;
      const doc = xml(contenu, nom);
      for (const rel of [...doc.getElementsByTagName("Relationship")]) {
        const cible = resoudre(nom, rel.getAttribute("Target")!);
        expect(parties.has(cible), `${nom} pointe vers ${cible}`).toBe(true);
        verifiees += 1;
      }
    }
    expect(verifiees).toBeGreaterThan(0);
  });

  it("relie chaque diapositive de la présentation à un fichier existant", () => {
    const presentation = xml(parties.get("ppt/presentation.xml")!, "presentation");
    const rels = xml(
      parties.get("ppt/_rels/presentation.xml.rels")!,
      "presentation.xml.rels",
    );
    const cibles = new Map(
      [...rels.getElementsByTagName("Relationship")].map((r) => [
        r.getAttribute("Id")!,
        r.getAttribute("Target")!,
      ]),
    );

    const ids = [...presentation.getElementsByTagName("p:sldId")];
    expect(ids.length).toBe(sectionsFor(AVIS).length + 3);
    for (const id of ids) {
      // 256 est le premier identifiant admis : en dessous, le fichier est refusé.
      expect(Number(id.getAttribute("id"))).toBeGreaterThanOrEqual(256);
      const cible = cibles.get(id.getAttribute("r:id")!);
      expect(parties.has(`ppt/${cible}`), `diapositive absente : ${cible}`).toBe(true);
    }
  });

  it("garde la diapositive au format 16:9", () => {
    const doc = xml(parties.get("ppt/presentation.xml")!, "presentation");
    const taille = doc.getElementsByTagName("p:sldSz")[0]!;
    expect(taille.getAttribute("cx")).toBe("12192000");
    expect(taille.getAttribute("cy")).toBe("6858000");
  });
});

/* ── La taxonomie commande, pas une liste en dur ─────────────────────────── */

describe("les diapositives suivent la taxonomie", () => {
  it.each(DOCUMENT_KINDS.map((kind) => [kind.id, kind] as const))(
    "%s : couverture, sommaire, les sections, puis le contact",
    async (_id, kind) => {
      const parties = lireZip(await octets(buildPptx(kind, CHARTE_CLIENT)));
      const sections = sectionsFor(kind);

      const diapos = [...parties.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
      // Deux pages de cadre en tête, une de contact en queue.
      expect(diapos.length).toBe(sections.length + 3);

      // Le sommaire annonce TOUTES les sections, et dans l'ordre : un sommaire
      // qui en oublie une est pire qu'aucun sommaire.
      const sommaire = parties.get("ppt/slides/slide2.xml")!;
      for (const section of sections) {
        expect(sommaire, `sommaire, ${section.id}`).toContain(section.label);
      }

      // Les sections commencent à la troisième diapositive.
      for (const [index, section] of sections.entries()) {
        const contenu = parties.get(`ppt/slides/slide${index + 3}.xml`)!;
        expect(contenu, `section ${section.id}`).toContain(`<a:t>${section.label}</a:t>`);
      }
    },
  );

  it("numérote chaque page sur le même total", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    const total = sectionsFor(AVIS).length + 3;

    for (let rang = 2; rang <= total; rang += 1) {
      const contenu = parties.get(`ppt/slides/slide${rang}.xml`)!;
      const attendu = `${String(rang).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      expect(contenu, `page ${rang}`).toContain(attendu);
    }
  });

  it("un teaser ne reçoit pas les sections que ses champs interdits vident", async () => {
    // Le libellé n'est pas recopié ici : la taxonomie peut le réécrire, et un
    // test qui figerait le texte passerait au vert en testant autre chose.
    const memo = documentKind("memorandum")!;
    const interdites = sectionsFor(memo)
      .filter((section) => !sectionsFor(TEASER).some((gardee) => gardee.id === section.id))
      .map((section) => section.label);
    expect(interdites.length).toBeGreaterThan(0);

    const teaser = [...lireZip(await octets(buildPptx(TEASER, CHARTE_CLIENT))).entries()]
      .filter(([nom]) => nom.startsWith("ppt/slides/slide"))
      .map(([, contenu]) => contenu)
      .join("");
    for (const label of interdites) expect(teaser).not.toContain(`<a:t>${label}</a:t>`);

    // Le mémorandum, lui, les garde : c'est bien la taxonomie qui décide.
    const complet = [...lireZip(await octets(buildPptx(memo, CHARTE_CLIENT))).values()].join("");
    for (const label of interdites) expect(complet).toContain(`<a:t>${label}</a:t>`);
  });

  it("écarte la section « baux » d'un teaser, dont les locataires sont interdits", async () => {
    expect(TEASER.forbiddenFields).toContain("locataires");
    expect(sectionsFor(TEASER).some((section) => section.id === "baux")).toBe(false);
  });
});

/* ── La charte ───────────────────────────────────────────────────────────── */

describe("la charte du client", () => {
  it("passe la couleur principale en accent1 et la seconde en accent2", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    const theme = xml(parties.get("ppt/theme/theme1.xml")!, "theme1");

    expect(theme.getElementsByTagName("a:accent1")[0]!.firstElementChild!.getAttribute("val")).toBe(
      "7A1F3D",
    );
    expect(theme.getElementsByTagName("a:accent2")[0]!.firstElementChild!.getAttribute("val")).toBe(
      "C9A227",
    );
  });

  it("retombe sur la principale quand aucune seconde couleur n'est donnée", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_JAUNE)));
    const theme = xml(parties.get("ppt/theme/theme1.xml")!, "theme1");
    expect(theme.getElementsByTagName("a:accent2")[0]!.firstElementChild!.getAttribute("val")).toBe(
      "FFD400",
    );
  });

  it("écrit en noir sur un bandeau jaune, en blanc sur un bandeau sombre", async () => {
    const jaune = lireZip(await octets(buildPptx(AVIS, CHARTE_JAUNE)));
    expect(jaune.get("ppt/slides/slide2.xml")).toContain('<a:srgbClr val="111111"/>');
    expect(jaune.get("ppt/slides/slide2.xml")).not.toContain('<a:srgbClr val="FFFFFF"/>');

    const sombre = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    expect(sombre.get("ppt/slides/slide2.xml")).toContain('<a:srgbClr val="FFFFFF"/>');
  });

  it("échappe un nom d'entreprise qui casserait le XML", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    const titre = parties.get("ppt/slides/slide1.xml")!;

    // Le XML reste analysable, et le texte brut n'apparaît nulle part.
    const doc = xml(titre, "slide1");
    expect(titre).not.toContain("Dupont & Fils <Immobilier>");
    expect(titre).toContain("Dupont &amp; Fils &lt;Immobilier&gt;");
    expect([...doc.getElementsByTagName("a:t")].map((t) => t.textContent)).toContain(
      "Dupont & Fils <Immobilier>",
    );
    // Le guillemet du site est échappé lui aussi, car le même texte peut finir
    // dans un attribut selon la forme.
    expect(titre).toContain("&quot;dupont&quot;");
  });
});

/* ── La signature en pied de page ────────────────────────────────────────── */

describe("le pied de page", () => {
  it("signe discrètement quand la charte est celle d'un client", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    for (const [nom, contenu] of parties) {
      if (!/^ppt\/slides\/slide\d+\.xml$/.test(nom)) continue;
      expect(contenu, nom).toContain("Trame générée avec CorpusImmo");
      expect(contenu, nom).toContain("Dupont &amp; Fils");
    }
  });

  it("ne se signe pas deux fois sur notre propre charte", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CORPUSIMMO)));
    const tout = [...parties.values()].join("");
    expect(tout).not.toContain("Trame générée avec CorpusImmo");
    expect(tout).toContain("CorpusImmo");
  });
});

/* ── Aucun contenu rédigé ────────────────────────────────────────────────── */

describe("les zones restent vides", () => {
  /**
   * LA PROMESSE : aucune phrase que le professionnel n'a pas écrite.
   *
   * Le test comptait autrefois les textes, deux par diapositive, ce qui ne
   * tenait plus dès qu'une section reçut des en-têtes de tableau ou des
   * libellés d'indicateurs. Compter n'était de toute façon qu'un approximatif
   * de ce qui compte vraiment : que tout texte présent vienne du VOCABULAIRE
   * de la taxonomie, jamais d'une rédaction.
   *
   * On vérifie donc l'appartenance, pas le nombre. Un « Lorem ipsum », un
   * exemple de rent roll ou une valeur inventée échouerait, quel que soit le
   * nombre de zones de la diapositive.
   */
  it("ne pose ni texte d'exemple ni faux contenu", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    const sections = sectionsFor(AVIS);
    const total = sections.length + 3;

    const admis = new Set<string>([piedTexte(CHARTE_CLIENT)]);
    for (const [index, section] of sections.entries()) {
      admis.add(section.label);
      // Le sommaire préfixe le libellé du rang de sa page.
      admis.add(`${String(index + 3).padStart(2, "0")}   ${section.label}`);
      for (const v of section.volets ?? []) admis.add(v);
      for (const c of section.colonnes ?? []) admis.add(c);
      for (const i of section.indicateurs ?? []) admis.add(i);
    }
    admis.add("Sommaire");
    for (let rang = 1; rang <= total; rang += 1) {
      admis.add(`${String(rang).padStart(2, "0")} / ${String(total).padStart(2, "0")}`);
    }

    for (const [nom, contenu] of parties) {
      // La couverture porte le nom du document et celui du cabinet, la
      // dernière page le contact : elles ont leur propre vocabulaire.
      if (!/^ppt\/slides\/slide\d+\.xml$/.test(nom)) continue;
      const rang = Number(nom.match(/slide(\d+)\.xml/)![1]);
      if (rang === 1 || rang === total) continue;

      for (const noeud of xml(contenu, nom).getElementsByTagName("a:t")) {
        const texte = (noeud.textContent ?? "").trim();
        if (!texte) continue;
        expect(admis.has(texte), `${nom} : « ${texte} » n'est pas du vocabulaire`).toBe(true);
      }
    }
  });
});

/* ── Les notes ───────────────────────────────────────────────────────────── */

describe("les pages de notes", () => {
  it("accompagnent chaque diapositive, une pour une", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    const total = sectionsFor(AVIS).length + 3;

    for (let rang = 1; rang <= total; rang += 1) {
      expect(parties.has(`ppt/notesSlides/notesSlide${rang}.xml`), `notes ${rang}`).toBe(true);
      const rels = parties.get(`ppt/slides/_rels/slide${rang}.xml.rels`)!;
      expect(rels, `renvoi de la diapositive ${rang}`).toContain(
        `notesSlides/notesSlide${rang}.xml`,
      );
    }
  });

  it("portent le mode d'emploi de la section", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));

    for (const [index, section] of sectionsFor(AVIS).entries()) {
      if (!section.attendu) continue;
      const notes = parties.get(`ppt/notesSlides/notesSlide${index + 3}.xml`)!;
      const doc = xml(notes, `notesSlide${index + 3}`);
      const textes = [...doc.getElementsByTagName("a:t")].map((t) => t.textContent);
      expect(textes, `notes de ${section.id}`).toContain(section.attendu);
    }
  });

  /**
   * LA CONSIGNE NE DOIT JAMAIS ATTERRIR SUR LA PAGE.
   *
   * C'est tout l'intérêt de la mettre en notes : un texte d'aide posé sur la
   * diapositive est un texte d'aide qu'on oublie d'effacer, et qui part chez
   * le client sous la signature du professionnel.
   */
  it("ne laissent aucune consigne sur les diapositives", async () => {
    const parties = lireZip(await octets(buildPptx(AVIS, CHARTE_CLIENT)));
    const diapos = [...parties.entries()]
      .filter(([nom]) => /^ppt\/slides\/slide\d+\.xml$/.test(nom))
      .map(([, contenu]) => contenu)
      .join("");

    for (const section of sectionsFor(AVIS)) {
      if (!section.attendu) continue;
      expect(diapos, `consigne de ${section.id}`).not.toContain(section.attendu);
    }
    expect(diapos).not.toContain(AVIS.pitfall);
  });
});
