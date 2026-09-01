/**
 * Seller-lead scoring, 0 → 100.
 *
 * What the score answers: "how likely is it that a local professional turns this
 * contact into a mandate in the next quarter?" — nothing else. It is NOT a
 * measure of the person, and it never mixes in a signal we did not collect
 * explicitly.
 *
 * The five bands are additive and capped, so the maximum is exactly 100 and the
 * breakdown is readable by a non-technical user (the pro UI renders it verbatim):
 *
 *   intention de projet   0 → 40   le signal dominant, et de loin
 *   consentement pro      0 → 25   sans lui, le lead est incommercialisable
 *   complétude du dossier 0 → 20   un dossier vide ne se travaille pas
 *   valeur estimée        0 → 10   proxy de la commission potentielle
 *   fraîcheur             0 →  5   un lead de trois mois est un lead froid
 *
 * LA BANDE « VALEUR » NE SE NOURRIT QUE DE CE QUE NOUS AVONS CALCULÉ.
 * Les quatre autres bandes portent sur ce que la personne déclare légitimement
 * sur elle-même : son intention, son accord, son téléphone, la date de sa
 * demande. Se tromper sur l'une coûte un lead mal classé. La valeur du bien,
 * elle, est la seule bande qui porte sur un CHIFFRE, donc la seule qu'il soit
 * rentable de gonfler : « je suis propriétaire d'une villa à deux millions »
 * est gratuit à écrire dans un corps de requête, et vaudrait dix points.
 *
 * D'où le nom du champ, `verifiedValue` plutôt que `estimatedValue` : il dit
 * d'où le nombre doit venir. Depuis que les estimations sont rangées dans
 * `estimation_results`, la valeur peut être RELUE dans notre base, où elle a
 * été écrite par notre moteur à partir des ventes DVF. Elle redevient alors une
 * donnée que nous avons produite, et non une déclaration que nous croyons sur
 * parole. Un appelant qui recopierait ici une valeur venue du réseau
 * réintroduirait la faille à lui tout seul, et le nom du champ est là pour que
 * personne ne le fasse par distraction.
 */

import type { PropertyFeatures, ProjectIntent } from "@/types/property";
import type { Lead } from "@/types/lead";

export interface LeadScoreBreakdownItem {
  label: string;
  points: number;
}

export interface LeadScoreResult {
  score: number;
  breakdown: LeadScoreBreakdownItem[];
}

export interface LeadScoreInput {
  intent: ProjectIntent;
  consents: {
    estimationDelivery: boolean;
    professionalContact: boolean;
    marketing?: boolean;
  };
  contact?: {
    phone?: string;
    lastName?: string;
  };
  features?: PropertyFeatures;
  /**
   * Valeur centrale, en euros, RELUE DEPUIS NOTRE BASE (ou portée par un
   * `Lead` déjà enregistré). Jamais lue dans un corps de requête : voir
   * l'en-tête. Absente quand aucune estimation ne nous appartient, auquel cas
   * la bande vaut zéro plutôt que d'accorder des points sur parole.
   */
  verifiedValue?: number;
  /** ISO timestamp of collection. Defaults to `now`. */
  createdAt?: string;
  /** Injected in tests so freshness is deterministic. */
  now?: Date;
}

/**
 * Ordered from coldest to hottest. Exported because the pro UI explains the
 * scale, and because the test pins the monotonicity of this exact order.
 */
export const INTENT_SCORE_ORDER: readonly ProjectIntent[] = [
  "curiosity",
  "other",
  "buying",
  "investment",
  "inheritance",
  "selling_considering",
  "selling_under_6m",
  "selling_under_3m",
] as const;

const INTENT_POINTS: Record<ProjectIntent, number> = {
  curiosity: 0,
  other: 4,
  buying: 6,
  investment: 10,
  inheritance: 18,
  selling_considering: 22,
  selling_under_6m: 32,
  selling_under_3m: 40,
};

export const LEAD_SCORE_MAX_POINTS = {
  intent: 40,
  professionalContact: 25,
  completeness: 20,
  value: 10,
  freshness: 5,
} as const;

