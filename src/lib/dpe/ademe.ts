/**
 * LE DPE, LÀ OÙ DVF S'ARRÊTE.
 *
 * Notre propre page « à propos » l'écrit noir sur blanc : « DVF ne publie ni
 * l'état intérieur, ni le DPE. » C'est le plus gros trou du corpus, et il se
 * comble avec une source publique : la base des diagnostics de performance
 * énergétique de l'ADEME, 15,5 millions de logements depuis juillet 2021,
 * en accès libre et sans clé.
 *
 * ── LA DIFFICULTÉ, ET ELLE EST RÉELLE ──────────────────────────────────────
 * Une adresse porte PLUSIEURS diagnostics : un par logement, et souvent
 * plusieurs par logement au fil des années. Relevé sur un immeuble nantais à
 * la même adresse : F, C et G. Affirmer « le DPE de ce bien est F » parce que
 * c'est le premier résultat serait donc faux une fois sur trois.
 *
 * D'où deux régimes, et jamais un seul :
 *
 *   · APPARIEMENT. Quand la surface de la mutation retrouve UN diagnostic et
 *     un seul dans une fourchette étroite, on nomme son étiquette, en disant
 *     que c'est un rapprochement.
 *   · PROFIL. Sinon on ne nomme rien : on décrit l'immeuble, c'est-à-dire la
 *     répartition des étiquettes relevées à l'adresse. C'est moins précis,
 *     mais c'est vrai.
 *
 * ── UN PIÈGE DE MESURE ─────────────────────────────────────────────────────
 * `surface_reelle_bati` (DVF) et `surface_habitable_logement` (ADEME) ne
 * mesurent PAS la même chose : la seconde exclut notamment les combles non
 * aménageables et les épaisseurs de murs. Un écart de quelques pourcents est
 * donc normal et n'indique pas deux biens différents. La tolérance en tient
 * compte, et reste volontairement large.
 */

const DATASET = "meg-83tjwtg8dyz4vv7h1dqe";
const ENDPOINT = `https://data.ademe.fr/data-fair/api/v1/datasets/${DATASET}/lines`;

/**
 * Rayon de recherche, en mètres.
 *
 * 60 m couvre l'emprise d'un immeuble et l'imprécision du géocodage des deux
 * bases, sans attraper l'immeuble d'en face. Au-delà, le « profil » cesse de
 * décrire un bâtiment pour décrire une rue.
 */
const RADIUS_M = 60;

/** Assez pour couvrir une copropriété entière, borné par l'API. */
const MAX_RECORDS = 100;

/**
 * Tolérance de surface pour un appariement, en proportion.
 *
 * 8 % : assez pour absorber l'écart entre surface réelle bâtie et surface
 * habitable, trop peu pour confondre un T2 avec un T3.
 */
const AREA_TOLERANCE = 0.08;

const TIMEOUT_MS = 5_000;

export type DpeLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G";

const LABELS: readonly DpeLabel[] = ["A", "B", "C", "D", "E", "F", "G"];

function isLabel(value: unknown): value is DpeLabel {
  return typeof value === "string" && (LABELS as readonly string[]).includes(value);
}

export interface DpeDiagnostic {
  label: DpeLabel;
  ges?: DpeLabel;
  area?: number;
  date?: string;
  address?: string;
  buildingType?: string;
}

export interface DpeReading {
  /** Diagnostics retenus autour du point. */
  count: number;
  /** Répartition des étiquettes, de A à G. */
  distribution: Record<DpeLabel, number>;
  /**
   * Le diagnostic rapproché de la mutation, quand la surface en désigne un
   * seul. `null` veut dire « on ne sait pas », jamais « pas de DPE ».
   */
  matched: DpeDiagnostic | null;
  /** Diagnostic le plus récent à l'adresse, quel que soit le logement. */
  latestDate?: string;
  address?: string;
}

export class AdemeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdemeError";
  }
}

interface AdemeLine {
  adresse_ban?: string | null;
  etiquette_dpe?: string | null;
  etiquette_ges?: string | null;
  surface_habitable_logement?: number | null;
  date_etablissement_dpe?: string | null;
  type_batiment?: string | null;
}

