"use client";

/**
 * Les trois sorties d'une sélection de comparables, depuis UNE description.
 *
 * Le tableau part d'ici sous une seule forme — en-tête plus lignes — et les
 * trois formats s'y branchent. C'est la même raison qui avait déjà fait sortir
 * l'échappement CSV de l'explorateur : deux tables construites séparément
 * finissent par diverger, et c'est le client qui découvre qu'une colonne
 * manque dans un format et pas dans l'autre.
 *
 * La colonne « Retenu » reste la première dans les trois : une ligne exclue
 * voyage avec le fichier. On doit pouvoir justifier ce qu'on a écarté, pas
 * seulement ce qu'on a gardé.
 */

import { buildXlsx, downloadBlob } from "@/lib/export/xlsx";
import type { ComparableEntry } from "./comparables-store";
import { dvfTypeLabel } from "./dvf-labels";
import { downloadCsv, toCsv } from "./csv";

/**
 * Une cellule de la table commune.
 *
 * Volontairement plus étroite que `CsvCell` : le CSV tolère un booléen, pas le
 * tableur, qui doit choisir entre nombre et texte. Les colonnes oui/non sont
 * donc écrites en toutes lettres à la construction, une bonne fois.
 */
type Cell = string | number | undefined;

const HEADER = [
  "Retenu",
  "Type",
  "Date",
  "Prix (€)",
  "Surface (m²)",
  "Prix au m² (€)",
  "Pièces",
  "Adresse",
  "Commune",
  "Code INSEE",
  "Multi-lots",
  "Pondération manuelle",
  "Commentaire",
  "Source",
] as const;

/** Largeurs de colonnes du tableur, dans l'ordre de `HEADER`. */
const WIDTHS = [8, 14, 12, 13, 13, 14, 8, 38, 20, 12, 11, 12, 30, 10];

function toRows(items: ComparableEntry[]): Cell[][] {
  return items.map(({ transaction, excluded, manualWeight, comment }) => [
    excluded ? "non" : "oui",
    dvfTypeLabel(transaction.propertyType),
    transaction.date,
    transaction.price,
    transaction.builtArea,
    transaction.pricePerSqm,
    transaction.rooms,
    transaction.addressLabel,
    transaction.city,
    transaction.cityCode,
    transaction.isMultiLot ? "oui" : "non",
    manualWeight,
    comment,
    transaction.source,
  ]);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportCsv(items: ComparableEntry[]): void {
  downloadCsv(toCsv([[...HEADER], ...toRows(items)]), "corpusimmo-comparables");
}

export function exportXlsx(items: ComparableEntry[]): void {
  const blob = buildXlsx({
    name: "Comparables",
    rows: [[...HEADER], ...toRows(items)],
    widths: WIDTHS,
  });
  downloadBlob(blob, `corpusimmo-comparables-${stamp()}.xlsx`);
}

/* ── Document imprimable ─────────────────────────────────────────────────── */

function escapeHtml(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #14293c; }
  header { display: flex; align-items: baseline; justify-content: space-between;
           border-bottom: 2px solid #8a6a2f; padding-bottom: 8px; margin-bottom: 14px; }
  .marque { font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
  .marque i { font-style: normal; color: #8a6a2f; }
  .meta { font-size: 10px; color: #5b6b7c; text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #14293c; color: #fff; font-size: 9.5px; font-weight: 600;
       text-align: left; padding: 6px 5px; text-transform: uppercase; letter-spacing: .03em; }
  td { padding: 5px; border-bottom: 1px solid #dde4ec; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f4f7fb; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* Une ligne écartée doit se VOIR écartée sur le papier, où l'on ne peut
     plus cliquer pour comprendre pourquoi elle est grise. */
  tr.exclu td { color: #8894a4; }
  tr.exclu td:first-child::after { content: " (écartée)"; font-size: 9px; }
  footer { margin-top: 14px; font-size: 9px; color: #5b6b7c; border-top: 1px solid #dde4ec; padding-top: 8px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
`;

/**
 * Ouvre une fenêtre mise en pages et lance l'impression.
 *
 * `about:blank` plutôt qu'une route : le document est entièrement dérivé de la
 * sélection déjà en mémoire, aucun aller-retour serveur n'apporterait quoi que
 * ce soit — et la sélection d'un visiteur non connecté ne quitte pas son
 * navigateur, ce qui est la règle du reste de l'écran.
 *
 * Renvoie `false` si la fenêtre a été bloquée : l'appelant doit alors le dire
 * plutôt que de laisser croire à un export silencieux.
 */
export function printSelection(items: ComparableEntry[]): boolean {
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) return false;

  const retained = items.filter((item) => !item.excluded).length;
  const rows = toRows(items)
    .map((row, i) => {
      const exclu = items[i]?.excluded ? ' class="exclu"' : "";
      const cells = row
        .map((cell) => {
          const num = typeof cell === "number";
          const value = num
            ? new Intl.NumberFormat("fr-FR").format(cell)
            : escapeHtml(cell);
          return `<td${num ? ' class="num"' : ""}>${value}</td>`;
        })
        .join("");
      return `<tr${exclu}>${cells}</tr>`;
    })
    .join("");

  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>CorpusImmo — sélection de comparables</title><style>${PRINT_CSS}</style></head><body>
<header>
  <div>
    <div class="marque">Corpus<i>Immo</i></div>
    <div style="font-size:11px;color:#5b6b7c">Sélection de comparables · ${retained} retenue${
      retained > 1 ? "s" : ""
    } sur ${items.length}</div>
  </div>
  <div class="meta">Édité le ${new Date().toLocaleDateString("fr-FR")}<br>corpus.immo</div>
</header>
<table><thead><tr>${HEADER.map((h) => `<th>${escapeHtml(h)}</th>`).join(
    "",
  )}</tr></thead><tbody>${rows}</tbody></table>
<footer>Source : Demandes de Valeurs Foncières (DGFiP), mutations réellement enregistrées.
Les lignes écartées sont conservées dans ce document afin que la sélection reste justifiable.</footer>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
