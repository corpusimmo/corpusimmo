/**
 * LA FORME DU PANIER, telle qu'elle passe entre le navigateur et le compte.
 *
 * Ce module n'est ni client ni serveur, et c'est tout son intérêt : la MÊME
 * fonction valide ce qui sort de `localStorage` et ce qui arrive dans une
 * action serveur. Deux gardes séparées pour une seule forme finiraient par
 * diverger, et la divergence tomberait du côté serveur, c'est-à-dire du côté
 * où l'on écrit dans une base.
 *
 * POURQUOI UNE GARDE ET NON UN SIMPLE `as`. Une action serveur est une route
 * publique : son argument vient du réseau, exactement comme le corps d'un
 * `POST`. Recopier tel quel un objet reçu dans une colonne `jsonb` reviendrait
 * à laisser n'importe qui y ranger n'importe quoi, en quantité. On reconstruit
 * donc la mutation champ par champ, ce qui borne à la fois sa forme et sa
 * taille.
 *
 * ON RECONSTRUIT PLUTÔT QU'ON NE FILTRE : les champs inconnus tombent d'
 * eux-mêmes, sans liste noire à tenir à jour.
 */

import type { DvfMutationNature, DvfPropertyType, DvfSourceId, DvfTransaction } from "@/types/dvf";
import type { PropertyDraft } from "@/types/property";

/**
 * Au-delà, une « sélection » devient un jeu de données et la pondération ne
 * veut plus rien dire. Le même plafond est posé côté base
 * (`src/lib/db/queries/comparables.ts`), pour la même raison.
 */
export const MAX_ITEMS = 50;

/** Bornes de sûreté : une chaîne reçue du réseau n'a aucune raison d'être longue. */
const MAX_ID = 200;
const MAX_LABEL = 400;
const MAX_COMMENT = 2_000;

const SOURCES: readonly DvfSourceId[] = ["geodvf", "cerema", "mock"];

const PROPERTY_TYPES: readonly DvfPropertyType[] = [
  "apartment",
  "house",
  "land",
  "commercial",
  "dependency",
  "other",
];

const NATURES: readonly DvfMutationNature[] = [
  "sale",
  "sale_off_plan",
  "sale_land_to_build",
  "exchange",
  "auction",
  "expropriation",
  "other",
];

/** Une ligne du panier. Structurellement identique à `SavedComparable` côté base. */
export interface ComparableEntry {
  transaction: DvfTransaction;
  /** ISO, et toujours valide après passage par la garde : c'est l'ordre d'affichage. */
  addedAt: string;
  /** Gardé dans le panier mais hors du calcul. */
  excluded: boolean;
  /** Pondération imposée, 0 à 3. Absente = utiliser le poids calculé. */
  manualWeight?: number;
  comment?: string;
}

/** Ce que l'action de synchronisation rend au navigateur. */
export interface CartSync {
  /**
   * Vrai quand le compte fait foi. Faux pour une visite anonyme, sans base, ou
   * avec un jeton antérieur à l'arrivée de la base : le navigateur garde alors
   * la main.
   */
  backed: boolean;
  items: ComparableEntry[];
  /**
   * Le bien de référence attaché au panier, quand le compte en porte un. Nul
   * quand il n'y en a pas : le brouillon du navigateur prend alors le relais.
   */
  subject: PropertyDraft | null;
}

/** Le contrat du moteur : une pondération manuelle vit dans [0, 3]. */
export function normaliseWeight(weight: number | undefined | null): number | undefined {
  if (weight === undefined || weight === null || !Number.isFinite(weight)) return undefined;
  return Math.min(3, Math.max(0, Math.round(weight * 100) / 100));
}

/** Une mutation fraîchement cochée dans l'observatoire. */
export function newEntry(transaction: DvfTransaction, now: Date = new Date()): ComparableEntry {
  return { transaction, addedAt: now.toISOString(), excluded: false };
}

/**
 * L'identifiant d'une mutation, tel que les fournisseurs le préfixent
 * (`geodvf:2024-532458`). Borné : il sert de clé dans une clause `where`.
 */
export function isTransactionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID;
}

/**
 * La date d'ajout, en `Date` utilisable.
 *
 * Le repli sur maintenant n'est pas une commodité : une date illisible écrite
 * dans une colonne `timestamptz` fait échouer l'insertion, et c'est le panier
 * entier qui serait perdu pour une chaîne mal formée.
 */
