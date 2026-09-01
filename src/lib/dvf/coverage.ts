/**
 * How current the DVF data actually is — and how to say it without lying.
 *
 * The DGFiP publishes DVF TWICE A YEAR (April and October) with roughly a
 * six-month lag on the deeds. Two consequences the UI must never hide:
 *   - the most recent millésime is ALWAYS partial;
 *   - "no sale this year" usually means "not published yet".
 *
 * Every surface that shows a statistic also shows one of these sentences.
 */

const PUBLICATION_MONTHS = "avril et octobre";

/** `Données DVF jusqu'à 2025` — the discreet line shown next to statistics. */
export function coverageLabel(latestYear: number | undefined): string {
  if (latestYear === undefined) return "Couverture DVF inconnue";
  return `Données DVF jusqu'à ${latestYear}`;
}

/** True when `year` is the in-progress millésime, hence necessarily incomplete. */
export function isPartialYear(year: number, now: Date = new Date()): boolean {
  // The lag means even the previous calendar year is only complete once the
  // April publication has landed.
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-based
  if (year >= currentYear) return true;
  return year === currentYear - 1 && currentMonth < 3;
}

/** Full sentence for tooltips and data-provenance blocks. */
export function coverageDisclaimer(latestYear: number | undefined): string {
  const base = `Les valeurs foncières sont publiées deux fois par an (${PUBLICATION_MONTHS}), avec environ six mois de décalage.`;
  if (latestYear === undefined) return base;
  if (isPartialYear(latestYear)) {
    return `${base} Le millésime ${latestYear} est donc partiel : les ventes les plus récentes n'y figurent pas encore.`;
  }
  return `${base} Les ventes postérieures à ${latestYear} ne sont pas encore publiées.`;
}
