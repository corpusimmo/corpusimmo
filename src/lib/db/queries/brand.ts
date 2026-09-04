import "server-only";

/**
 * LA CHARTE D'UN COMPTE — lire et écrire.
 *
 * Même règle que pour le profil, et pour la même raison : `undefined` veut
 * dire « je ne touche pas », `null` veut dire « efface ». Un formulaire de
 * charte enverra souvent la couleur secondaire vide parce que le champ est
 * facultatif ; sans cette distinction, ouvrir puis enregistrer l'écran
 * effacerait le logo déposé la semaine précédente.
 *
 * LA LECTURE NE REND JAMAIS `null`. Elle rend toujours une `Charte` utilisable,
 * celle du compte quand elle est complète, celle de CorpusImmo sinon. C'est
 * `resoudreCharte()` qui tranche, en un seul endroit, et les appelants n'ont
 * donc aucun repli à réécrire. Un document sans identité n'existe pas.
 *
 * LES COULEURS SONT NORMALISÉES À L'ÉCRITURE, pas seulement à l'affichage.
 * Stocker `#ABC` puis le corriger à chaque lecture reviendrait à réparer la
 * même faute mille fois ; on la répare une fois, au moment où quelqu'un la
 * commet, et la base ne contient que du `#rrggbb`.
 */

import { eq } from "drizzle-orm";

import {
  normaliserHex,
  resoudreCharte,
  type Charte,
} from "@/lib/brand/charte";
import { attempt } from "../attempt";
import { getDb, isDatabaseConfigured } from "../client";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { brandProfiles, type BrandProfileRow } from "../schema/brand";

export interface BrandInput {
  /** `undefined` : ne pas toucher. `null` : effacer. */
  companyName?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/**
 * Une couleur invalide est REFUSÉE, jamais silencieusement ignorée.
 *
 * Ignorer laisserait l'ancienne valeur en place et donnerait à l'utilisateur
 * l'impression d'avoir enregistré une couleur qu'il ne reverra jamais.
 */
export class CouleurInvalide extends Error {
  constructor(readonly champ: "principale" | "secondaire") {
    super(`Couleur ${champ} invalide`);
    this.name = "CouleurInvalide";
  }
}

function couleurAEcrire(
  valeur: string | null | undefined,
  champ: "principale" | "secondaire",
): string | null | undefined {
  if (valeur === undefined) return undefined;
  if (valeur === null || valeur.trim() === "") return null;
  const hex = normaliserHex(valeur);
  if (!hex) throw new CouleurInvalide(champ);
  return hex;
}

/** Les champs à écrire, `undefined` retiré : Drizzle écrirait `null` sinon. */
function champsUtiles(input: BrandInput): Record<string, unknown> {
  const brut: Record<string, unknown> = {
    companyName: input.companyName,
    website: input.website,
    logoUrl: input.logoUrl,
    primaryColor: couleurAEcrire(input.primaryColor, "principale"),
    secondaryColor: couleurAEcrire(input.secondaryColor, "secondaire"),
  };
  return Object.fromEntries(
    Object.entries(brut).filter(([, v]) => v !== undefined),
  );
}

function toCharte(row: BrandProfileRow | undefined): Charte {
  return resoudreCharte(
    row
      ? {
          entreprise: row.companyName,
          site: row.website,
          logo: row.logoUrl,
          principale: row.primaryColor,
          secondaire: row.secondaryColor,
        }
      : null,
  );
}

/**
 * La charte à appliquer aux documents de ce compte.
 *
 * Sans base configurée, on rend la charte du produit plutôt que de lever : un
 * export de comparables doit continuer de fonctionner quand la base est
 * absente, c'est une fonctionnalité ouverte sans compte.
 */
export async function readCharte(userId: string): Promise<Charte> {
  if (!isDatabaseConfigured()) return toCharte(undefined);

  // UNE CHARTE ABSENTE NE DOIT PAS ABATTRE UN ÉCRAN. La page des générateurs
  // est publique et fonctionne sans compte : si la lecture échoue, table pas
  // encore migrée ou base indisponible, les documents sortent aux couleurs de
  // CorpusImmo et la panne est journalisée. Ce n'est pas un repli silencieux
  // au sens que le produit s'interdit : on ne substitue aucune donnée de
  // marché, on rend notre propre identité, qui est le repli documenté.
  const { value } = await attempt(
    "lecture de la charte",
    async () =>
      getDb()
        .select()
        .from(brandProfiles)
        .where(eq(brandProfiles.userId, userId))
        .limit(1),
    [] as BrandProfileRow[],
  );

  return toCharte(value[0]);
}

/** Ce que le compte a saisi, tel quel, pour réafficher le formulaire. */
export async function readBrandRow(
  userId: string,
): Promise<BrandProfileRow | null> {
  if (!isDatabaseConfigured()) return null;

  const { value } = await attempt(
    "lecture de la charte enregistrée",
    async () =>
      getDb()
        .select()
        .from(brandProfiles)
        .where(eq(brandProfiles.userId, userId))
        .limit(1),
    [] as BrandProfileRow[],
  );

  return value[0] ?? null;
}

/**
 * Enregistre la charte, et rend celle qui s'applique désormais.
 *
 * Rendre la charte résolue plutôt qu'un simple succès évite à l'appelant de
 * relire juste après pour savoir ce qu'il vient de produire, et lui montre
 * tout de suite si sa saisie a suffi à basculer hors du repli.
 */
export async function upsertCharte(
  userId: string,
  input: BrandInput,
): Promise<WriteOutcome<Charte>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  let champs: Record<string, unknown>;
  try {
    champs = champsUtiles(input);
  } catch (error) {
    return writeFailed("enregistrement de la charte", error);
  }

  if (Object.keys(champs).length === 0) {
    return { stored: true, value: await readCharte(userId) };
  }

  try {
    const [row] = await getDb()
      .insert(brandProfiles)
      .values({ userId, ...champs })
      .onConflictDoUpdate({
        target: brandProfiles.userId,
        set: { ...champs, updatedAt: new Date() },
      })
      .returning();
    return { stored: true, value: toCharte(row) };
  } catch (error) {
    return writeFailed("enregistrement de la charte", error);
  }
}
