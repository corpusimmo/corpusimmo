/**
 * Estimator wizard — state, persistence, validation.
 *
 * Kept apart from the React tree so the homepage can build a deep link, the
 * wizard can restore a session, and both agree on the exact same encoding.
 *
 * Numeric answers are held as strings: an `<input type="number">` bound to a
 * number cannot represent "the user cleared the field", and we must be able to
 * tell "0" from "not answered". Conversion happens once, at submission.
 */

import type { AddressKind, GeoAddress } from "@/types/geo";
import type {
  OutdoorFeature,
  ProjectIntent,
  PropertyCondition,
  PropertyFeatures,
  PropertyType,
} from "@/types/property";
import type { ValuationRequest } from "@/types/valuation";

/**
 * L'ORDRE DES ÉTAPES, et pourquoi il commence par l'usage.
 *
 * La bifurcation résidentiel / professionnel ne change pas des icônes : elle
 * change la MÉTHODE, donc la totalité des questions qui suivent. La poser en
 * premier, c'est ne jamais afficher un champ qui devra être invalidé — on ne
 * demande pas l'étage d'un entrepôt, ni le loyer en place d'un pavillon.
 *
 * L'adresse arrive en troisième position, après le type. Elle reste
 * l'engagement le plus faible qu'on puisse demander, mais deux choix fermés
 * l'ont précédée : le formulaire a déjà montré qu'il savait de quoi il parlait
 * avant de réclamer quoi que ce soit de localisant.
 */
export const WIZARD_STEPS = [
  "Usage",
  "Type de bien",
  "Adresse",
  "Caractéristiques",
  "Votre projet",
  "Vos coordonnées",
] as const;

export const STEP_COUNT = WIZARD_STEPS.length;

/**
 * La bifurcation qui commande tout le reste.
 *
 * Un logement se valorise par comparaison — DVF donne des dizaines de ventes
 * semblables par quartier. Un actif tertiaire se valorise d'abord par le
 * revenu : les mutations professionnelles sont rares, souvent vendues en bloc
 * avec plusieurs lots, et leur prix au m² est inexploitable. Les deux branches
 * ne diffèrent donc pas par leurs icônes mais par leur méthode.
 */
export type PropertyUsage = "residential" | "professional";

/** Les quatre familles proposées en résidentiel. */
export type ResidentialPropertyType = Extract<
  PropertyType,
  "apartment" | "house" | "land" | "other"
>;

/** Les familles proposées côté professionnel. Quatre au plus : au-delà, on hésite. */
export type ProfessionalPropertyType = Extract<
  PropertyType,
  "office" | "retail" | "business_premises" | "land" | "other"
>;

/** Le type retenu, quelle que soit la branche. */
export type WizardPropertyType = ResidentialPropertyType | ProfessionalPropertyType;

/** Occupé ou libre : un immeuble loué ne se valorise pas comme le même immeuble vide. */
export type OccupancyAnswer = "occupied" | "vacant" | "";

/** Precise types offered behind "Autre" — we never guess for the user. */
export const OTHER_PROPERTY_TYPES: PropertyType[] = [
  "building",
  "parking",
  "retail",
  "office",
  "business_premises",
  "other",
];

export type BuildableAnswer = "yes" | "no" | "unknown";

export interface WizardFeatures {
  livingArea: string;
  landArea: string;
  rooms: string;
  bedrooms: string;
  floor: string;
  hasElevator: boolean;
  hasParking: boolean;
  hasGarage: boolean;
  outdoor: OutdoorFeature | "";
  condition: PropertyCondition | "";
  buildable: BuildableAnswer;
  /* ── Propres au tertiaire ─────────────────────────────────────────────── */
  /** Le local peut-il être scindé en plusieurs lots ? Un actif divisible se reloue mieux. */
  divisible: boolean;
  /** Occupé ou libre — décide de la méthode de valorisation. */
  occupancy: OccupancyAnswer;
  /** Loyer annuel en place, quand le bien est occupé. Base de la méthode par le revenu. */
  annualRent: string;
  /** Nombre de places de stationnement, déterminant en périphérie. */
  parkingSpaces: string;
}

