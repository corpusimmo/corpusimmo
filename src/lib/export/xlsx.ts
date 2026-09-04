/**
 * Un vrai fichier Excel, écrit à la main, sans dépendance.
 *
 * POURQUOI PAS UNE LIBRAIRIE. SheetJS et consorts pèsent plusieurs centaines
 * de kilo-octets pour, ici, produire une seule feuille sans formule. Ce dépôt
 * tient quinze dépendances : en ajouter une de ce poids pour un bouton
 * d'export serait un mauvais échange, payé par tous les visiteurs y compris
 * ceux qui n'exportent jamais.
 *
 * POURQUOI PAS DU CSV RENOMMÉ. Un `.csv` déguisé en `.xls` est le classique du
 * genre : Excel l'ouvre en protestant, les nombres arrivent en texte, et les
 * dates se font massacrer par la locale. Ce qui suit est un OOXML authentique
 * — Excel, LibreOffice et Numbers l'ouvrent sans un mot.
 *
 * COMMENT. Un `.xlsx` est une archive ZIP de fichiers XML. On écrit donc un
 * ZIP minimal en méthode « stored » (aucune compression) : la compression
 * demanderait DEFLATE, c'est-à-dire exactement la librairie qu'on cherche à
 * éviter. Le fichier est plus gros sur le disque, jamais sur le réseau — il
 * naît dans le navigateur et n'est envoyé nulle part.
 *
 * CE QUI EST TYPÉ. Les nombres partent en nombres (`t="n"`), le reste en
 * chaînes littérales (`t="inlineStr"`), ce qui évite la table de chaînes
 * partagées. Un prix reste donc sommable dans Excel sans retraitement — c'est
 * tout l'intérêt d'exporter en tableur plutôt qu'en CSV.
 */

import { escapeXml, zipStored } from "./zip";

export type XlsxCell = string | number | undefined;

export interface XlsxSheet {
  name: string;
  /** La première ligne est traitée comme un en-tête. */
  rows: XlsxCell[][];
  /** Largeurs de colonnes, en « caractères » Excel. */
  widths?: number[];
}

/** `0` → `A`, `26` → `AA`. Excel numérote ses colonnes en base 26 biaisée. */
function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";

  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          if (cell === undefined || cell === "") return "";
          const ref = `${columnName(c)}${r + 1}`;
          // Style 1 = en-tête gras ; style 0 = corps.
          const style = r === 0 ? ' s="1"' : "";
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"${style}><v>${cell}</v></c>`;
          }
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(
            String(cell),
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

/**
 * Le classeur complet.
 *
 * Le nom de feuille est nettoyé : Excel refuse `: \\ / ? * [ ]` et s'arrête à
 * 31 caractères. Un nom invalide ne produit pas une erreur, il produit un
 * fichier que le tableur déclare corrompu — beaucoup plus difficile à
 * diagnostiquer côté client.
 */
export function buildXlsx(sheet: XlsxSheet): Blob {
  const name = sheet.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Feuille1";

  return zipStored(
    [
      {
        name: "[Content_Types].xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      },
      {
        name: "_rels/.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      },
      {
        name: "xl/workbook.xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
          name,
        )}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      },
      {
        // Deux styles seulement : corps, et en-tête gras sur fond marine clair.
        name: "xl/styles.xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14293C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
      },
      { name: "xl/worksheets/sheet1.xml", content: sheetXml(sheet) },
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

/** Déclenche le téléchargement. Le nom porte la date : deux exports ne s'écrasent pas. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
