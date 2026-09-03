/**
 * LES RISQUES DE LA PARCELLE, QUE L'ACTE NE DIT PAS.
 *
 * DVF publie un prix, une surface et un point. Il ne dit rien de ce qui rend
 * deux biens identiques inégaux : la zone inondable, l'aléa argile qui fissure
 * les maisons sur semelle, le potentiel radon, l'ancienne station-service d'à
 * côté. Géorisques (BRGM, pour le ministère de la Transition écologique)
 * publie tout cela, en accès libre et sans clé.
 *
 * ── UN SEUL APPEL SUFFIT, ET C'EST VOULU ───────────────────────────────────
 * `resultats_rapport_risque` est l'endpoint qui alimente le rapport officiel
 * « connaître les risques près de chez moi ». Il rend, pour un point, les
 * douze risques naturels et les six risques technologiques d'un coup, chacun
 * avec DEUX statuts : un pour la commune, un pour l'adresse. Interroger les
 * couches une par une (aléa argile, radon, ICPE, CASIAS) donnerait les mêmes
 * conclusions pour cinq fois plus de requêtes, et sans le croisement
 * commune/adresse qui fait tout l'intérêt de la réponse.
 *
 * Un second appel, celui-là facultatif, compte les anciens sites industriels
 * (CASIAS) dans un rayon serré : le rapport se contente de dire « Risque
 * Concerne » pour la pollution des sols dans à peu près toute commune urbaine,
 * ce qui n'apprend rien. Un nombre, lui, est concret.
 *
 * ── LE PIÈGE, ET IL EST GRAVE ──────────────────────────────────────────────
 * Le vocabulaire des statuts distingue trois choses que l'œil confond :
 *
 *   · « Risque Existant » / « Risque Concerne »  → le risque est établi ICI ;
 *   · « Risque non Concerne »                    → il est établi qu'il n'y en a pas ;
 *   · « Risque Inconnu » / « Risque non Connu »  → on NE SAIT PAS.
 *
 * Les deux orthographes de l'inconnu coexistent réellement dans l'API, selon
 * le risque et la commune. Confondre « inconnu » et « pas de risque » serait
 * la faute qui compte : à Lens, le risque minier est « Existant » sur la
 * commune et « Inconnu » à l'adresse. Le rendu ne dira donc jamais « aucun
 * risque » ; il dira, au pire, que le risque n'est pas qualifié à ce point.
 */

const BASE = "https://georisques.gouv.fr/api/v1";

/**
 * Rayon de recherche des anciens sites industriels, en mètres.
 *
 * 500 m : l'échelle du quartier, celle à laquelle un ancien dépôt pèse
 * vraiment sur un terrain. À 1 000 m, un hypercentre en compte des centaines
 * et le chiffre ne mesure plus qu'une densité urbaine.
 */
const CASIAS_RADIUS_M = 500;

const TIMEOUT_MS = 6_000;

export class GeorisquesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GeorisquesError";
  }
}

/** Niveaux d'aléa tels que Géorisques les qualifie, du plus faible au plus fort. */
export type RiskLevel = "faible" | "modéré" | "important";

export type RiskFamily = "naturel" | "technologique";

export interface RiskItem {
  /** Clé technique Géorisques, ex. `retraitGonflementArgile`. */
  key: string;
  /** Libellé rendu par l'API, repris tel quel pour ne pas le réinventer. */
  label: string;
  family: RiskFamily;
  /** `null` quand le risque est établi sans être gradué (ex. inondation). */
  level: RiskLevel | null;
}

export interface RiskReading {
  /** Adresse retenue par le géocodeur de Géorisques, jamais celle de l'acte. */
  address?: string;
  commune?: string;
  /** Le rapport officiel complet, pour qui veut vérifier. */
  reportUrl?: string;
  /** Risques établis au point demandé. */
  atAddress: RiskItem[];
  /**
   * Risques établis sur la commune que la donnée ne qualifie PAS à ce point.
   * Ce n'est pas une absence de risque, c'est une absence de réponse.
   */
  unqualified: RiskItem[];
  /** Anciens sites industriels recensés alentour, quand le compte est connu. */
  formerIndustrialSites?: { count: number; radiusM: number };
}

interface GeorisquesStatus {
  present?: boolean | null;
  libelle?: string | null;
  libelleStatutCommune?: string | null;
  libelleStatutAdresse?: string | null;
}

export interface GeorisquesReport {
  adresse?: { libelle?: string | null } | null;
  commune?: { libelle?: string | null } | null;
  url?: string | null;
  risquesNaturels?: Record<string, GeorisquesStatus> | null;
  risquesTechnologiques?: Record<string, GeorisquesStatus> | null;
}

/**
 * Interroge Géorisques autour d'un point et résume ce qu'on y trouve.
 *
 * Hors du périmètre couvert (en mer, à l'étranger), l'API répond 404 : ce
 * n'est pas une panne, c'est une réponse. On rend `null`, comme pour un point
 * sans risque recensé.
 */
export async function readRisks(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch,
): Promise<RiskReading | null> {
  // L'API attend `longitude,latitude`, dans cet ordre, comme le geo_distance
  // de l'ADEME. L'inverser rend un point au milieu de nulle part, sans erreur.
  const latlon = `${lng},${lat}`;

  const reportUrl = new URL(`${BASE}/resultats_rapport_risque`);
  reportUrl.searchParams.set("latlon", latlon);

  const response = await request(fetchImpl, reportUrl);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GeorisquesError(
      `Géorisques a répondu ${response.status}`,
      response.status,
    );
  }

  const report = (await response.json()) as GeorisquesReport;

  // Le compte des anciens sites industriels enrichit sans porter la fiche :
  // s'il manque, on affiche le reste plutôt que rien.
  const casias = await countFormerIndustrialSites(fetchImpl, latlon).catch(
    () => null,
  );

  return summariseRisks(report, casias);
}

