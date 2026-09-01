import "server-only";

/**
 * LA COUCHE DE PERSISTANCE, en un import.
 *
 * `import { listEstimations, isDatabaseConfigured } from "@/lib/db"` suffit.
 * Le schéma reste accessible séparément (`@/lib/db/schema`) parce que
 * l'adaptateur Auth.js en a besoin et qu'il doit pouvoir le prendre sans
 * traîner tout le reste.
 *
 * CE MODULE N'EST PAS ENCORE BRANCHÉ. Rien dans `src/app`, `src/components`
 * ni `src/lib/auth` ne l'appelle : la couche est livrée testée mais inerte, et
 * le branchement (variables d'environnement, adaptateur, bascule des couches
 * navigateur) est décrit pas à pas dans `docs/database.md`.
 */

export { DatabaseNotConfiguredError, getDb, isDatabaseConfigured, tryGetDb } from "./client";
export type { Database } from "./client";

export * from "./queries";

export { isShareToken, newShareToken, SHARE_TOKEN_PATTERN } from "./tokens";
export { normaliseEmail } from "./scopes";
