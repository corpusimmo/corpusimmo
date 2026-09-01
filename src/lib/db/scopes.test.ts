/**
 * LA CLAUSE `where`, LUE PLUTÔT QUE SUPPOSÉE.
 *
 * On peut construire une requête Drizzle et lire le SQL qu'elle produit sans
 * jamais l'exécuter : `QueryBuilder` sert exactement à cela. C'est la seule
 * façon d'éprouver la construction des requêtes en intégration continue, et
 * elle suffit pour la propriété qui compte ici.
 *
 * CETTE PROPRIÉTÉ EST LA SUIVANTE : toute lecture de donnée personnelle est
 * bornée à son propriétaire. Une requête qui oublie `user_id = ?` ne lève pas,
 * ne ralentit rien, et rend l'estimation de quelqu'un d'autre. Elle passe la
 * relecture parce qu'elle a l'air correcte, et elle passe les tests d'interface
 * parce qu'en développement il n'y a qu'un compte. Le seul endroit où elle se
 * voit est le SQL.
 *
 * ON VÉRIFIE AUSSI CE QUI N'EST PAS LÀ : aucun calcul de fenêtre glissante dans
 * le SQL. La règle du quota vit dans `src/lib/access/core.ts`, et la voir
 * apparaître ici signifierait qu'elle existe en deux exemplaires.
 */

import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { comparableItems, comparableSets } from "./schema/comparables";
import { consents } from "./schema/consents";
import { estimations } from "./schema/estimations";
import { contacts } from "./schema/leads";
import { toolUnlocks } from "./schema/unlocks";
import {
  comparableItemOfSet,
  comparableItemsOfSet,
  comparableSetOwnedBy,
  comparableSetsOfUser,
  consentsOfEmail,
  consentsOfUser,
  contactOfEmail,
  estimationByShareToken,
  estimationOwnedBy,
  estimationsOfUser,
  normaliseEmail,
  unlockOfUser,
  unlocksOfUser,
} from "./scopes";
import type { PgTable } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const qb = new QueryBuilder();

/** Le SQL et ses paramètres, sans qu'aucune connexion n'ait été ouverte. */
function rendu(table: PgTable, where: SQL) {
  return qb.select().from(table).where(where).toSQL();
}

const USER = "3f2a0c1e-0000-4000-8000-000000000001";

describe("normalisation de l'adresse", () => {
  it("range en minuscules et sans espaces", () => {
    // Sans cela, `Jean@exemple.fr` et `jean@exemple.fr` deviennent deux
    // personnes, avec deux consentements et un désabonnement qui n'en couvre
    // qu'un.
    expect(normaliseEmail("  Jean.Dupont@Exemple.FR \n")).toBe("jean.dupont@exemple.fr");
  });

  it("ne touche PAS à la partie locale au-delà de la casse", () => {
    // `jean.dupont` et `jeandupont` sont la même boîte chez Gmail et deux
    // boîtes différentes ailleurs. Deviner fusionnerait des personnes distinctes.
    expect(normaliseEmail("jean.dupont+immo@exemple.fr")).toBe("jean.dupont+immo@exemple.fr");
  });

  it("s'applique avant la comparaison en base", () => {
    const { sql, params } = rendu(contacts, contactOfEmail("  Jean@Exemple.FR "));
    expect(sql).toContain('"contacts"."email" =');
    expect(params).toEqual(["jean@exemple.fr"]);
  });
});

describe("déblocages", () => {
  it("borne la lecture à la personne", () => {
    const { sql, params } = rendu(toolUnlocks, unlocksOfUser(USER));
    expect(sql).toContain('"tool_unlocks"."user_id" =');
    expect(params).toEqual([USER]);
  });

  it("ne calcule AUCUNE fenêtre glissante en SQL", () => {
    const { sql } = rendu(toolUnlocks, unlocksOfUser(USER));

    // Le jour où l'une de ces chaînes apparaît, la règle du quota existe en
    // deux exemplaires et les deux finiront par diverger.
    expect(sql).not.toMatch(/interval/i);
    expect(sql).not.toMatch(/now\(\)/i);
    expect(sql).not.toMatch(/unlocked_at\s*>/i);
  });

  it("désigne un outil par la personne ET le slug", () => {
    const { sql, params } = rendu(toolUnlocks, unlockOfUser(USER, "dcf"));
    expect(sql).toContain('"tool_unlocks"."user_id" =');
    expect(sql).toContain('"tool_unlocks"."tool_slug" =');
    expect(params).toEqual([USER, "dcf"]);
  });
});