export interface WizardContact {
  firstName: string;
  email: string;
  phone: string;
}

export interface WizardConsents {
  /** Required — this is the delivery of the thing the user asked for. */
  estimationDelivery: boolean;
  /** Strictly opt-in, unticked, and never bundled with the one above. */
  professionalContact: boolean;
  marketing: boolean;
}

export interface WizardState {
  step: number;
  address: GeoAddress | null;
  usage: PropertyUsage | null;
  type: WizardPropertyType | null;
  /** Only meaningful when `type === "other"`. */
  otherType: PropertyType | null;
  features: WizardFeatures;
  intent: ProjectIntent | null;
  contact: WizardContact;
  consents: WizardConsents;
}

export const EMPTY_FEATURES: WizardFeatures = {
  livingArea: "",
  landArea: "",
  rooms: "",
  bedrooms: "",
  floor: "",
  hasElevator: false,
  hasParking: false,
  hasGarage: false,
  outdoor: "",
  condition: "",
  buildable: "unknown",
  divisible: false,
  occupancy: "",
  annualRent: "",
  parkingSpaces: "",
};

export const INITIAL_STATE: WizardState = {
  step: 0,
  address: null,
  usage: null,
  type: null,
  otherType: null,
  features: EMPTY_FEATURES,
  intent: null,
  contact: { firstName: "", email: "", phone: "" },
  // No box is ever pre-ticked, including the one we need: consent must be an act.
  consents: { estimationDelivery: false, professionalContact: false, marketing: false },
};

