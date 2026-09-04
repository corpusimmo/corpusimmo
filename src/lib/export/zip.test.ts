import { describe, expect, it } from "vitest";
import { buildXlsx } from "./xlsx";
import { crc32, escapeXml, zipStored } from "./zip";

/* ── Un lecteur ZIP de test, écrit à part ────────────────────────────────── */

/**
 * On relit l'archive avec un décodeur INDÉPENDANT du rédacteur.
 *
 * Vérifier la sortie avec les mêmes fonctions qui l'ont produite ne prouve
 * rien : les deux partageraient la même erreur. Ce lecteur repart de la fin de
 * l'annuaire central, comme le ferait un vrai décompresseur.
 */
function lireZip(octets: Uint8Array): Map<string, string> {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const decodeur = new TextDecoder();

  // La fin d'annuaire fait 22 octets quand il n'y a pas de commentaire.
  let eocd = octets.length - 22;
  while (eocd >= 0 && vue.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  expect(eocd).toBeGreaterThanOrEqual(0);

  const nombre = vue.getUint16(eocd + 10, true);
  let curseur = vue.getUint32(eocd + 16, true);

  const parties = new Map<string, string>();
  for (let i = 0; i < nombre; i += 1) {
    expect(vue.getUint32(curseur, true)).toBe(0x02014b50);
    const compressee = vue.getUint32(curseur + 20, true);
    const brute = vue.getUint32(curseur + 24, true);
    const tailleNom = vue.getUint16(curseur + 28, true);
    const tailleExtra = vue.getUint16(curseur + 30, true);
    const tailleCom = vue.getUint16(curseur + 32, true);
    const local = vue.getUint32(curseur + 42, true);
    const nom = decodeur.decode(octets.subarray(curseur + 46, curseur + 46 + tailleNom));

    // Méthode 0 : la taille compressée vaut la taille brute, par définition.
    expect(vue.getUint16(curseur + 10, true)).toBe(0);
    expect(compressee).toBe(brute);

    expect(vue.getUint32(local, true)).toBe(0x04034b50);
    const nomLocal = vue.getUint16(local + 26, true);
    const extraLocal = vue.getUint16(local + 28, true);
    const debut = local + 30 + nomLocal + extraLocal;
    const contenu = octets.subarray(debut, debut + brute);

    expect(crc32(contenu)).toBe(vue.getUint32(curseur + 16, true));
    parties.set(nom, decodeur.decode(contenu));
    curseur += 46 + tailleNom + tailleExtra + tailleCom;
  }
  return parties;
}

/**
 * Les octets d'un `Blob`, via `FileReader`.
 *
 * Le `Blob` de jsdom est antérieur à `arrayBuffer()` et ne l'expose pas, alors
 * que les navigateurs ciblés l'ont tous. `FileReader` marche des deux côtés,
 * et ne sert qu'ici, dans les tests.
 */
function octets(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(new Uint8Array(lecteur.result as ArrayBuffer));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsArrayBuffer(blob);
  });
}

const MIME = "application/zip";

/* ── CRC32 ───────────────────────────────────────────────────────────────── */

describe("crc32", () => {
  it("retrouve la valeur de référence de la norme", () => {
    // Le vecteur « check » de CRC-32/ISO-HDLC, celui que publie la norme.
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("vaut zéro sur une entrée vide", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("reste dans les entiers non signés sur 32 bits", () => {
    const valeur = crc32(new TextEncoder().encode("é".repeat(1000)));
    expect(valeur).toBeGreaterThanOrEqual(0);
    expect(valeur).toBeLessThanOrEqual(0xffffffff);
  });
});

/* ── L'archive ───────────────────────────────────────────────────────────── */

describe("zipStored", () => {
  it("produit une archive relisible, contenu pour contenu", async () => {
    const parties = lireZip(
      await octets(
        zipStored(
          [
            { name: "a.xml", content: "<a/>" },
            { name: "dossier/b.txt", content: "deuxième" },
          ],
          MIME,
        ),
      ),
    );
    expect([...parties.keys()]).toEqual(["a.xml", "dossier/b.txt"]);
    expect(parties.get("dossier/b.txt")).toBe("deuxième");
  });

  it("commence par la signature d'en-tête local", async () => {
    const brut = await octets(zipStored([{ name: "a", content: "b" }], MIME));
    expect(Array.from(brut.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("compte les octets et non les caractères", async () => {
    // Un caractère hors ASCII pèse plusieurs octets en UTF-8 : confondre les
    // deux décale tous les décalages de l'annuaire et casse l'archive.
    const contenu = "€uro naïf";
    const parties = lireZip(
      await octets(zipStored([{ name: "é.xml", content: contenu }], MIME)),
    );
    expect(parties.get("é.xml")).toBe(contenu);
  });

  it("accepte une archive vide", async () => {
    const brut = await octets(zipStored([], MIME));
    expect(brut.length).toBe(22);
    expect(lireZip(brut).size).toBe(0);
  });

  it("porte le type MIME qu'on lui donne", () => {
    expect(zipStored([], "application/x-test").type).toBe("application/x-test");
  });

  it("est déterministe : deux appels, deux fichiers identiques", async () => {
    const fichiers = [{ name: "a.xml", content: "<a>1</a>" }];
    const a = await octets(zipStored(fichiers, MIME));
    const b = await octets(zipStored(fichiers, MIME));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("escapeXml", () => {
  it("neutralise les quatre caractères qui cassent le XML", () => {
    expect(escapeXml(`Dupont & Fils <"immobilier">`)).toBe(
      "Dupont &amp; Fils &lt;&quot;immobilier&quot;&gt;",
    );
  });

  it("n'échappe pas deux fois une esperluette déjà échappée", () => {
    // La règle est d'échapper du texte BRUT : passer du texte déjà échappé
    // donne `&amp;amp;`, et c'est le bon comportement, pas un bug à corriger.
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });
});

/* ── Non-régression du classeur ──────────────────────────────────────────── */

describe("buildXlsx après extraction du rédacteur ZIP", () => {
  it("garde ses six parties et son contenu", async () => {
    const parties = lireZip(
      await octets(
        buildXlsx({
          name: "Comparables",
          rows: [
            ["Adresse", "Prix"],
            ["12 rue de l'Église & fils", 342000],
          ],
          widths: [30, 12],
        }),
      ),
    );

    expect([...parties.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);

    const feuille = parties.get("xl/worksheets/sheet1.xml")!;
    // Le nombre reste un nombre, l'esperluette reste échappée.
    expect(feuille).toContain('<c r="B2"><v>342000</v></c>');
    expect(feuille).toContain("12 rue de l'Église &amp; fils");
    expect(parties.get("xl/workbook.xml")).toContain('name="Comparables"');
  });

  it("nettoie un nom de feuille interdit par Excel", async () => {
    const parties = lireZip(
      await octets(buildXlsx({ name: "a:b/c*d?e[f]g", rows: [["x"]] })),
    );
    expect(parties.get("xl/workbook.xml")).toContain('name="a b c d e f g"');
  });
});
