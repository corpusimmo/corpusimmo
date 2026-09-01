/**
 * LES PORTÉES — la clause `where` de chaque lecture, isolée pour être vérifiée.
 *
 * POURQUOI CE FICHIER EXISTE. Toute donnée de cette base appartient à
 * quelqu'un. La faute qui coûte le plus cher n'est pas une requête lente, c'est
 * une requête qui a oublié `where user_id = …` : elle ne casse rien, elle ne
 * lève pas, elle rend simplement l'estimation d'un autre. Sortir ces clauses
 * des fonctions d'accès permet de les éprouver une par une, sans base, en
 * lisant le SQL produit — c'est ce que fait `scopes.test.ts`.
 *
 * AUCUNE RÈGLE MÉTIER ICI, et surtout pas la fenêtre glissante du quota. On
 * pourrait écrire `unlocked_at > now() - interval '7 days'` et laisser Postgres
 * compter ; ce serait une SECONDE implémentation de la règle qui vit dans
 * `src/lib/access/core.ts`, et deux implémentations d'une même règle finissent
 * toujours par diverger. Les déblocages d'une personne sont donc lus en entier
 * (quelques dizaines de lignes par an), et c'est `computeQuota` qui tranche.
 *
 * Ce module est pur : ni `server-only`, ni client, ni accès réseau. Il ne
 * construit que des fragments SQL.
 */

import { and, eq, type SQL } from "drizzle-orm";

import { comparableItems, comparableSets } from "./schema/comparables";
import { consents } from "./schema/consents";
import { estimations } from "./schema/estimations";
import { contacts, leads } from "./schema/leads";
import { toolUnlocks } from "./schema/unlocks";

/**
 * L'adresse e-mail sous sa forme de rangement : minuscules, sans espaces.
 *
 * `contacts.ts` écrit déjà `input.email.toLowerCase()` avant chaque appel de
 * fournisseur. La même normalisation doit avoir lieu AVANT l'index unique, sans
 * quoi `Jean@exemple.fr` et `jean@exemple.fr` deviennent deux personnes, avec
 * deux consentements et un désabonnement qui n'en couvre qu'un.
 *
 * On ne touche PAS à la partie locale au-delà de la casse : `jean.dupont` et
 * `jeandupont` sont la même boîte chez Gmail et deux boîtes différentes
 * ailleurs. Deviner reviendrait à fusionner des personnes distinctes.
 */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Tous les déblocages d'une personne. Le tri et la fenêtre sont faits ailleurs. */
export function unlocksOfUser(userId: string): SQL {
  return eq(toolUnlocks.userId, userId);
}

/** Un déblocage précis, borné au propriétaire. */
export function unlockOfUser(userId: string, toolSlug: string): SQL {
  return and(eq(toolUnlocks.userId, userId), eq(toolUnlocks.toolSlug, toolSlug)) as SQL;
}

/** L'historique d'une personne. */
export function estimationsOfUser(userId: string): SQL {
  return eq(estimations.userId, userId);
}

/**
 * UNE estimation, bornée au propriétaire.
 *
 * Les deux égalités sont indispensables : `where id = ?` seul suffirait à lire
 * l'estimation de n'importe qui à partir de son identifiant.
 */
export function estimationOwnedBy(estimationId: string, userId: string): SQL {
  return and(eq(estimations.id, estimationId), eq(estimations.userId, userId)) as SQL;
}

/**
 * Une estimation par son jeton de partage.
 *
 * C'est la SEULE lecture d'estimation qui ne soit pas bornée au propriétaire,
 * et c'est légitime : le jeton est le droit d'accès. Il est nullable et posé à
 * la demande, si bien qu'une estimation non partagée n'est atteignable par
 * aucun jeton.
 */
export function estimationByShareToken(shareToken: string): SQL {
  return eq(estimations.shareToken, shareToken);
}

/** Les paniers d'une personne. */
export function comparableSetsOfUser(userId: string): SQL {
  return eq(comparableSets.userId, userId);
}

/** UN panier, borné au propriétaire. */
export function comparableSetOwnedBy(setId: string, userId: string): SQL {
  return and(eq(comparableSets.id, setId), eq(comparableSets.userId, userId)) as SQL;
}

/**
 * Les lignes d'un panier.
 *
 * Volontairement NON bornée au propriétaire : l'appartenance du panier a déjà
 * été vérifiée par `comparableSetOwnedBy` avant qu'on en arrive là, et la
 * revérifier ici imposerait une jointure à chaque lecture de ligne. La
 * discipline correspondante est écrite dans `queries/comparables.ts` : on ne
 * lit jamais les lignes d'un panier qu'on n'a pas d'abord identifié.
 */
export function comparableItemsOfSet(setId: string): SQL {
  return eq(comparableItems.setId, setId);
}

/** Une ligne précise d'un panier. */
export function comparableItemOfSet(setId: string, transactionId: string): SQL {
  return and(
    eq(comparableItems.setId, setId),
    eq(comparableItems.transactionId, transactionId),
  ) as SQL;
}

/** Le registre de consentement d'une adresse. */
export function consentsOfEmail(email: string): SQL {
  return eq(consents.email, normaliseEmail(email));
}

/** Le registre de consentement d'un compte. */
export function consentsOfUser(userId: string): SQL {
  return eq(consents.userId, userId);
}

/** La fiche de contact d'une adresse. */
export function contactOfEmail(email: string): SQL {
  return eq(contacts.email, normaliseEmail(email));
}

/** Les demandes d'un contact. */
export function leadsOfContact(contactId: string): SQL {
  return eq(leads.contactId, contactId);
}
