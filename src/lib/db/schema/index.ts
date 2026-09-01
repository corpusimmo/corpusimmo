/**
 * LE SCHÉMA, D'UN SEUL TENANT.
 *
 * Ce module est le point d'entrée que lit `drizzle-kit` pour produire les
 * migrations, et celui que reçoit le client Drizzle. Il ne contient AUCUNE
 * définition : uniquement des réexports, pour que l'ordre des fichiers reste
 * celui des dépendances de clés étrangères et que personne n'ait à deviner
 * lequel importer.
 *
 * IL NE DOIT JAMAIS IMPORTER `server-only`. `drizzle-kit` charge ce fichier
 * hors de Next, dans un simple processus Node : un `import "server-only"` y
 * lèverait, et la génération de migration deviendrait impossible. C'est aussi
 * ce qui rend la FORME du schéma testable sous Vitest, ce qui est l'essentiel
 * de ce qu'on peut vérifier sans base.
 */

export { accounts, sessions, users, verificationTokens } from "./auth";
export type { AccountRow, SessionRow, UserRow } from "./auth";

export { userProfiles } from "./profiles";
export type { UserProfileInsert, UserProfileRow } from "./profiles";

export { toolUnlocks } from "./unlocks";
export type { ToolUnlockInsert, ToolUnlockRow } from "./unlocks";

export { estimationResults, estimations } from "./estimations";
export type {
  EstimationInsert,
  EstimationResultInsert,
  EstimationResultRow,
  EstimationRow,
} from "./estimations";

export { comparableItems, comparableSets } from "./comparables";
export type {
  ComparableItemInsert,
  ComparableItemRow,
  ComparableSetInsert,
  ComparableSetRow,
} from "./comparables";

export { CONSENT_PURPOSES, consents } from "./consents";
export type { ConsentInsert, ConsentPurpose, ConsentRow } from "./consents";

export { contacts, leads } from "./leads";
export type { ContactInsert, ContactRow, LeadInsert, LeadRow } from "./leads";
