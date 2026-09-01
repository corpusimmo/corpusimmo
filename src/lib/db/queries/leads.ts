import "server-only";

/**
 * LES CONTACTS ET LES PROSPECTS — ce qui manque à `POST /api/leads` pour
 * répondre 201.
 *
 * La route l'écrit noir sur blanc : « Rien n'est persisté : le lead est scoré,
 * l'e-mail part, et la requête répond 202 Accepted ». Elle assume aussi la
 * conséquence sur la note : la bande « valeur estimée » n'est PAS comptée,
 * « parce que la valeur nous arrive du client et qu'un client peut se déclarer
 * propriétaire d'une villa à 2 M€ pour gonfler sa propre note », et la bande
 * « revient le jour où une estimation est relue depuis le stockage ». C'est
 * `estimationId` qui rendra cette relecture possible.
 *
 * LE CONTACT EST UNE MISE À JOUR, LA DEMANDE EST UNE INSERTION.
 *   La même personne peut revenir. Sa fiche se met à jour (elle a peut-être
 *   donné son téléphone cette fois-ci) ; sa demande, elle, s'ajoute. Écraser la
 *   demande précédente perdrait un projet réel, et créer un second contact
 *   dédoublerait la personne dans toutes les listes.
 *
 * ON NE VIDE JAMAIS UN CHAMP DÉJÀ CONNU. Un second formulaire rempli sans le
 * téléphone ne doit pas effacer le téléphone donné au premier : l'absence dans
 * un formulaire est un silence, pas une correction. D'où le `coalesce` explicite
 * plutôt qu'un `set` complet.
 *
 * LE CONSENTEMENT N'EST PAS ICI. Il s'écrit dans `queries/consents.ts`, en
 * ajout seul, avec sa date serveur, son origine et sa version. Un booléen
 * `marketing` posé sur le contact serait l'état courant sans l'histoire, et
 * c'est l'histoire qui se produit en cas de réclamation.
 */

import { desc, sql } from "drizzle-orm";

import type { LeadStatus } from "@/types/lead";
import type { ProjectIntent, PropertyType } from "@/types/property";

import { getDb, isDatabaseConfigured } from "../client";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { contacts, leads } from "../schema/leads";
import { contactOfEmail, leadsOfContact, normaliseEmail } from "../scopes";

export interface ContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Le compte, si la personne est connectée au moment de la demande. */
  userId?: string | null;
}

export interface LeadInput {
  contact: ContactInput;
  /** `estimation`, `rappel`, `aimant:<slug>`… */
  source: string;
  estimationId?: string | null;
  propertyType?: PropertyType;
  city?: string;
  cityCode?: string;
  postcode?: string;
  livingArea?: number;
  intent?: ProjectIntent;
  estimatedLow?: number;
  estimatedHigh?: number;
  /** 0 à 100, tel que `scoreLead()` vient de le produire. */
  score: number;
  scoreBreakdown?: { label: string; points: number }[];
}

export interface StoredLead {
  leadId: string;
  contactId: string;
  createdAt: Date;
  status: LeadStatus;
  score: number;
}

/**
 * Crée ou met à jour la fiche de contact, et rend son identifiant.
 *
 * `onConflictDoUpdate` sur l'adresse : c'est l'index unique `contacts_email_idx`
 * qui fait de l'opération une opération idempotente, sans lecture préalable et
 * donc sans course entre deux formulaires envoyés en même temps.
 */
export async function upsertContact(
  input: ContactInput,
  now: Date = new Date(),
): Promise<WriteOutcome<string>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  const email = normaliseEmail(input.email);

  try {
    const [row] = await getDb()
      .insert(contacts)
      .values({
        email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        userId: input.userId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: contacts.email,
        set: {
          // `coalesce(exclu, existant)` : ce que le nouveau formulaire apporte
          // gagne, ce qu'il tait ne détruit rien. Voir l'en-tête.
          firstName: sql`coalesce(excluded.first_name, ${contacts.firstName})`,
          lastName: sql`coalesce(excluded.last_name, ${contacts.lastName})`,
          phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
          userId: sql`coalesce(excluded.user_id, ${contacts.userId})`,
          updatedAt: now,
        },
      })
      .returning({ id: contacts.id });

    if (!row) return writeFailed("upsertContact", new Error("aucune ligne rendue"));
    return { stored: true, value: row.id };
  } catch (error) {
    return writeFailed("upsertContact", error);
  }
}

/**
 * Enregistre une demande complète : la personne, puis son projet.
 *
 * Deux instructions et pas de transaction (voir `client.ts`). Si la seconde
 * échoue, il reste une fiche de contact sans demande : c'est un contact de plus
 * dans le carnet, pas une donnée fausse. L'inverse serait impossible, la clé
 * étrangère l'interdit.
 */
export async function recordLead(
  input: LeadInput,
  now: Date = new Date(),
): Promise<WriteOutcome<StoredLead>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  const contact = await upsertContact(input.contact, now);
  if (!contact.stored) return contact;

  try {
    const [row] = await getDb()
      .insert(leads)
      .values({
        contactId: contact.value,
        estimationId: input.estimationId ?? null,
        createdAt: now,
        source: input.source,
        propertyType: input.propertyType ?? null,
        city: input.city ?? null,
        cityCode: input.cityCode ?? null,
        postcode: input.postcode ?? null,
        livingArea: input.livingArea ?? null,
        intent: input.intent ?? null,
        estimatedLow: input.estimatedLow ?? null,
        estimatedHigh: input.estimatedHigh ?? null,
        score: input.score,
        scoreBreakdown: input.scoreBreakdown ?? null,
      })
      .returning({ id: leads.id, createdAt: leads.createdAt, status: leads.status });

    if (!row) return writeFailed("recordLead", new Error("aucune ligne rendue"));

    return {
      stored: true,
      value: {
        leadId: row.id,
        contactId: contact.value,
        createdAt: row.createdAt,
        status: row.status,
        score: input.score,
      },
    };
  } catch (error) {
    return writeFailed("recordLead", error);
  }
}

/** La fiche d'une personne, par son adresse. */
export async function readContactByEmail(email: string) {
  if (!isDatabaseConfigured()) return null;

  const rows = await getDb().select().from(contacts).where(contactOfEmail(email)).limit(1);
  return rows[0] ?? null;
}

/** L'historique des demandes d'un contact, la plus récente en premier. */
export async function listLeadsOfContact(contactId: string) {
  if (!isDatabaseConfigured()) return [];

  return getDb()
    .select()
    .from(leads)
    .where(leadsOfContact(contactId))
    .orderBy(desc(leads.createdAt));
}
