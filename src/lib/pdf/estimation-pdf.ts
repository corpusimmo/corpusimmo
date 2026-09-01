/**
 * The consumer estimation report.
 *
 * Deliberately austere: one or two A4 pages, Helvetica, a few rules, one table.
 * A homeowner needs the range, how it was obtained, and what it is not — a
 * glossy brochure would over-promise on what a statistical estimate can say.
 *
 * COLOUR EXCEPTION (CONTRACTS §0.3): PDF has no CSS. The four values below are
 * copied once from the brand ramp in `src/app/globals.css`.
 */

import { disclaimers, siteConfig } from "@/config/site";
import {
  formatArea,
  formatDate,
  formatDistance,
  formatMonthYear,
  formatNumber,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import type { DvfPropertyType } from "@/types/dvf";
import { PROPERTY_CONDITION_LABELS, PROPERTY_TYPE_LABELS } from "@/types/property";
import type { Comparable, ValuationResult } from "@/types/valuation";

import { A4, PdfWriter, type Rgb } from "./writer";

const INK: Rgb = { r: 0.047, g: 0.078, b: 0.145 };
const MUTED: Rgb = { r: 0.42, g: 0.467, b: 0.576 };
const BRAND: Rgb = { r: 0.129, g: 0.271, b: 0.902 };
const BRAND_DEEP: Rgb = { r: 0.075, g: 0.11, b: 0.298 };
const SOFT: Rgb = { r: 0.937, g: 0.957, b: 1 };
const RULE: Rgb = { r: 0.882, g: 0.902, b: 0.941 };
const WHITE: Rgb = { r: 1, g: 1, b: 1 };

const CONFIDENCE_LABELS = {
  low: "Faible",
  moderate: "Modérée",
  high: "Élevée",
} as const;

const DVF_TYPE_LABELS: Record<DvfPropertyType, string> = {
  apartment: "Appart.",
  house: "Maison",
  land: "Terrain",
  commercial: "Commerce",
  dependency: "Dépend.",
  other: "Autre",
};

/** Max comparables printed. Beyond that the table stops being readable. */
const MAX_COMPARABLES = 6;

export interface EstimationPdfOptions {
  /**
   * Print the retained comparables (address, date, price of real sales).
   *
   * Mirrors the two tiers of `/estimation/[id]` — `docs/routes.md` §3 bis: the
   * simple report goes to anyone holding the link, the detailed one requires a
   * session. Defaults to `true` so a caller that already established identity
   * (the members area, an internal export) keeps the full document.
   */
  detailed?: boolean;
}

export async function renderEstimationPdf(
  v: ValuationResult,
  options?: EstimationPdfOptions,
): Promise<Uint8Array> {
  const detailed = options?.detailed ?? true;

  const doc = new PdfWriter({
    title: `Estimation ${siteConfig.name}, ${v.subject.address.city}`,
    author: siteConfig.legalName,
    margin: 48,
  });

  drawHeader(doc, v);
  drawSubject(doc, v);
  drawValueCard(doc, v);
  drawKeyFigures(doc, v);
  drawFeatures(doc, v);
  if (detailed) drawComparables(doc, v);
  drawMethodology(doc, v);
  drawDisclaimer(doc);
  drawFooters(doc);

  return doc.build();
}

/** ASCII-safe download name — a `Content-Disposition` filename should not need encoding. */
export function estimationPdfFilename(v: ValuationResult): string {
  const city = v.subject.address.city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip the combining accents NFD produced
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const shortId = v.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `estimation-corpusimmo-${city || "bien"}-${shortId}.pdf`;
}

// --- sections ----------------------------------------------------------------

function drawHeader(doc: PdfWriter, v: ValuationResult): void {
  const height = 88;
  doc.fillRect(0, 0, A4.width, height, BRAND_DEEP);
  doc.text(siteConfig.name, doc.margin, 42, { font: "Helvetica-Bold", size: 20, color: WHITE });
  doc.text("Estimation immobilière indicative", doc.margin, 62, {
    font: "Helvetica",
    size: 10,
    color: { r: 0.72, g: 0.78, b: 0.96 },
  });
  doc.text(`Éditée le ${formatDate(v.createdAt)}`, doc.margin, 62, {
    font: "Helvetica",
    size: 9,
    color: { r: 0.72, g: 0.78, b: 0.96 },
    align: "right",
    width: doc.contentWidth,
  });
  doc.text(`Référence ${v.id.slice(0, 8)}`, doc.margin, 42, {
    font: "Helvetica",
    size: 9,
    color: { r: 0.72, g: 0.78, b: 0.96 },
    align: "right",
    width: doc.contentWidth,
  });
  doc.y = height + 20;
}

function drawSubject(doc: PdfWriter, v: ValuationResult): void {
  const typeLabel = PROPERTY_TYPE_LABELS[v.subject.type];
  const area = v.subject.features.livingArea;

  doc.y += 16;
  doc.text(
    `${typeLabel}${area ? ` de ${formatArea(area)}` : ""}`,
    doc.margin,
    doc.y,
    { font: "Helvetica-Bold", size: 15, color: INK },
  );
  doc.paragraph(v.subject.address.label, { size: 10.5, color: MUTED });
  doc.y += 14;
}

function drawValueCard(doc: PdfWriter, v: ValuationResult): void {
  const cardHeight = 118;
  doc.ensureSpace(cardHeight + 12);
  const top = doc.y;
  doc.fillRect(doc.margin, top, doc.contentWidth, cardHeight, SOFT);

  doc.text("FOURCHETTE ESTIMÉE", doc.margin + 20, top + 26, {
    font: "Helvetica-Bold",
    size: 8.5,
    color: BRAND,
  });

  if (v.value) {
    doc.text(formatPrice(v.value.central), doc.margin + 20, top + 58, {
      font: "Helvetica-Bold",
      size: 26,
      color: BRAND_DEEP,
    });
    doc.text(
      `Entre ${formatPrice(v.value.low)} et ${formatPrice(v.value.high)}`,
      doc.margin + 20,
      top + 78,
      { font: "Helvetica", size: 11, color: INK },
    );

    // Range bar: the central value's position inside the interval, drawn to
    // scale so the asymmetry of the estimate is visible.
    const barLeft = doc.margin + 20;
    const barWidth = doc.contentWidth - 40;
    const barY = top + 96;
    doc.line(barLeft, barY, barLeft + barWidth, barY, RULE, 3);
    const span = Math.max(1, v.value.high - v.value.low);
    const ratio = Math.min(1, Math.max(0, (v.value.central - v.value.low) / span));
    doc.line(barLeft, barY, barLeft + barWidth * ratio, barY, BRAND, 3);
    doc.line(
      barLeft + barWidth * ratio,
      barY - 5,
      barLeft + barWidth * ratio,
      barY + 5,
      BRAND_DEEP,
      1.6,
    );
  } else {
    doc.text("Fourchette non concluante", doc.margin + 20, top + 58, {
      font: "Helvetica-Bold",
      size: 18,
      color: BRAND_DEEP,
    });
    doc.paragraph(
      v.diagnostics.failureReason ??
        "Trop peu de ventes comparables ont été trouvées autour de ce bien pour produire une fourchette honnête.",
      { x: doc.margin + 20, width: doc.contentWidth - 40, size: 10, color: INK },
    );
    doc.y = top + cardHeight;
  }

  if (v.pricePerSqm) {
    doc.text(formatPricePerSqm(v.pricePerSqm), doc.margin, top + 58, {
      font: "Helvetica-Bold",
      size: 14,
      color: BRAND_DEEP,
      align: "right",
      width: doc.contentWidth - 20,
    });
    doc.text("prix au m² retenu", doc.margin, top + 74, {
      font: "Helvetica",
      size: 9,
      color: MUTED,
      align: "right",
      width: doc.contentWidth - 20,
    });
  }

  doc.y = top + cardHeight + 22;
}

function drawKeyFigures(doc: PdfWriter, v: ValuationResult): void {
  const cells: { label: string; value: string }[] = [
    {
      label: "Niveau de confiance",
      value: `${CONFIDENCE_LABELS[v.confidence.level]} (${v.confidence.score}/100)`,
    },
    { label: "Ventes comparables retenues", value: formatNumber(v.diagnostics.retained) },
    { label: "Rayon de recherche", value: formatDistance(v.diagnostics.radiusUsed) },
    {
      label: "Médiane du secteur",
      value: v.medianPricePerSqm ? formatPricePerSqm(v.medianPricePerSqm) : "–",
    },
  ];

  doc.ensureSpace(48);
  const top = doc.y;
  const columnWidth = doc.contentWidth / cells.length;

  cells.forEach((cell, index) => {
    const x = doc.margin + columnWidth * index;
    doc.text(doc.truncate(cell.label, "Helvetica", 8.5, columnWidth - 8), x, top + 10, {
      font: "Helvetica",
      size: 8.5,
      color: MUTED,
    });
    doc.text(cell.value, x, top + 26, { font: "Helvetica-Bold", size: 11.5, color: INK });
  });

  doc.y = top + 40;
  doc.line(doc.margin, doc.y, doc.margin + doc.contentWidth, doc.y, RULE);
  doc.y += 18;
}

function drawFeatures(doc: PdfWriter, v: ValuationResult): void {
  const f = v.subject.features;
  const rows: [string, string][] = [];

  if (f.livingArea) rows.push(["Surface habitable", formatArea(f.livingArea)]);
  if (f.landArea) rows.push(["Surface du terrain", formatArea(f.landArea)]);
  if (f.rooms) rows.push(["Pièces", formatNumber(f.rooms)]);
  if (f.bedrooms) rows.push(["Chambres", formatNumber(f.bedrooms)]);
  if (f.floor !== undefined) rows.push(["Étage", f.floor === 0 ? "Rez-de-chaussée" : `${f.floor}e`]);
  if (f.hasElevator !== undefined) rows.push(["Ascenseur", f.hasElevator ? "Oui" : "Non"]);
  if (f.condition) rows.push(["État déclaré", PROPERTY_CONDITION_LABELS[f.condition]]);
  if (f.constructionYear) rows.push(["Année de construction", String(f.constructionYear)]);
  if (f.outdoor && f.outdoor !== "none") {
    const labels = { balcony: "Balcon", terrace: "Terrasse", garden: "Jardin" } as const;
    rows.push([
      "Extérieur",
      `${labels[f.outdoor]}${f.outdoorArea ? ` · ${formatArea(f.outdoorArea)}` : ""}`,
    ]);
  }
  if (f.hasParking || f.hasGarage) {
    rows.push(["Stationnement", f.hasGarage ? "Garage" : `${f.parkingSpots ?? 1} place(s)`]);
  }

  if (rows.length === 0) return;

  sectionTitle(doc, "Caractéristiques déclarées");

  const columnWidth = doc.contentWidth / 2;
  const lineHeight = 16;
  const rowsPerColumn = Math.ceil(rows.length / 2);
  doc.ensureSpace(rowsPerColumn * lineHeight + 8);
  const top = doc.y;

  rows.forEach(([label, value], index) => {
    const column = index < rowsPerColumn ? 0 : 1;
    const line = index % rowsPerColumn;
    const x = doc.margin + column * columnWidth;
    const y = top + line * lineHeight + 11;
    doc.text(label, x, y, { font: "Helvetica", size: 9.5, color: MUTED });
    doc.text(value, x, y, {
      font: "Helvetica-Bold",
      size: 9.5,
      color: INK,
      align: "right",
      width: columnWidth - 24,
    });
  });

  doc.y = top + rowsPerColumn * lineHeight + 14;
}

function drawComparables(doc: PdfWriter, v: ValuationResult): void {
  const retained = v.comparables
    .filter((c) => !c.excluded)
    .sort((a, b) => (b.manualWeight ?? b.weight) - (a.manualWeight ?? a.weight))
    .slice(0, MAX_COMPARABLES);

  if (retained.length === 0) return;

  sectionTitle(doc, "Ventes comparables retenues");

  const columns = [
    { key: "date", label: "Date", width: 50, align: "left" as const },
    { key: "address", label: "Adresse", width: 158, align: "left" as const },
    { key: "type", label: "Type", width: 55, align: "left" as const },
    { key: "area", label: "Surface", width: 48, align: "right" as const },
    { key: "price", label: "Prix", width: 72, align: "right" as const },
    { key: "perSqm", label: "€/m²", width: 62, align: "right" as const },
    { key: "distance", label: "Dist.", width: 40, align: "right" as const },
  ];

  const rowHeight = 17;
  doc.ensureSpace(rowHeight * 2);

  // Header row.
  let headerY = doc.y;
  doc.fillRect(doc.margin, headerY, doc.contentWidth, rowHeight, SOFT);
  let x = doc.margin + 6;
  for (const column of columns) {
    doc.text(column.label, x, headerY + 12, {
      font: "Helvetica-Bold",
      size: 8.5,
      color: BRAND_DEEP,
      align: column.align,
      width: column.width - 12,
    });
    x += column.width;
  }
  doc.y = headerY + rowHeight;

  for (const comparable of retained) {
    if (doc.y + rowHeight > A4.height - doc.margin - 40) {
      doc.addPage();
      headerY = doc.y;
      doc.fillRect(doc.margin, headerY, doc.contentWidth, rowHeight, SOFT);
      let hx = doc.margin + 6;
      for (const column of columns) {
        doc.text(column.label, hx, headerY + 12, {
          font: "Helvetica-Bold",
          size: 8.5,
          color: BRAND_DEEP,
          align: column.align,
          width: column.width - 12,
        });
        hx += column.width;
      }
      doc.y = headerY + rowHeight;
    }

    const values = comparableRow(comparable);
    let cx = doc.margin + 6;
    for (const column of columns) {
      const raw = values[column.key] ?? "–";
      const text = doc.truncate(raw, "Helvetica", 8.5, column.width - 12);
      doc.text(text, cx, doc.y + 12, {
        font: "Helvetica",
        size: 8.5,
        color: INK,
        align: column.align,
        width: column.width - 12,
      });
      cx += column.width;
    }
    doc.y += rowHeight;
    doc.line(doc.margin, doc.y, doc.margin + doc.contentWidth, doc.y, RULE, 0.4);
  }

  doc.y += 8;
  doc.paragraph(disclaimers.dvfLimits, { size: 8.5, color: MUTED, lineHeight: 11.5 });
  doc.y += 12;
}

function comparableRow(c: Comparable): Record<string, string> {
  const t = c.transaction;
  return {
    date: formatMonthYear(t.date),
    address: t.addressLabel ? `${t.addressLabel}, ${t.city}` : t.city,
    type: DVF_TYPE_LABELS[t.propertyType],
    area: t.builtArea ? formatArea(t.builtArea) : "–",
    price: formatPrice(t.price),
    perSqm: t.pricePerSqm ? formatPricePerSqm(t.pricePerSqm) : "–",
    distance: formatDistance(c.distance),
  };
}

function drawMethodology(doc: PdfWriter, v: ValuationResult): void {
  sectionTitle(doc, "Méthodologie");

  const rejected = v.diagnostics.rejected
    .filter((r) => r.count > 0)
    .map((r) => `${r.reason} (${r.count})`)
    .join(", ");

  const lines = [
    `Méthode par comparaison. ${formatNumber(v.diagnostics.candidatesFound)} mutations ont été ` +
      `examinées dans un rayon de ${formatDistance(v.diagnostics.radiusUsed)} autour du bien ; ` +
      `${formatNumber(v.diagnostics.retained)} ont été retenues comme comparables.`,
    rejected ? `Écartées : ${rejected}.` : "",
    v.diagnostics.yearRange
      ? `Millésimes DVF utilisés : ${v.diagnostics.yearRange[0]} à ${v.diagnostics.yearRange[1]}.`
      : "",
    "Chaque comparable est pondéré selon sa distance au bien, l'ancienneté de la mutation, " +
      "l'écart de surface et la similarité de type. Le prix au m² retenu est la moyenne pondérée " +
      "des prix au m² des comparables ; la fourchette reflète leur dispersion.",
  ].filter((line) => line !== "");

  for (const line of lines) {
    doc.paragraph(line, { size: 9.5, color: INK, lineHeight: 13 });
    doc.y += 4;
  }

  if (v.confidence.factors.length > 0) {
    doc.y += 4;
    doc.text("Facteurs de confiance", doc.margin, doc.y + 11, {
      font: "Helvetica-Bold",
      size: 9.5,
      color: INK,
    });
    doc.y += 15;
    for (const factor of v.confidence.factors) {
      const marker = factor.impact === "positive" ? "+" : factor.impact === "negative" ? "–" : "·";
      doc.paragraph(`${marker} ${factor.label}`, {
        x: doc.margin + 8,
        width: doc.contentWidth - 8,
        size: 9,
        color: MUTED,
        lineHeight: 12.5,
      });
    }
  }
  doc.y += 12;
}

function drawDisclaimer(doc: PdfWriter): void {
  doc.ensureSpace(90);
  sectionTitle(doc, "Ce que cette estimation n'est pas");
  doc.paragraph(disclaimers.long, { size: 8.5, color: MUTED, lineHeight: 11.5 });
  doc.y += 8;
  doc.paragraph(disclaimers.dvfSource, { size: 8.5, color: MUTED, lineHeight: 11.5 });
}

function drawFooters(doc: PdfWriter): void {
  doc.onEachPage((index, count) => {
    const y = A4.height - 30;
    doc.line(doc.margin, y - 12, doc.margin + doc.contentWidth, y - 12, RULE, 0.4);
    doc.text(`${siteConfig.name}, estimation statistique et non contractuelle`, doc.margin, y, {
      font: "Helvetica",
      size: 8,
      color: MUTED,
    });
    doc.text(`Page ${index + 1} / ${count}`, doc.margin, y, {
      font: "Helvetica",
      size: 8,
      color: MUTED,
      align: "right",
      width: doc.contentWidth,
    });
  });
}

function sectionTitle(doc: PdfWriter, label: string): void {
  doc.ensureSpace(34);
  doc.y += 8;
  doc.text(label, doc.margin, doc.y + 12, { font: "Helvetica-Bold", size: 11.5, color: BRAND_DEEP });
  doc.y += 18;
  doc.line(doc.margin, doc.y, doc.margin + doc.contentWidth, doc.y, RULE, 0.6);
  doc.y += 6;
}
