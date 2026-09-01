/**
 * French formatting helpers.
 *
 * Every price, surface and date in the product goes through here so the app
 * never drifts into mixed conventions (and so tests can pin the output).
 */

const eurCompact = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** `348 000 €` */
export function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "–";
  return eurCompact.format(Math.round(value));
}

/** `348 k€` / `1,85 M€` — for dense tables and map markers. */
export function formatPriceShort(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })} M€`;
  }
  if (abs >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${numberFr.format(Math.round(value))} €`;
}

/** `4 280 €/m²` */
export function formatPricePerSqm(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "–";
  return `${numberFr.format(Math.round(value))} €/m²`;
}

/** `72 m²` */
export function formatArea(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "–";
  return `${numberFr.format(Math.round(value))} m²`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "–";
  return numberFr.format(value);
}

export function formatPercent(value: number | undefined | null, digits = 1): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "–";
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

/** `12 mars 2024` */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** `03/2024` — compact form for comparable tables. */
export function formatMonthYear(iso: string | undefined | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("fr-FR", { month: "2-digit", year: "numeric" });
}

/** `450 m` under a km, `2,4 km` above. */
export function formatDistance(metres: number | undefined | null): string {
  if (metres === undefined || metres === null || !Number.isFinite(metres)) return "–";
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

/** `il y a 3 mois` */
export function formatRelativeMonths(months: number): string {
  if (months < 1) return "ce mois-ci";
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return years === 1 ? "il y a 1 an" : `il y a ${years} ans`;
}
