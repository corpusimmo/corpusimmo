/**
 * Plain-French narration of a valuation.
 *
 * The text produced here is quoted verbatim on the result page and in the PDF.
 * It must be readable by someone who has never opened a spreadsheet, and it
 * must never claim more than the computation actually established — hence the
 * closing sentence, which always restates that this is an estimate, not an
 * expertise.
 *
 * `ValuationResult` has no field for this string on purpose: the explanation is
 * a pure function of the result, so it can never drift out of sync with it.
 */

import {
  formatArea,
  formatDistance,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import type { PropertyType } from "@/types/property";
import type { ValuationResult } from "@/types/valuation";
import { areaBasisFor, subjectArea } from "./comparables";
import { computeAdjustments, isPoorlyCoveredByDvf } from "./engine";

/**
 * Demonstrative + label per type. Spelled out rather than derived: French
 * gender, elision and the plural "bureaux" cannot be inferred from the label,
 * and "ce appartement" in front of a user is not acceptable.
 */
const SUBJECT_DEMONSTRATIVE: Record<PropertyType, string> = {
  apartment: "cet appartement",
  house: "cette maison",
  land: "ce terrain",
  building: "cet immeuble",
  parking: "ce parking",
  retail: "ce commerce",
  office: "ces bureaux",
  business_premises: "ce local professionnel",
  other: "ce bien",
};

/** 3 to 6 sentences describing how the number was obtained. */
export function explainValuation(result: ValuationResult): string {
  if (result.status !== "computed" || !result.value) {
    return explainFailure(result);
  }

  const sentences: string[] = [
    describeSample(result),
    describeFiltering(result),
    describePricePerSqm(result),
  ];

  const adjustmentSentence = describeAdjustments(result);
  if (adjustmentSentence) sentences.push(adjustmentSentence);

  const coverageSentence = describeCoverageCaveat(result);
  if (coverageSentence) sentences.push(coverageSentence);

  sentences.push(describeRange(result));

  return sentences.join(" ");
}

// ---------------------------------------------------------------------------

function describeSample(result: ValuationResult): string {
  const subjectLabel = SUBJECT_DEMONSTRATIVE[result.subject.type];
  const area = subjectArea(result.subject);
  const areaLabel = area === undefined ? "" : ` de ${formatArea(area)}`;
  const retained = result.diagnostics.retained;
  const radius = formatDistance(result.diagnostics.radiusUsed);
  const years = result.diagnostics.yearRange;

  // DVF is published twice a year (April and October) with roughly a six-month
  // lag, so we anchor the sentence on the data's own horizon instead of letting
  // the reader assume this is a live market feed.
  const period =
    years === undefined
      ? ""
      : years[0] === years[1]
        ? `, enregistrées en ${years[0]}`
        : `, enregistrées entre ${years[0]} et ${years[1]}`;

  return `Nous avons comparé ${subjectLabel}${areaLabel} à ${retained} ${plural(retained, "vente réelle", "ventes réelles")} dans un rayon de ${radius}${period}. Les DVF n'étant publiées que deux fois par an, avec environ six mois de décalage, les toutes dernières semaines du marché n'y figurent pas encore.`;
}

function describeFiltering(result: ValuationResult): string {
  const found = result.diagnostics.candidatesFound;
  const rejected = result.diagnostics.rejected;

  if (found <= result.diagnostics.retained || rejected.length === 0) {
    return "Chacune de ces ventes porte sur un bien du même type et d'une surface proche de la vôtre.";
  }

  const dropped = rejected.reduce((acc, r) => acc + r.count, 0);
  const topReasons = rejected
    .slice(0, 3)
    .map((r) => r.reason.toLowerCase())
    .join(", ");

  return `Sur les ${found} mutations trouvées autour de l'adresse, ${dropped} ont été écartées parce qu'elles n'étaient pas comparables (${topReasons}).`;
}

function describePricePerSqm(result: ValuationResult): string {
  const basis = areaBasisFor(result.subject.type);
  const unit = basis === "land" ? "du terrain" : "habitable";
  const weighted = formatPricePerSqm(result.pricePerSqm);
  const median = result.medianPricePerSqm;

  const medianPart =
    median === undefined
      ? ""
      : `Le prix médian brut de ces ventes ressort à ${formatPricePerSqm(median)}. `;

  return `${medianPart}Après pondération de chaque vente selon sa distance, son ancienneté, sa surface et sa typologie, nous retenons ${weighted} de surface ${unit}.`;
}

function describeAdjustments(result: ValuationResult): string | null {
  const { items, total, capped } = computeAdjustments(result.subject);
  if (items.length === 0 || Math.abs(total) < 0.001) return null;

  const labels = items.map((i) => i.label.toLowerCase()).join(", ");
  const sign = total > 0 ? "+" : "−";
  const percent = Math.round(Math.abs(total) * 100);
  const cappedNote = capped ? ", correction volontairement plafonnée" : "";

  return `Nous avons ensuite ajusté cette base de ${sign}${percent} % pour tenir compte d'éléments que DVF ne publie pas (${labels})${cappedNote}.`;
}

/**
 * Warning for asset families DVF only partially sees. Silence here would be a
 * lie by omission: the sample can look healthy and still miss most of the
 * market.
 */
function describeCoverageCaveat(result: ValuationResult): string | null {
  if (!isPoorlyCoveredByDvf(result.subject.type)) return null;
  return "Attention : DVF ne recense que les ventes de biens, or une grande partie des transactions d'immobilier d'entreprise se fait par cession de parts de société et n'y apparaît jamais, cette estimation repose donc sur une vision partielle de ce marché.";
}

function describeRange(result: ValuationResult): string {
  const value = result.value;
  if (!value) return "";
  const halfWidth =
    value.central > 0 ? Math.round(((value.high - value.low) / (2 * value.central)) * 100) : 0;

  return `La fourchette de ${formatPrice(value.low)} à ${formatPrice(value.high)}, soit environ ± ${halfWidth} %, reflète la dispersion des prix du secteur, le nombre de ventes disponibles et leur ancienneté : c'est une estimation statistique calculée sur des ventes passées, et non une expertise immobilière.`;
}

function explainFailure(result: ValuationResult): string {
  const reason =
    result.diagnostics.failureReason ??
    "Les données disponibles ne permettent pas de calculer une estimation fiable pour ce bien.";

  return `${reason} Nous préférons ne pas afficher de chiffre plutôt que d'en afficher un que les ventes réelles ne soutiennent pas. Un professionnel local, qui connaît le secteur et peut visiter le bien, reste la meilleure option dans ce cas.`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count > 1 ? pluralForm : singular;
}