/** A phone number is only a signal if it plausibly is one. */
function hasUsablePhone(phone: string | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9;
}

function completenessPoints(
  contact: LeadScoreInput["contact"],
  features: PropertyFeatures | undefined,
): number {
  let points = 0;
  if (hasUsablePhone(contact?.phone)) points += 8;
  if (contact?.lastName && contact.lastName.trim().length > 1) points += 2;
  if (features?.livingArea && features.livingArea > 0) points += 4;
  if (features?.rooms && features.rooms > 0) points += 3;
  if (features?.condition) points += 3;
  return Math.min(points, LEAD_SCORE_MAX_POINTS.completeness);
}

/**
 * Coarse steps rather than a continuous curve: the difference between a 340 k€
 * and a 360 k€ property is noise, the difference between 200 k€ and 1 M€ is not.
 */
function valuePoints(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1_000_000) return 10;
  if (value >= 600_000) return 8;
  if (value >= 350_000) return 6;
  if (value >= 180_000) return 4;
  return 2;
}

function freshnessPoints(createdAt: string | undefined, now: Date): number {
  if (!createdAt) return LEAD_SCORE_MAX_POINTS.freshness;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return LEAD_SCORE_MAX_POINTS.freshness;

  const ageMs = Math.max(0, now.getTime() - created);
  const days = ageMs / 86_400_000;
  if (days < 1) return 5;
  if (days < 7) return 4;
  if (days < 30) return 2;
  if (days < 90) return 1;
  return 0;
}

const INTENT_LABELS_SHORT: Record<ProjectIntent, string> = {
  curiosity: "Simple curiosité",
  other: "Projet non précisé",
  buying: "Projet d'achat",
  investment: "Projet d'investissement",
  inheritance: "Succession",
  selling_considering: "Vente envisagée",
  selling_under_6m: "Vente sous 6 mois",
  selling_under_3m: "Vente sous 3 mois",
};

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const now = input.now ?? new Date();

  const intent = INTENT_POINTS[input.intent] ?? 0;
  const consent = input.consents.professionalContact
    ? LEAD_SCORE_MAX_POINTS.professionalContact
    : 0;
  const completeness = completenessPoints(input.contact, input.features);
  const value = valuePoints(input.verifiedValue);
  const freshness = freshnessPoints(input.createdAt, now);

  const breakdown: LeadScoreBreakdownItem[] = [
    { label: `Intention : ${INTENT_LABELS_SHORT[input.intent]}`, points: intent },
    {
      label: input.consents.professionalContact
        ? "Accepte d'être contacté par un professionnel"
        : "Refuse le contact professionnel",
      points: consent,
    },
    { label: "Complétude du dossier", points: completeness },
    { label: "Valeur estimée du bien", points: value },
    { label: "Fraîcheur de la demande", points: freshness },
  ];

  const raw = breakdown.reduce((sum, item) => sum + item.points, 0);
  // Clamp defensively: the bands already sum to 100, but a future band must not
  // be able to produce an out-of-contract score silently.
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return { score, breakdown };
}

/** Convenience wrapper for a lead already assembled. */
export function scoreExistingLead(lead: Lead, features?: PropertyFeatures): LeadScoreResult {
  const central =
    lead.estimatedLow !== undefined && lead.estimatedHigh !== undefined
      ? (lead.estimatedLow + lead.estimatedHigh) / 2
      : (lead.estimatedHigh ?? lead.estimatedLow);

  return scoreLead({
    intent: lead.intent,
    consents: lead.consents,
    contact: { phone: lead.contact.phone, lastName: lead.contact.lastName },
    features: features ?? (lead.livingArea ? { livingArea: lead.livingArea } : undefined),
    // La fourchette d'un `Lead` a déjà été écrite par nous, au moment de la
    // demande, depuis une estimation relue en base : elle est donc vérifiée au
    // même titre. Rescorer un prospect ne rouvre pas la porte au corps de
    // requête.
    verifiedValue: central,
    createdAt: lead.createdAt,
  });
}

export type LeadTemperature = "cold" | "warm" | "hot";

/** Bands used by the pro marketplace to colour a lead card. */
export function leadTemperature(score: number): LeadTemperature {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}
