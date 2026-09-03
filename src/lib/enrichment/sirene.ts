/**
 * Ce qui se passe RÉELLEMENT à cette adresse, d'après les établissements
 * déclarés au répertoire SIRENE.
 *
 * ── À QUOI ÇA SERT ─────────────────────────────────────────────────────────
 * DVF range bureaux, boutiques, entrepôts et ateliers dans un unique « local
 * industriel, commercial ou assimilé ». Les activités déclarées à l'adresse
 * permettent de deviner lequel — sans jamais le certifier.
 *
 * ── LA SOURCE ──────────────────────────────────────────────────────────────
 * `recherche-entreprises.api.gouv.fr`, l'API ouverte de la DINUM au-dessus du
 * répertoire SIRENE de l'INSEE. Pas de clé, pas de quota facturé, données
 * publiques. Vérifié avant d'écrire une ligne : `near_point` accepte des
 * coordonnées et un rayon, et renvoie pour chaque établissement son activité
 * principale, son adresse, son état administratif et sa date de fermeture.
 *
 * ── CE QUE ÇA NE DIT PAS ───────────────────────────────────────────────────
 * Trois faiblesses assumées, toutes traitées ici plutôt que masquées :
 *
 *   · la DOMICILIATION. Une adresse peut porter trente sociétés qui n'y ont
 *     jamais mis les pieds. D'où le comptage par famille : ce qui compte est
 *     la famille dominante, pas le nombre brut d'établissements.
 *   · les ÉTABLISSEMENTS FERMÉS. Une boutique disparue garde son inscription.
 *     On écarte donc tout ce qui n'est pas administrativement actif.
 *   · le VOISINAGE. Un rayon, ce n'est pas une adresse. À 40 m en centre-ville
 *     on ramasse l'immeuble d'en face — d'où un rayon volontairement court et
 *     une exigence de majorité nette avant de conclure quoi que ce soit.
 */

import { familyForNaf, type ActivityFamily } from "./naf";

const ENDPOINT = "https://recherche-entreprises.api.gouv.fr/near_point";

/**
 * Rayon de recherche, en kilomètres (l'unité de l'API).
 *
 * 40 m : assez pour couvrir l'emprise d'un immeuble et le décalage du
 * géocodage, trop court pour ramasser la rue d'en face. Au-delà, l'indice se
 * dilue dans le quartier et ne dit plus rien du bien.
 */
const RADIUS_KM = 0.04;

/**
 * Plafond de l'API : `per_page` doit tenir entre 1 et 25, elle répond 400
 * au-delà (vérifié). C'est de toute façon la bonne maille — au-delà on
 * regarderait un quartier, plus un immeuble.
 *
 * À noter : la page compte des SOCIÉTÉS, dont chacune peut porter plusieurs
 * établissements à l'adresse. Le décompte réel se fait donc plus bas.
 */
const MAX_COMPANIES = 25;

/**
 * Part que la famille dominante doit DÉPASSER pour qu'on ose une phrase.
 *
 * Comparaison stricte, et c'est tout l'enjeu : à 50/50 — deux cabinets
 * au-dessus de deux boutiques — annoncer l'un des deux serait tirer à pile ou
 * face. Une égalité parfaite ne conclut pas.
 */
const DOMINANCE_THRESHOLD = 0.5;

/** Sous ce nombre d'établissements retenus, un seul commerçant ferait la loi. */
const MIN_ESTABLISHMENTS = 2;

const TIMEOUT_MS = 4_000;

export interface ActivityHint {
  family: ActivityFamily;
  /** Établissements actifs retenus dans le rayon. */
  count: number;
  /** Combien portent la famille dominante. */
  familyCount: number;
  /** Quelques raisons sociales, pour que le lecteur juge lui-même. */
  examples: string[];
  /** Vrai quand la famille domine assez nettement pour être affichée. */
  conclusive: boolean;
}

interface NearPointEstablishment {
  activite_principale?: string | null;
  etat_administratif?: string | null;
  date_fermeture?: string | null;
}

interface NearPointResult {
  nom_complet?: string | null;
  matching_etablissements?: NearPointEstablishment[] | null;
}

export class SireneError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SireneError";
  }
}

/**
 * Interroge SIRENE autour d'un point et résume ce qu'on y trouve.
 *
 * Renvoie `null` quand il n'y a rien d'exploitable — pas d'établissement
 * actif, ou trop peu pour dire quoi que ce soit. `null` veut dire « je ne sais
 * pas », et l'interface doit alors se taire, pas afficher « inconnu ».
 */
export async function describeActivity(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ActivityHint | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("long", String(lng));
  url.searchParams.set("radius", String(RADIUS_KM));
  url.searchParams.set("per_page", String(MAX_COMPANIES));

  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  }).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SireneError(`SIRENE injoignable (${reason})`, 502);
  });

  if (!response.ok) {
    throw new SireneError(`SIRENE a répondu ${response.status}`, response.status);
  }

  const payload = (await response.json()) as { results?: NearPointResult[] };
  return summarise(payload.results ?? []);
}

/** Séparé du réseau pour être testable sans le toucher. */
export function summarise(results: NearPointResult[]): ActivityHint | null {
  const tally = new Map<ActivityFamily, number>();
  const examples = new Map<ActivityFamily, string[]>();
  let kept = 0;

  for (const company of results) {
    for (const site of company.matching_etablissements ?? []) {
      // Une boutique fermée reste inscrite : elle ne dit plus rien de l'usage.
      if (site.etat_administratif !== "A") continue;
      if (site.date_fermeture) continue;

      const family = familyForNaf(site.activite_principale);
      if (!family) continue;

      kept += 1;
      tally.set(family, (tally.get(family) ?? 0) + 1);

      const name = company.nom_complet?.trim();
      if (name) {
        const list = examples.get(family) ?? [];
        if (list.length < 3 && !list.includes(name)) list.push(name);
        examples.set(family, list);
      }
    }
  }

  if (kept < MIN_ESTABLISHMENTS) return null;

  let family: ActivityFamily = "autre";
  let familyCount = 0;
  for (const [candidate, count] of tally) {
    if (count > familyCount) {
      family = candidate;
      familyCount = count;
    }
  }

  return {
    family,
    count: kept,
    familyCount,
    examples: examples.get(family) ?? [],
    // Deux conditions, et les deux comptent : la famille doit dominer, ET être
    // une famille qui veut dire quelque chose. « autre » ne conclut jamais.
    conclusive:
      familyCount / kept > DOMINANCE_THRESHOLD && family !== "autre",
  };
}