/** Interroge l'ADEME autour d'un point et résume ce qu'on y trouve. */
export async function readDpe(
  lat: number,
  lng: number,
  builtArea?: number,
  fetchImpl: typeof fetch = fetch,
): Promise<DpeReading | null> {
  const url = new URL(ENDPOINT);
  // L'API attend `longitude,latitude,rayon`, dans cet ordre.
  url.searchParams.set("geo_distance", `${lng},${lat},${RADIUS_M}`);
  url.searchParams.set("size", String(MAX_RECORDS));
  url.searchParams.set(
    "select",
    [
      "adresse_ban",
      "etiquette_dpe",
      "etiquette_ges",
      "surface_habitable_logement",
      "date_etablissement_dpe",
      "type_batiment",
    ].join(","),
  );

  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  }).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AdemeError(`ADEME injoignable (${reason})`, 502);
  });

  if (!response.ok) {
    throw new AdemeError(`ADEME a répondu ${response.status}`, response.status);
  }

  const payload = (await response.json()) as { results?: AdemeLine[] };
  return summarise(payload.results ?? [], builtArea);
}

/** Séparé du réseau pour être testable sans le toucher. */
export function summarise(
  lines: AdemeLine[],
  builtArea?: number,
): DpeReading | null {
  const diagnostics: DpeDiagnostic[] = [];

  for (const line of lines) {
    if (!isLabel(line.etiquette_dpe)) continue;
    diagnostics.push({
      label: line.etiquette_dpe,
      ges: isLabel(line.etiquette_ges) ? line.etiquette_ges : undefined,
      area:
        typeof line.surface_habitable_logement === "number" &&
        line.surface_habitable_logement > 0
          ? line.surface_habitable_logement
          : undefined,
      date: line.date_etablissement_dpe ?? undefined,
      address: line.adresse_ban ?? undefined,
      buildingType: line.type_batiment ?? undefined,
    });
  }

  if (diagnostics.length === 0) return null;

  const distribution = Object.fromEntries(
    LABELS.map((label) => [label, 0]),
  ) as Record<DpeLabel, number>;
  for (const d of diagnostics) distribution[d.label] += 1;

  const dates = diagnostics
    .map((d) => d.date)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    count: diagnostics.length,
    distribution,
    matched: matchByArea(diagnostics, builtArea),
    latestDate: dates[dates.length - 1],
    address: diagnostics[0]?.address,
  };
}

/**
 * Le diagnostic que la surface désigne, s'il n'y en a qu'un.
 *
 * Deux conditions, et les deux comptent. Il faut au moins un candidat dans la
 * fourchette, ET tous les candidats doivent porter la même étiquette : deux
 * logements de 65 m² dans le même immeuble, l'un en C et l'autre en F, ne
 * permettent de conclure sur aucun des deux. Le plus récent l'emporte, à
 * étiquette égale, parce qu'un diagnostic périmé décrit un bâtiment d'avant
 * travaux.
 */
function matchByArea(
  diagnostics: DpeDiagnostic[],
  builtArea?: number,
): DpeDiagnostic | null {
  if (!builtArea || builtArea <= 0) return null;

  const candidates = diagnostics.filter(
    (d) =>
      d.area !== undefined &&
      Math.abs(d.area - builtArea) / builtArea <= AREA_TOLERANCE,
  );
  if (candidates.length === 0) return null;

  const labels = new Set(candidates.map((d) => d.label));
  if (labels.size > 1) return null;

  return [...candidates].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  )[0]!;
}

/**
 * Les deux étiquettes qui bornent l'immeuble, pour l'affichage « profil ».
 *
 * Renvoie `null` quand une seule étiquette existe : « de C à C » ne veut rien
 * dire, l'appelant affiche alors l'étiquette seule.
 */
export function labelRange(
  reading: DpeReading,
): { best: DpeLabel; worst: DpeLabel } | null {
  const present = LABELS.filter((label) => reading.distribution[label] > 0);
  if (present.length < 2) return null;
  return { best: present[0]!, worst: present[present.length - 1]! };
}

/** L'unique étiquette présente, quand l'immeuble est homogène. */
export function soleLabel(reading: DpeReading): DpeLabel | null {
  const present = LABELS.filter((label) => reading.distribution[label] > 0);
  return present.length === 1 ? present[0]! : null;
}

/** Couleurs officielles de l'étiquette énergie, du vert au rouge. */
export const DPE_COLORS: Record<DpeLabel, string> = {
  A: "#319834",
  B: "#33cc31",
  C: "#cbfc34",
  D: "#fbfe06",
  E: "#fbcc05",
  F: "#fc9935",
  G: "#fc0205",
};
