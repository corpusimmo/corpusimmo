import "server-only";

/**
 * LA COUCHE DE PERSISTANCE, en un import.
 *
 * `import { listEstimations, isDatabaseConfigured } from "@/lib/db"` suffit.
 * Le schéma reste accessible séparément (`@/lib/db/schema`) parce que
 * l'adaptateur Auth.js en a besoin et qu'il doit pouvoir le prendre sans
 * traîner tout le reste.
 *
 * QUI L'APPELLE, ET POUR QUOI. L'adaptateur Auth.js (`src/lib/auth/config.ts`)
 * y écrit les comptes ; le registre d'accès (`src/lib/access/ledger.ts`) y lit
 * et y verse les déblocages ; `POST /api/estimation` y enregistre les
 * résultats ; les routes de prospects, de lettre d'information et de
 * consentement (`src/lib/leads/persistence.ts`) y déposent la preuve ; et
 * l'espace compte y lit l'historique et le profil. Ce qui reste en navigateur,
 * et pourquoi, est dans `docs/database.md`.
 */

export { DatabaseNotConfiguredError, getDb, isDatabaseConfigured, tryGetDb } from "./client";
export type { Database } from "./client";

export * from "./queries";

export { isShareToken, newShareToken, SHARE_TOKEN_PATTERN } from "./tokens";
export { normaliseEmail } from "./scopes";
