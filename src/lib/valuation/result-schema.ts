/**
 * Contrat zod du `ValuationResult` REMONTANT.
 *
 * POURQUOI VALIDER UN OBJET QUE NOUS AVONS NOUS-MÊMES PRODUIT
 *   Parce qu'il fait un aller-retour par le navigateur. Aucun résultat n'étant
 *   stocké dans cette version, la page renvoie l'objet qu'elle détient pour
 *   fabriquer le PDF (`POST /api/estimation/pdf`) ou pour joindre l'estimation
 *   à un contact (`POST /api/leads`). Entre-temps, il a quitté le serveur : il
 *   redevient donc une entrée non fiable, au même titre qu'un formulaire.
 *
 * La validation reste STRUCTURELLE, sans borne métier : on vérifie qu'un
 * document peut être rendu, pas que les chiffres sont ceux du moteur. Personne
 * ne gagne rien à se fabriquer une estimation flatteuse pour son propre PDF —
 * le document dit d'où il vient et ce qu'il vaut. En revanche, le score de lead
 * n'utilise JAMAIS la valeur qui transite par ici : voir `api/leads/route.ts`.
 */

import { z } from "zod";
import type { ValuationResult } from "@/types/valuation";
import { projectIntentSchema, propertyDraftSchema } from "./request-schema";

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const transactionSchema = z.object({
  id: z.string().min(1).max(200),
  date: z.string().min(4).max(40),
  year: z.number().int().min(1900).max(2200),
  nature: z.enum([
    "sale",
    "sale_off_plan",
    "sale_land_to_build",
    "exchange",
    "auction",
    "expropriation",
    "other",
  ]),
  price: z.number().min(0),
  propertyType: z.enum(["apartment", "house", "land", "commercial", "dependency", "other"]),
  propertyTypeLabel: z.string().max(200).optional(),
  builtArea: z.number().positive().optional(),
  landArea: z.number().positive().optional(),
  rooms: z.number().int().min(0).optional(),
  addressLabel: z.string().max(400).optional(),
  postcode: z.string().max(10).optional(),
  city: z.string().max(200),
  cityCode: z.string().max(10),
  departmentCode: z.string().max(5),
  coordinates: latLngSchema,
  pricePerSqm: z.number().min(0).optional(),
  isMultiLot: z.boolean(),
  lotCount: z.number().int().min(0).optional(),
  source: z.string().min(1).max(40),
});

const comparableSchema = z.object({
  transaction: transactionSchema,
  distance: z.number().min(0),
  ageMonths: z.number().min(0),
  scores: z.object({
    distance: z.number(),
    recency: z.number(),
    area: z.number(),
    type: z.number(),
  }),
  weight: z.number().min(0),
  manualWeight: z.number().min(0).optional(),
  excluded: z.boolean(),
  exclusionReason: z.string().max(400).optional(),
  comment: z.string().max(2_000).optional(),
});

export const valuationResultSchema = z.object({
  id: z.string().min(1).max(200),
  method: z.enum(["comparison", "capitalization", "dcf", "replacement_cost"]),
  status: z.enum(["draft", "computed", "failed"]),
  createdAt: z.string().min(4).max(60),

  subject: propertyDraftSchema,
  intent: projectIntentSchema.optional(),

  value: z
    .object({ low: z.number(), central: z.number(), high: z.number() })
    .optional(),
  pricePerSqm: z.number().optional(),
  medianPricePerSqm: z.number().optional(),
  averagePricePerSqm: z.number().optional(),

  confidence: z.object({
    score: z.number().min(0).max(100),
    level: z.enum(["low", "moderate", "high"]),
    factors: z
      .array(
        z.object({
          label: z.string().max(400),
          impact: z.enum(["positive", "neutral", "negative"]),
        }),
      )
      .max(40),
  }),

  // Le moteur en retient une dizaine ; la borne empêche un corps de requête de
  // faire fabriquer un PDF de mille pages.
  comparables: z.array(comparableSchema).max(120),

  diagnostics: z.object({
    radiusUsed: z.number().min(0),
    candidatesFound: z.number().int().min(0),
    rejected: z.array(z.object({ reason: z.string().max(200), count: z.number().int().min(0) })).max(40),
    retained: z.number().int().min(0),
    dispersion: z.number().optional(),
    yearRange: z.tuple([z.number(), z.number()]).optional(),
    failureReason: z.string().max(600).optional(),
  }),
});

/** `null` plutôt qu'une exception : l'appelant répond 400, il ne plante pas. */
export function parseValuationResult(input: unknown): ValuationResult | null {
  const parsed = valuationResultSchema.safeParse(input);
  return parsed.success ? (parsed.data as ValuationResult) : null;
}
