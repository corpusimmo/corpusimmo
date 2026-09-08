/** Formats partagés côté client. Aucun accès à l'environnement ici. */

const DAY = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function formatDay(value: Date | null | undefined): string {
  return value ? DAY.format(value) : "";
}

export function memberLabelClient(label: string): string {
  return label;
}