describe("estimations", () => {
  it("borne l'historique à la personne", () => {
    const { sql, params } = rendu(estimations, estimationsOfUser(USER));
    expect(sql).toContain('"estimations"."user_id" =');
    expect(params).toEqual([USER]);
  });

  it("exige l'identifiant ET le propriétaire pour lire UNE estimation", () => {
    // `where id = ?` seul suffirait à lire l'estimation de n'importe qui à
    // partir de son identifiant.
    const { sql, params } = rendu(estimations, estimationOwnedBy("est-1", USER));
    expect(sql).toContain('"estimations"."id" =');
    expect(sql).toContain('"estimations"."user_id" =');
    expect(params).toEqual(["est-1", USER]);
  });

  it("ouvre le partage par le JETON, et par lui seul", () => {
    const { sql, params } = rendu(estimations, estimationByShareToken("aBcD1234"));
    expect(sql).toContain('"estimations"."share_token" =');
    expect(sql).not.toContain('"estimations"."user_id"');
    expect(params).toEqual(["aBcD1234"]);
  });
});

describe("paniers de comparables", () => {
  it("borne la liste des paniers à la personne", () => {
    const { sql } = rendu(comparableSets, comparableSetsOfUser(USER));
    expect(sql).toContain('"comparable_sets"."user_id" =');
  });

  it("exige l'identifiant ET le propriétaire pour ouvrir un panier", () => {
    const { sql, params } = rendu(comparableSets, comparableSetOwnedBy("set-1", USER));
    expect(sql).toContain('"comparable_sets"."id" =');
    expect(sql).toContain('"comparable_sets"."user_id" =');
    expect(params).toEqual(["set-1", USER]);
  });

  it("lit les lignes par panier, l'appartenance ayant été établie avant", () => {
    // Documenté dans `scopes.ts` et tenu par `queries/comparables.ts` : aucune
    // fonction ne touche les lignes sans avoir d'abord identifié le panier.
    const { sql, params } = rendu(comparableItems, comparableItemsOfSet("set-1"));
    expect(sql).toContain('"comparable_items"."set_id" =');
    expect(params).toEqual(["set-1"]);
  });

  it("désigne une ligne par le panier et l'identifiant DVF", () => {
    const { params } = rendu(
      comparableItems,
      comparableItemOfSet("set-1", "geodvf:2024-532458"),
    );
    expect(params).toEqual(["set-1", "geodvf:2024-532458"]);
  });
});

describe("consentements", () => {
  it("cherche par adresse normalisée", () => {
    const { sql, params } = rendu(consents, consentsOfEmail("Jean@Exemple.FR"));
    expect(sql).toContain('"consents"."email" =');
    expect(params).toEqual(["jean@exemple.fr"]);
  });

  it("cherche aussi par compte", () => {
    const { sql, params } = rendu(consents, consentsOfUser(USER));
    expect(sql).toContain('"consents"."user_id" =');
    expect(params).toEqual([USER]);
  });
});

describe("paramètres liés", () => {
  it("ne concatène JAMAIS une valeur dans le SQL", () => {
    // La preuve tient en une ligne : l'adresse n'apparaît pas dans le texte de
    // la requête, elle est dans les paramètres. Une injection n'a nulle part où
    // se loger.
    const mechant = "'; drop table users; --";
    const { sql, params } = rendu(contacts, contactOfEmail(mechant));

    expect(sql).not.toContain("drop table");
    expect(params).toEqual([mechant.toLowerCase()]);
  });
});
