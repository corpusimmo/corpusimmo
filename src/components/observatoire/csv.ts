import { dvfTypeLabel } from "./dvf-labels";
import type { ComparableEntry } from "./comparables-store";

/**
 * L'export tabulaire, en un seul endroit.
 *
 * Extrait du seul explorateur de transactions le jour où la sélection de
 * comparables a eu besoin du même export : deux échappements CSV concurrents
 * finissent toujours par diverger, et c'est l'accent d'une adresse qui le
 * révèle chez le client.
 */

export type CsvCell = string | number | boolean | undefined;

/**
 * Excel francophone attend `;` comme séparateur et une BOM UTF-8 ; sans elle,
 * les accents et les colonnes se cassent à l'ouverture.
 */
export function toCsv(rows: CsvCell[][]): string {
  const escape = (cell: CsvCell): string => {
    if (cell === undefined) return "";
    const value = String(cell);
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return `﻿${rows.map((row) => row.map(escape).join(";")).join("\r\n")}`;
}

/** Déclenche le téléchargement. Le nom porte la date : deux exports ne s'écrasent pas. */
export function downloadCsv(content: string, basename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${basename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * La sélection de comparables, telle qu'elle est réellement retenue.
 *
 * La colonne « Retenu » est celle qui compte : une ligne exclue reste dans le
 * fichier — on doit pouvoir justifier ce qu'on a écarté, pas seulement ce
 * qu'on a gardé.
 */
export function comparablesToCsv(items: ComparableEntry[]): string {
  const header = [
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
  ];

  const body = items.map(({ transaction, excluded, manualWeight, comment }) => [
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

  return toCsv([header, ...body]);
}
