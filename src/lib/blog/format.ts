/**
 * Les dates d'articles, écrites une seule fois pour tout le journal.
 *
 * Le fuseau est FORCÉ à UTC partout. Une date d'article est un jour, pas un
 * instant&nbsp;: laisser `Intl` appliquer le fuseau de la machine ferait
 * afficher « 14 septembre » à un build lancé depuis un serveur à l'ouest, pour
 * un article daté du 15. Le décalage se verrait dans la page, dans le flux et
 * dans le plan du site, jamais au même endroit.
 */

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function atMidnightUtc(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** « 15 septembre 2026 ». Rend le jour brut si la date est illisible, plutôt que « Invalid Date ». */
export function formatBlogDate(day: string): string {
  const date = atMidnightUtc(day);
  if (Number.isNaN(date.getTime())) return day;
  return LONG_DATE.format(date);
}

/** L'instant ISO complet, pour l'attribut `dateTime` et les métadonnées Open Graph. */
export function blogDateTime(day: string): string {
  const date = atMidnightUtc(day);
  return Number.isNaN(date.getTime()) ? day : date.toISOString();
}

/** La date au format RFC 822 qu'attend `<pubDate>` dans un flux RSS. */
export function blogRssDate(day: string): string {
  const date = atMidnightUtc(day);
  return Number.isNaN(date.getTime()) ? day : date.toUTCString();
}
