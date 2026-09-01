import "server-only";

/**
 * LE DROIT À L'EFFACEMENT — une instruction, et tout part.
 *
 * L'article 17 du RGPD ne demande pas qu'on puisse effacer, il demande qu'on
 * efface. La différence tient à ce qu'on oublie : une table ajoutée l'an
 * prochain, rattachée à l'utilisateur, qu'un script d'effacement écrit à la
 * main ne connaîtra pas.
 *
 * D'OÙ LE PARTI PRIS : l'effacement n'est PAS une liste d'instructions, c'est
 * UNE suppression dans `users`, et le schéma fait le reste. Chaque table qui
 * porte une donnée personnelle est reliée à `users` par une chaîne de clés
 * étrangères en `on delete cascade` :
 *
 *     users ─┬─ accounts                     (jetons OAuth)
 *            ├─ sessions                     (sessions ouvertes)
 *            ├─ user_profiles                (nom, prénom, téléphone)
 *            ├─ tool_unlocks                 (déblocages d'outils)
 *            ├─ estimations ─── estimation_results
 *            ├─ comparable_sets ─── comparable_items
 *            ├─ consents                     (registre de consentement)
 *            └─ contacts ─── leads
 *
 * Ajouter une table sans la rattacher à cette arborescence est donc une faute,
 * et `schema.test.ts` la fait échouer : le test énumère les tables et exige que
 * chacune atteigne `users` en cascade.
 *
 * CE QUE LA CASCADE NE COUVRE PAS, et qui est traité à part :
 *   - les `verification_tokens`, qui sont indexés par ADRESSE et non par
 *     compte. Un lien magique en vol au moment de l'effacement survivrait à la
 *     suppression du compte : il est purgé explicitement ;
 *   - les contacts JAMAIS rattachés à un compte, effaçables par leur seule
 *     adresse, puisque c'est le seul identifiant dont on dispose ;
 *   - les données confiées à des tiers. Une liste Brevo ou une audience Resend
 *     ne s'efface pas par une clé étrangère. `forgetEmail` ne touche que NOTRE
 *     base, et l'appelant reste tenu de propager la demande, ce que
 *     `docs/database.md` rappelle.
 *
 * LE REGISTRE DE CONSENTEMENT PART AUSSI. Cela ressemble à détruire une preuve.
 * Le raisonnement est dans `schema/consents.ts` : la preuve d'un consentement
 * ne justifie qu'un traitement en cours ; quand il n'y a plus ni compte, ni
 * contact, ni envoi, il n'y a plus rien à justifier, et garder le registre
 * reviendrait à conserver des données personnelles pour se défendre d'un
 * traitement qui n'existe plus.
 */

import { eq, lt } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "../client";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { sessions, users, verificationTokens } from "../schema/auth";
import { consents } from "../schema/consents";
import { contacts } from "../schema/leads";
import { normaliseEmail } from "../scopes";

/**
 * Efface un compte et tout ce qui s'y rattache.
 *
 * L'adresse est demandée EN PLUS de l'identifiant, pour purger les jetons de
 * lien magique restants — ils sont indexés par adresse. La passer à
 * `undefined` reste possible quand on ne l'a pas ; le compte part alors, et un
 * jeton en vol expirera de lui-même.
 */
export async function eraseUser(
  userId: string,
  email?: string | null,
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    const db = getDb();

    // L'ordre compte : on purge d'abord ce que la cascade n'atteindra pas,
    // parce qu'après la suppression du compte on n'aura plus de quoi le
    // retrouver.
    if (email) {
      const address = normaliseEmail(email);
      await db.delete(verificationTokens).where(eq(verificationTokens.identifier, address));
    }

    await db.delete(users).where(eq(users.id, userId));

    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("eraseUser", error);
  }
}

/**
 * Efface ce qu'on sait d'une adresse SANS compte.
 *
 * Le cas courant d'une demande d'effacement venue de l'extérieur : quelqu'un a
 * demandé une estimation, n'a jamais créé de compte, et écrit pour qu'on
 * l'oublie. Sa fiche de contact emporte ses demandes par cascade ; son registre
 * de consentement, rattaché à l'adresse et non au contact, est purgé à part.
 *
 * Les estimations anonymes ne sont PAS concernées : elles ne portent ni compte
 * ni adresse, donc rien ne permet de dire qu'elles sont les siennes. Prétendre
 * les effacer supposerait de les identifier, c'est-à-dire de conserver
 * précisément ce qu'on n'a pas voulu conserver.
 */
export async function forgetEmail(email: string): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  const address = normaliseEmail(email);

  try {
    const db = getDb();
    await db.delete(contacts).where(eq(contacts.email, address));
    await db.delete(consents).where(eq(consents.email, address));
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, address));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("forgetEmail", error);
  }
}

/**
 * Le ménage des sessions et jetons périmés.
 *
 * Auth.js ne le fait pas : il vérifie l'expiration à la lecture et laisse les
 * lignes mortes derrière lui. Conserver une session expirée depuis six mois
 * n'apporte rien et allonge la liste de ce qu'il faudrait effacer le jour d'une
 * demande. À brancher sur une tâche planifiée, pas sur une requête utilisateur.
 */
export async function purgeExpired(now: Date = new Date()): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    const db = getDb();
    await db.delete(sessions).where(lt(sessions.expires, now));
    await db.delete(verificationTokens).where(lt(verificationTokens.expires, now));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("purgeExpired", error);
  }
}
