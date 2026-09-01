import "server-only";

/**
 * LE PROFIL — lire et écrire ce que la personne nous dit d'elle.
 *
 * Trois fonctions, et une seule décision à retenir : `upsertProfile` ne vide
 * jamais un champ qu'on ne lui a pas explicitement demandé de vider. Un
 * formulaire de compte qui renvoie tous ses champs, dont un resté vide parce
 * qu'il était masqué, effacerait sinon le téléphone donné six mois plus tôt.
 * `undefined` veut dire « je ne touche pas », `null` veut dire « efface ».
 *
 * C'est la distinction que TypeScript rend lisible et que SQL, laissé à
 * lui-même, écrase : `set phone = null` ne sait pas si l'appelant voulait
 * effacer ou n'avait rien à dire.
 */

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "../client";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { userProfiles, type UserProfileRow } from "../schema/profiles";

export interface ProfileInput {
  /** `undefined` : ne pas toucher. `null` : effacer. */
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface StoredProfile {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  updatedAt: Date;
}

function toStored(row: UserProfileRow): StoredProfile {
  return {
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    updatedAt: row.updatedAt,
  };
}

/** Le profil, ou `null` quand la personne n'en a pas encore rempli. */
export async function readProfile(userId: string): Promise<StoredProfile | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await getDb()
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const row = rows[0];
  return row ? toStored(row) : null;
}

/** Crée le profil ou le met à jour, champ par champ. Voir l'en-tête. */
export async function upsertProfile(
  userId: string,
  input: ProfileInput,
  now: Date = new Date(),
): Promise<WriteOutcome<StoredProfile>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  const touched = {
    ...(input.firstName === undefined ? {} : { firstName: clean(input.firstName) }),
    ...(input.lastName === undefined ? {} : { lastName: clean(input.lastName) }),
    ...(input.phone === undefined ? {} : { phone: clean(input.phone) }),
  };

  try {
    const [row] = await getDb()
      .insert(userProfiles)
      .values({ userId, ...touched, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { ...touched, updatedAt: now },
      })
      .returning();

    if (!row) return writeFailed("upsertProfile", new Error("aucune ligne rendue"));
    return { stored: true, value: toStored(row) };
  } catch (error) {
    return writeFailed("upsertProfile", error);
  }
}

/**
 * Une chaîne d'espaces est une absence, pas une valeur.
 *
 * Même raison que `cleanEnv` dans `src/lib/utils/env-value.ts` : un champ de
 * formulaire non rempli arrive comme `""`, et `""` passe silencieusement là où
 * un nom était attendu.
 */
function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