export function addedAtDate(entry: ComparableEntry, now: Date = new Date()): Date {
  const parsed = Date.parse(entry.addedAt);
  return Number.isFinite(parsed) ? new Date(parsed) : now;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > max) return undefined;
  return trimmed;
}

function positive(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > max) return undefined;
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function coordinates(value: unknown): { lat: number; lng: number } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const point = value as Record<string, unknown>;
  const { lat, lng } = point;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return undefined;
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

/**
 * Une mutation DVF, reconstruite champ par champ.
 *
 * Les champs facultatifs ABSENTS le restent : le contrat d'honnêteté du dépôt
 * dit qu'un champ vaut `undefined` quand la donnée ouverte ne le porte pas, et
 * qu'on ne substitue jamais une valeur devinée. Un `source` inconnu fait en
 * revanche rejeter la ligne entière : ce champ est affiché comme la provenance
 * de la donnée, et lui inventer un repli mentirait à l'écran.
 */
function parseTransaction(input: unknown): DvfTransaction | null {
  if (typeof input !== "object" || input === null) return null;
  const row = input as Record<string, unknown>;

  const id = text(row.id, MAX_ID);
  const date = text(row.date, 40);
  const city = text(row.city, MAX_LABEL);
  const cityCode = text(row.cityCode, 20);
  const departmentCode = text(row.departmentCode, 10);
  const price = positive(row.price, 1e12);
  const point = coordinates(row.coordinates);
  const source = SOURCES.find((candidate) => candidate === row.source);

  if (!id || !date || !city || !cityCode || !departmentCode || price === undefined) return null;
  if (!point || !source) return null;

  const year =
    typeof row.year === "number" && Number.isFinite(row.year)
      ? Math.trunc(row.year)
      : Number.parseInt(date.slice(0, 4), 10);
  if (!Number.isFinite(year)) return null;

  const optional = {
    propertyTypeLabel: text(row.propertyTypeLabel, MAX_LABEL),
    builtArea: positive(row.builtArea, 1e7),
    landArea: positive(row.landArea, 1e9),
    rooms: positive(row.rooms, 500),
    addressLabel: text(row.addressLabel, MAX_LABEL),
    postcode: text(row.postcode, 20),
    pricePerSqm: positive(row.pricePerSqm, 1e7),
    lotCount: positive(row.lotCount, 10_000),
  };

  return {
    id,
    date,
    year,
    nature: oneOf(row.nature, NATURES, "other"),
    price,
    propertyType: oneOf(row.propertyType, PROPERTY_TYPES, "other"),
    city,
    cityCode,
    departmentCode,
    coordinates: point,
    isMultiLot: row.isMultiLot === true,
    source,
    // Les clés absentes ne doivent pas exister, et non valoir `undefined` :
    // `JSON.stringify` les écrirait autrement dans la colonne `jsonb`.
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  };
}

/** Une ligne de panier, ou rien si elle n'a pas la forme attendue. */
export function parseComparableEntry(input: unknown, now: Date = new Date()): ComparableEntry | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;

  const transaction = parseTransaction(record.transaction);
  if (!transaction) return null;

  const addedAt =
    typeof record.addedAt === "string" && Number.isFinite(Date.parse(record.addedAt))
      ? new Date(record.addedAt).toISOString()
      : now.toISOString();

  const manualWeight = normaliseWeight(
    typeof record.manualWeight === "number" ? record.manualWeight : undefined,
  );
  const comment = text(record.comment, MAX_COMMENT);

  return {
    transaction,
    addedAt,
    excluded: record.excluded === true,
    ...(manualWeight === undefined ? {} : { manualWeight }),
    ...(comment === undefined ? {} : { comment }),
  };
}

/**
 * Un panier entier, plafonné et dédoublonné.
 *
 * Une charge corrompue, périmée ou hostile doit dégrader vers un panier vide,
 * jamais faire tomber l'observatoire ni l'action serveur.
 */
export function parseComparableEntries(input: unknown, now: Date = new Date()): ComparableEntry[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const entries: ComparableEntry[] = [];

  for (const candidate of input) {
    if (entries.length >= MAX_ITEMS) break;
    const entry = parseComparableEntry(candidate, now);
    if (!entry || seen.has(entry.transaction.id)) continue;
    seen.add(entry.transaction.id);
    entries.push(entry);
  }

  return entries;
}
