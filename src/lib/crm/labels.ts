/**
 * Les libellés affichés pour les valeurs stockées. Partagé entre serveur et
 * client : aucun import de base ici.
 */

import type { ContactStage, DealStage, NoteKind } from "@/lib/db/schema/crm";
import type { BadgeTone } from "@/components/ui";

export const CONTACT_STAGE_LABELS: Record<ContactStage, string> = {
  nouveau: "Nouveau",
  a_contacter: "À contacter",
  en_discussion: "En discussion",
  qualifie: "Qualifié",
  client: "Client",
  perdu: "Perdu",
};

export const CONTACT_STAGE_TONES: Record<ContactStage, BadgeTone> = {
  nouveau: "info",
  a_contacter: "warning",
  en_discussion: "primary",
  qualifie: "accent",
  client: "success",
  perdu: "neutral",
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  decouverte: "Découverte",
  proposition: "Proposition",
  negociation: "Négociation",
  gagne: "Gagné",
  perdu: "Perdu",
};

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: "Note",
  appel: "Appel",
  email: "E-mail",
  rendez_vous: "Rendez-vous",
  system: "Machine",
};

export function formatAmount(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const DAY_TIME = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const DAY = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function formatDateTime(value: Date | null | undefined): string {
  return value ? DAY_TIME.format(value) : "";
}

export function formatDay(value: Date | null | undefined): string {
  return value ? DAY.format(value) : "";
}

export function contactName(contact: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || contact.email;
}
