/**
 * Leads and CRM contracts.
 *
 * A lead is produced by a real consumer estimation (with consent) and — later —
 * offered to professionals. The marketplace UI in `/pro/leads` is mocked for
 * now, but it reads THIS shape so the switch to real data is a repository swap.
 */

import type { ProjectIntent, PropertyType } from "./property";

export type ConsentChannel = "email" | "phone" | "partner_sharing";

export interface LeadConsents {
  /** Required: receive the estimation itself. */
  estimationDelivery: boolean;
  /** Optional: be contacted by a local professional. */
  professionalContact: boolean;
  /** Optional: product news. */
  marketing: boolean;
  /** ISO timestamp of collection — needed for GDPR proof. */
  collectedAt: string;
}

export interface LeadContact {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
}

export type LeadStatus =
  | "new"
  | "qualified"
  | "available"
  | "reserved"
  | "sold"
  | "rejected";

export interface Lead {
  id: string;
  createdAt: string;
  status: LeadStatus;
  contact: LeadContact;
  consents: LeadConsents;

  /** Denormalised snapshot so the marketplace never needs a join. */
  propertyType: PropertyType;
  city: string;
  cityCode: string;
  postcode?: string;
  livingArea?: number;
  intent: ProjectIntent;

  valuationId?: string;
  estimatedLow?: number;
  estimatedHigh?: number;

  /** 0 → 100, computed from intent + completeness + value. */
  score: number;
  scoreBreakdown?: { label: string; points: number }[];
}

/** Marketplace card — what a pro sees BEFORE unlocking a lead. */
export interface LeadListing {
  id: string;
  createdAt: string;
  city: string;
  postcode?: string;
  propertyType: PropertyType;
  livingArea?: number;
  intent: ProjectIntent;
  estimatedLow?: number;
  estimatedHigh?: number;
  score: number;
  priceCredits: number;
  unlocked: boolean;
}

export type CrmStage =
  | "new"
  | "to_contact"
  | "in_discussion"
  | "estimation"
  | "mandate"
  | "won";

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  new: "Nouveau",
  to_contact: "À contacter",
  in_discussion: "En discussion",
  estimation: "Estimation",
  mandate: "Mandat",
  won: "Gagné",
};

export interface CrmDeal {
  id: string;
  stage: CrmStage;
  contactName: string;
  city: string;
  propertyType: PropertyType;
  estimatedValue?: number;
  updatedAt: string;
  ownerInitials: string;
  tags?: string[];
}