/** Props every step component receives from the wizard. */
export interface StepProps {
  state: WizardState;
  errors: WizardErrors;
  update: (patch: Partial<WizardState>) => void;
  updateFeatures: (patch: Partial<WizardFeatures>) => void;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const ADDRESS_KINDS: readonly string[] = ["housenumber", "street", "locality", "municipality"];

/** Runtime-validates an address coming from a URL or from sessionStorage. */
export function parseGeoAddress(value: unknown): GeoAddress | null {
  if (!isRecord(value)) return null;

  const id = value.id;
  const label = value.label;
  const city = value.city;
  const cityCode = value.cityCode;
  const departmentCode = value.departmentCode;
  const coordinates = value.coordinates;

  if (typeof id !== "string" || typeof label !== "string") return null;
  if (typeof city !== "string" || typeof cityCode !== "string") return null;
  if (typeof departmentCode !== "string" || !isRecord(coordinates)) return null;

  const { lat, lng } = coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const kind =
    typeof value.kind === "string" && ADDRESS_KINDS.includes(value.kind)
      ? (value.kind as AddressKind)
      : "street";

  return {
    id,
    label,
    kind,
    houseNumber: asString(value.houseNumber),
    street: asString(value.street),
    postcode: asString(value.postcode),
    city,
    cityCode,
    departmentCode,
    context: asString(value.context),
    coordinates: { lat, lng },
    score: typeof value.score === "number" ? value.score : 0,
  };
}

const RESIDENTIAL_TYPES: readonly string[] = ["apartment", "house", "land", "other"];

const PROFESSIONAL_TYPES: readonly string[] = [
  "office",
  "retail",
  "business_premises",
  "land",
  "other",
];

export function parseResidentialType(value: unknown): ResidentialPropertyType | null {
  return typeof value === "string" && RESIDENTIAL_TYPES.includes(value)
    ? (value as ResidentialPropertyType)
    : null;
}

/**
 * Accepte les types des DEUX branches.
 *
 * La reprise de session doit rendre exactement l'état quitté : ne reconnaître
 * que les types résidentiels effacerait silencieusement « bureaux » au premier
 * rechargement, et l'étape suivante redemanderait une question déjà répondue.
 */
export function parseWizardType(value: unknown): WizardPropertyType | null {
  if (typeof value !== "string") return null;
  if (RESIDENTIAL_TYPES.includes(value) || PROFESSIONAL_TYPES.includes(value)) {
    return value as WizardPropertyType;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Deep link                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Accueil → estimateur. L'adresse voyage en JSON pour que le parcours démarre
 * avec un `GeoAddress` entièrement résolu — code INSEE compris — et ne
 * re-géocode jamais.
 *
 * Le pas N'EST PAS avancé : l'usage reste la première question, même quand
 * l'adresse est déjà connue. Sauter par-dessus la bifurcation reviendrait à
 * choisir la méthode d'estimation à la place de la personne.
 */
export function buildEstimatorHref(address: GeoAddress | null, usage?: PropertyUsage): string {
  const params = new URLSearchParams();
  if (address) params.set("address", JSON.stringify(address));
  if (usage) params.set("usage", usage);
  const query = params.toString();
  return query ? `/estimer?${query}` : "/estimer";
}

/** Applique `?address=` / `?usage=` sur un état, sans effacer de réponse. */
export function applySearchParams(state: WizardState, params: URLSearchParams): WizardState {
  let next = state;

  const rawAddress = params.get("address");
  if (rawAddress && !next.address) {
    try {
      const parsed = parseGeoAddress(JSON.parse(rawAddress));
      // L'adresse est mémorisée, le pas ne bouge pas : elle sera simplement
      // déjà remplie quand on arrivera à son étape.
      if (parsed) next = { ...next, address: parsed };
    } catch {
      // Un lien mal formé ne doit jamais casser le parcours : on retape.
    }
  }

  const rawUsage = params.get("usage");
  if (!next.usage && (rawUsage === "residential" || rawUsage === "professional")) {
    next = { ...next, usage: rawUsage, step: Math.max(next.step, 1) };
  }

  return next;
}

/* -------------------------------------------------------------------------- */
/* Session persistence                                                         */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "corpusimmo:estimator:v1";

/** sessionStorage, not localStorage: an estimation draft is not a long-term
 *  record, and it carries contact details we do not want to keep around. */
export function loadWizardState(): WizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const features = isRecord(parsed.features) ? parsed.features : {};
    const contact = isRecord(parsed.contact) ? parsed.contact : {};
    const consents = isRecord(parsed.consents) ? parsed.consents : {};

    return {
      step: typeof parsed.step === "number" ? Math.min(Math.max(parsed.step, 0), STEP_COUNT - 1) : 0,
      address: parseGeoAddress(parsed.address),
      usage:
        parsed.usage === "residential" || parsed.usage === "professional" ? parsed.usage : null,
      type: parseWizardType(parsed.type),
      otherType: typeof parsed.otherType === "string" ? (parsed.otherType as PropertyType) : null,
      features: {
        ...EMPTY_FEATURES,
        livingArea: typeof features.livingArea === "string" ? features.livingArea : "",
        divisible: features.divisible === true,
        occupancy:
          features.occupancy === "occupied" || features.occupancy === "vacant"
            ? features.occupancy
            : "",
        annualRent: typeof features.annualRent === "string" ? features.annualRent : "",
        parkingSpaces: typeof features.parkingSpaces === "string" ? features.parkingSpaces : "",
        landArea: typeof features.landArea === "string" ? features.landArea : "",
        rooms: typeof features.rooms === "string" ? features.rooms : "",
        bedrooms: typeof features.bedrooms === "string" ? features.bedrooms : "",
        floor: typeof features.floor === "string" ? features.floor : "",
        hasElevator: features.hasElevator === true,
        hasParking: features.hasParking === true,
        hasGarage: features.hasGarage === true,
        outdoor: typeof features.outdoor === "string" ? (features.outdoor as OutdoorFeature) : "",
        condition:
          typeof features.condition === "string" ? (features.condition as PropertyCondition) : "",
        buildable:
          features.buildable === "yes" || features.buildable === "no" ? features.buildable : "unknown",
      },
      intent: typeof parsed.intent === "string" ? (parsed.intent as ProjectIntent) : null,
      contact: {
        firstName: typeof contact.firstName === "string" ? contact.firstName : "",
        email: typeof contact.email === "string" ? contact.email : "",
        phone: typeof contact.phone === "string" ? contact.phone : "",
      },
      consents: {
        estimationDelivery: consents.estimationDelivery === true,
        professionalContact: consents.professionalContact === true,
        marketing: consents.marketing === true,
      },
    };
  } catch {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing / quota — persistence is a comfort, never a requirement.
  }
}

export function clearWizardState(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/* -------------------------------------------------------------------------- */
/* Numbers                                                                     */
/* -------------------------------------------------------------------------- */

/** Accepts "72", "72,5", " 72 " — returns undefined for anything unusable. */
export function parseNumber(value: string): number | undefined {
  const normalised = value.replace(/\s/g, "").replace(",", ".");
  if (normalised === "") return undefined;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export type WizardErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^(?:\+33|0)\d{9}$/;

function requireArea(
  value: string,
  field: string,
  label: string,
  errors: WizardErrors,
  max = 100_000,
): void {
  const parsed = parseNumber(value);
  if (parsed === undefined) {
    errors[field] = `Indiquez ${label}. C’est la donnée qui pèse le plus dans le calcul.`;
    return;
  }
  if (parsed <= 0) {
    errors[field] = "La surface doit être supérieure à 0 m².";
    return;
  }
  if (parsed > max) {
    errors[field] = `Cette surface paraît hors norme. Vérifiez la valeur saisie (max ${max} m²).`;
  }
}

export function validateStep(step: number, state: WizardState): WizardErrors {
  const errors: WizardErrors = {};

  if (step === 0 && !state.usage) {
    errors.usage = "Indiquez s'il s'agit d'un bien résidentiel ou professionnel.";
  }

  if (step === 1 && !state.type) {
    errors.type = "Sélectionnez le type de bien à estimer.";
  }

  if (step === 2 && !state.address) {
    errors.address = "Choisissez une adresse dans la liste de suggestions pour continuer.";
  }

  if (step === 3) {
    const { features, type } = state;

    if (type === "apartment" || type === "house") {
      requireArea(features.livingArea, "livingArea", "la surface habitable", errors, 5_000);
      const rooms = parseNumber(features.rooms);
      if (rooms === undefined) {
        errors.rooms = "Indiquez le nombre de pièces principales.";
      } else if (rooms < 1 || rooms > 50) {
        errors.rooms = "Le nombre de pièces doit être compris entre 1 et 50.";
      }
      const bedrooms = parseNumber(features.bedrooms);
      if (bedrooms !== undefined && rooms !== undefined && bedrooms > rooms) {
        errors.bedrooms = "Il ne peut pas y avoir plus de chambres que de pièces principales.";
      }
    }

    if (type === "house") {
      const land = parseNumber(features.landArea);
      if (land !== undefined && land <= 0) {
        errors.landArea = "La surface du terrain doit être supérieure à 0 m².";
      }
    }

    if (type === "land") {
      requireArea(features.landArea, "landArea", "la surface du terrain", errors);
    }

    /*
     * Tertiaire — mais SEULEMENT les trois familles bâties.
     *
     * Un terrain professionnel n'a ni surface utile ni locataire : il se décrit
     * par son emprise et sa constructibilité, exactement comme un terrain de
     * particulier, et il passe donc par le bloc « terrain » ci-dessus. Sans
     * cette restriction, la validation réclamait une occupation que l'écran
     * n'affichait pas — une erreur impossible à corriger, qui bloquait le
     * parcours pour de bon.
     */
    const isTertiaryBuilding =
      state.type === "office" || state.type === "retail" || state.type === "business_premises";

    if (state.usage === "professional" && isTertiaryBuilding) {
      requireArea(features.livingArea, "livingArea", "la surface utile", errors, 200_000);
      if (!features.occupancy) {
        errors.occupancy = "Indiquez si le bien est occupé ou libre : la méthode d'estimation en dépend.";
      }
      if (features.occupancy === "occupied") {
        const loyer = parseNumber(features.annualRent);
        if (loyer === undefined || loyer <= 0) {
          errors.annualRent =
            "Indiquez le loyer annuel en place : c'est lui qui fonde l'estimation d'un bien occupé.";
        }
      }
    }

    if (type === "other") {
      if (!state.otherType) {
        errors.otherType = "Précisez la nature du bien.";
      }
      requireArea(features.livingArea, "livingArea", "la surface du bien", errors, 50_000);
    }
  }

  if (step === 4 && !state.intent) {
    errors.intent = "Indiquez le motif de votre demande pour continuer.";
  }

  if (step === 5) {
    const { contact, consents } = state;
    if (contact.firstName.trim().length < 2) {
      errors.firstName = "Indiquez votre prénom (2 caractères minimum).";
    }
    if (!EMAIL_RE.test(contact.email.trim())) {
      errors.email = "Saisissez une adresse e-mail valide, par exemple prenom@exemple.fr";
    }
    const phone = contact.phone.replace(/[\s.\-()]/g, "");
    if (phone.length > 0 && !PHONE_RE.test(phone)) {
      errors.phone = "Numéro non reconnu. Format attendu : 06 12 34 56 78 (facultatif).";
    }
    if (!consents.estimationDelivery) {
      errors.estimationDelivery =
        "Nous avons besoin de cet accord pour vous envoyer votre estimation par e-mail.";
    }
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

export function resolvePropertyType(state: WizardState): PropertyType | null {
  if (state.type === "other") return state.otherType ?? "other";
  return state.type;
}

/** Only answered fields are emitted — an unanswered question stays `undefined`. */
export function toPropertyFeatures(state: WizardState): PropertyFeatures {
  const { features, type } = state;
  const result: PropertyFeatures = {};

  const living = parseNumber(features.livingArea);
  if (living !== undefined) result.livingArea = living;

  const land = parseNumber(features.landArea);
  if (land !== undefined) result.landArea = land;

  const rooms = parseNumber(features.rooms);
  if (rooms !== undefined) result.rooms = rooms;

  const bedrooms = parseNumber(features.bedrooms);
  if (bedrooms !== undefined) result.bedrooms = bedrooms;

  if (type === "apartment") {
    const floor = parseNumber(features.floor);
    if (floor !== undefined) result.floor = floor;
    result.hasElevator = features.hasElevator;
  }

  if (type === "apartment" || type === "house") {
    result.hasParking = features.hasParking;
    if (features.outdoor !== "") result.outdoor = features.outdoor;
  }

  if (type === "house") result.hasGarage = features.hasGarage;

  /*
   * Tertiaire — ce qui passe, et ce qui ne passe pas.
   *
   * `PropertyFeatures` porte `parkingSpots`, donc le nombre de places arrive
   * jusqu'au moteur. L'occupation, le loyer en place et la divisibilité, eux,
   * n'ont AUCUN champ où atterrir : le moteur ne connaît que la comparaison, et
   * la méthode par le revenu n'est pas construite. On les collecte quand même —
   * ils orientent la conversation avec la personne, et ils seront là le jour où
   * la capitalisation existera — mais il faut savoir qu'ils s'arrêtent ici.
   */
  const parkingSpots = parseNumber(features.parkingSpaces);
  if (parkingSpots !== undefined) result.parkingSpots = parkingSpots;

  if (features.condition !== "") result.condition = features.condition;

  // "Je ne sais pas" must stay unknown, never become "non constructible".
  if (type === "land" && features.buildable !== "unknown") {
    result.isBuildable = features.buildable === "yes";
  }

  return result;
}

export function toValuationRequest(state: WizardState): ValuationRequest | null {
  const type = resolvePropertyType(state);
  if (!type || !state.address) return null;

  return {
    subject: {
      type,
      address: state.address,
      features: toPropertyFeatures(state),
    },
    ...(state.intent ? { intent: state.intent } : {}),
  };
}
