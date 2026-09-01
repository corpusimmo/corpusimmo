import "server-only";

/**
 * LES FONCTIONS D'ACCÈS, rassemblées.
 *
 * Une fonction par INTENTION, jamais un ORM rendu à l'appelant. Aucune page,
 * aucune route ne doit importer `drizzle-orm` ni le client : elles appellent
 * `listEstimations` ou `grantStoredAccess`, et ce module reste seul à savoir
 * qu'il y a des tables derrière. C'est ce qui rendra possible de changer de
 * moteur, de dénormaliser une table ou d'ajouter un cache sans toucher une
 * ligne d'interface.
 *
 * Les réexports sont NOMMÉS et non `export *` : une fonction ajoutée dans un
 * module ne devient publique que si quelqu'un l'a décidé ici.
 */

export {
  grantStoredAccess,
  hasStoredAccess,
  importGrants,
  readStoredAccess,
  WEEKLY_LIMIT,
  type Grant,
  type Quota,
  type StoredAccessState,
  type StoredGrantResult,
} from "./unlocks";

export {
  clearEstimations,
  DEFAULT_PAGE_SIZE,
  forgetEstimation,
  listEstimations,
  listSharedEstimations,
  readEstimation,
  readSharedEstimation,
  saveEstimation,
  shareEstimation,
  unshareEstimation,
  type EstimationSummary,
  type StoredEstimation,
} from "./estimations";

export {
  addComparable,
  clearComparableSet,
  createComparableSet,
  deleteComparableSet,
  listComparableSets,
  MAX_ITEMS,
  readComparableSet,
  readCurrentSet,
  removeComparable,
  setComparableSubject,
  updateComparable,
  type StoredComparableSet,
} from "./comparables";

export {
  CONSENT_PURPOSES,
  currentConsent,
  listConsents,
  recordConsent,
  recordConsents,
  type ConsentInput,
  type ConsentPurpose,
  type StoredConsent,
} from "./consents";

export {
  listLeadsOfContact,
  readContactByEmail,
  recordLead,
  upsertContact,
  type ContactInput,
  type LeadInput,
  type StoredLead,
} from "./leads";

export {
  readProfile,
  upsertProfile,
  type ProfileInput,
  type StoredProfile,
} from "./profiles";

export { eraseUser, forgetEmail, purgeExpired } from "./erasure";

export type { SavedComparable } from "../mappers";
export type { WriteFailure, WriteOutcome } from "../outcome";