async function request(fetchImpl: typeof fetch, url: URL): Promise<Response> {
  return fetchImpl(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  }).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GeorisquesError(`Géorisques injoignable (${reason})`, 502);
  });
}

/** Nombre d'anciens sites industriels (CASIAS) dans le rayon retenu. */
async function countFormerIndustrialSites(
  fetchImpl: typeof fetch,
  latlon: string,
): Promise<number | null> {
  const url = new URL(`${BASE}/ssp`);
  url.searchParams.set("latlon", latlon);
  url.searchParams.set("rayon", String(CASIAS_RADIUS_M));
  // On ne veut que le total : une seule ligne suffit à l'obtenir.
  url.searchParams.set("page_size", "1");

  const response = await request(fetchImpl, url);
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    casias?: { results?: number | null } | null;
  };
  const count = payload.casias?.results;
  return typeof count === "number" && count >= 0 ? count : null;
}

/**
 * Séparé du réseau pour être testable sans le toucher.
 *
 * Rend `null` quand il n'y a rien à dire : ni risque établi, ni risque laissé
 * sans réponse, ni site industriel recensé. Se taire vaut mieux que meubler.
 */
export function summariseRisks(
  report: GeorisquesReport | null | undefined,
  formerIndustrialSites?: number | null,
): RiskReading | null {
  if (!report) return null;

  const atAddress: RiskItem[] = [];
  const unqualified: RiskItem[] = [];

  const families: [RiskFamily, Record<string, GeorisquesStatus> | null | undefined][] =
    [
      ["naturel", report.risquesNaturels],
      ["technologique", report.risquesTechnologiques],
    ];

  for (const [family, group] of families) {
    for (const [key, status] of Object.entries(group ?? {})) {
      // `present` vaut faux quand le risque ne concerne pas la commune : les
      // deux statuts sont alors nuls, il n'y a rien à en tirer.
      if (!status?.present) continue;

      const label = status.libelle?.trim() || key;
      const address = readStatus(status.libelleStatutAdresse);
      const item: RiskItem = { key, label, family, level: address.level };

      if (address.kind === "established") {
        atAddress.push(item);
        continue;
      }

      // À l'adresse le risque est inconnu, ou explicitement écarté. Seul
      // l'inconnu mérite d'être signalé : « non Concerne » est une réponse.
      if (address.kind === "unknown") {
        const commune = readStatus(status.libelleStatutCommune);
        unqualified.push({ ...item, level: commune.level });
      }
    }
  }

  const sites =
    typeof formerIndustrialSites === "number" && formerIndustrialSites > 0
      ? { count: formerIndustrialSites, radiusM: CASIAS_RADIUS_M }
      : undefined;

  if (atAddress.length === 0 && unqualified.length === 0 && !sites) return null;

  atAddress.sort(bySeverity);
  unqualified.sort(bySeverity);

  return {
    address: report.adresse?.libelle ?? undefined,
    commune: report.commune?.libelle ?? undefined,
    reportUrl: report.url ?? undefined,
    atAddress,
    unqualified,
    formerIndustrialSites: sites,
  };
}

type StatusKind = "established" | "excluded" | "unknown";

/**
 * Traduit un libellé de statut en une décision et, quand il y en a un, un
 * niveau d'aléa.
 *
 * Les libellés relevés sur l'API : « Risque Existant », « Risque Existant -
 * faible | modéré | important », « Risque Concerne », « Risque non Concerne »,
 * « Risque Inconnu », « Risque non Connu », et `null`. L'ordre des tests
 * compte : « non Concerne » contient « Concerne », et « non Connu » contient
 * « Connu ». Chercher la négation d'abord évite d'annoncer un risque là où
 * l'API dit précisément le contraire.
 */
function readStatus(raw: string | null | undefined): {
  kind: StatusKind;
  level: RiskLevel | null;
} {
  if (!raw) return { kind: "unknown", level: null };

  const text = raw.toLowerCase();
  const level = readLevel(text);

  if (text.includes("non concerne")) return { kind: "excluded", level: null };
  if (text.includes("inconnu") || text.includes("non connu")) {
    return { kind: "unknown", level: null };
  }
  if (text.includes("existant") || text.includes("concerne")) {
    return { kind: "established", level };
  }

  // Libellé inédit : on ne devine pas, on le range dans l'inconnu.
  return { kind: "unknown", level: null };
}

function readLevel(text: string): RiskLevel | null {
  if (text.includes("important")) return "important";
  // « modéré » s'écrit accentué dans l'API ; on tolère l'autre graphie au cas
  // où elle apparaîtrait, le coût est nul.
  if (text.includes("modéré") || text.includes("modere")) return "modéré";
  if (text.includes("faible")) return "faible";
  return null;
}

/**
 * Poids d'un risque à l'affichage.
 *
 * Un risque établi sans niveau (une zone inondable, par exemple) n'est pas un
 * risque « faible » : l'API ne le gradue pas parce qu'il est binaire. Il passe
 * donc devant « faible », derrière « important ».
 */
const SEVERITY: Record<string, number> = {
  important: 3,
  modéré: 2,
  faible: 1,
};

export function severityRank(item: RiskItem): number {
  return item.level ? SEVERITY[item.level]! : 2;
}

function bySeverity(a: RiskItem, b: RiskItem): number {
  const gap = severityRank(b) - severityRank(a);
  return gap !== 0 ? gap : a.label.localeCompare(b.label, "fr");
}
