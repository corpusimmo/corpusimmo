/**
 * CE QU'ON PEUT PROUVER D'UN SCHÉMA SANS BASE — et c'est beaucoup.
 *
 * Il n'y a pas de Postgres dans l'intégration continue, et il ne doit pas y en
 * avoir : un test qui exige une base échoue le jour où la base est en
 * maintenance, ce qui apprend quelque chose sur l'hébergeur et rien sur le
 * code. Mais un schéma Drizzle est un OBJET, pas un fichier SQL : il se lit, il
 * se parcourt, et les fautes qui coûtent cher sont exactement celles qu'on peut
 * y détecter.
 *
 * QUATRE PROPRIÉTÉS, ET AUCUNE N'EST DÉCORATIVE
 *
 *  1. LA FORME ATTENDUE PAR AUTH.JS. Une clé renommée dans la table `accounts`
 *     ne casse rien à la compilation et fait échouer la connexion au premier
 *     aller-retour OAuth. On monte donc l'adaptateur sur nos tables — au niveau
 *     des TYPES seulement, sans base et sans requête — de sorte que la faute
 *     devienne une erreur de `pnpm typecheck`.
 *
 *  2. `timestamptz`, JAMAIS `timestamp` NU. Un horodatage sans fuseau stocke une
 *     heure sans dire laquelle. La faute est invisible en développement, où le
 *     serveur et la base partagent le même fuseau, et se révèle en production
 *     sur une base en UTC — le pire moment.
 *
 *  3. LA CASCADE D'EFFACEMENT. Le droit à l'effacement ne se prouve pas par une
 *     intention mais par un graphe : chaque table qui porte une donnée
 *     personnelle doit atteindre `users` par une chaîne de clés étrangères en
 *     cascade. Ce test parcourt le graphe et refuse toute table isolée, y
 *     compris celles qui n'existent pas encore.
 *
 *  4. AUCUNE CLÉ PRIMAIRE ENTIÈRE. Un `serial` exposé dans une URL dit combien
 *     de lignes existent, et invite à essayer la suivante.
 */

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { describe, expect, it } from "vitest";

import * as schema from ".";

/**
 * Toutes les tables du schéma, découvertes par réflexion.
 *
 * L'énumération est faite depuis `unknown` et non depuis le type exact du
 * module : une table Drizzle porte son nom DANS son type, si bien qu'un
 * `PgTable` générique n'est pas assignable à `PgTable<{ name: "leads" }>` et
 * qu'un prédicat de type sur l'union échouerait à la compilation. Passer par
 * `unknown` demande à TypeScript ce qu'on veut vraiment lui demander :
 * « parmi ces valeurs, lesquelles sont des tables ? ».
 *
 * La réflexion plutôt qu'une liste écrite à la main : une table ajoutée demain
 * entre automatiquement dans le test de cascade, ce qui est tout l'intérêt.
 */
function collectTables(source: Record<string, unknown>): PgTable[] {
  const found: PgTable[] = [];
  for (const value of Object.values(source)) {
    if (is(value, PgTable)) found.push(value);
  }
  return found;
}

const tables = collectTables(schema);

const byName = new Map(tables.map((table) => [getTableConfig(table).name, table]));

function config(name: string) {
  const table = byName.get(name);
  if (!table) throw new Error(`table ${name} absente du schéma`);
  return getTableConfig(table);
}

function columnNames(name: string): string[] {
  return config(name).columns.map((column) => column.name);
}

function indexNames(name: string): string[] {
  return config(name)
    .indexes.map((index) => index.config.name)
    .filter((indexName): indexName is string => indexName !== undefined);
}

/**
 * LA VÉRIFICATION QUI COMPTE LE PLUS, et elle n'a pas de corps de test.
 *
 * Cette fonction n'est jamais appelée : sa seule raison d'être est d'être
 * COMPILÉE. `DrizzleAdapter` exige un schéma dont chaque table porte les clés
 * TypeScript exactes qu'il utilisera pour construire ses requêtes ; si l'une
 * d'elles dérive — `providerAccountId` renommé, `emailVerified` devenu autre
 * chose qu'un horodatage, `users.id` changé pour un entier — `pnpm typecheck`
 * échoue ici, à froid, au lieu que la connexion échoue en production.
 *
 * Rien n'est instancié, aucune connexion n'est ouverte : `db` n'est qu'un type.
 */
function adapterAcceptsOurTables(db: NeonHttpDatabase<typeof schema>) {
  return DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  });
}

describe("compatibilité avec l'adaptateur Auth.js", () => {
  it("expose un schéma que `DrizzleAdapter` accepte", () => {
    // La preuve est à la compilation ; l'assertion ne fait que garder la
    // fonction vivante pour que personne ne la supprime comme « inutilisée ».
    expect(typeof adapterAcceptsOurTables).toBe("function");
  });

  it("garde les clés de colonne exigées par le protocole", () => {
    // Ces noms viennent d'OAuth, pas de nous. Les « corriger » en camelCase
    // casserait l'échange de jetons.
    expect(columnNames("accounts")).toEqual(
      expect.arrayContaining([
        "user_id",
        "type",
        "provider",
        "provider_account_id",
        "refresh_token",
        "access_token",
        "expires_at",
        "token_type",
        "scope",
        "id_token",
        "session_state",
      ]),
    );
  });

  it("identifie un compte par le couple (fournisseur, identifiant chez lui)", () => {
    const pk = config("accounts").primaryKeys[0];
    expect(pk?.columns.map((column) => column.name)).toEqual([
      "provider",
      "provider_account_id",
    ]);
  });

  it("identifie un jeton de vérification par (destinataire, jeton)", () => {
    const pk = config("verification_tokens").primaryKeys[0];
    expect(pk?.columns.map((column) => column.name)).toEqual(["identifier", "token"]);
  });
});

describe("horodatages", () => {
  it("n'utilise que des `timestamptz`", () => {
    const nus: string[] = [];

    for (const table of tables) {
      const { name, columns } = getTableConfig(table);
      for (const column of columns) {
        if (column.dataType !== "date") continue;
        if (!column.getSQLType().includes("with time zone")) {
          nus.push(`${name}.${column.name} → ${column.getSQLType()}`);
        }
      }
    }

    expect(nus).toEqual([]);
  });
});

describe("clés primaires", () => {
  it("n'expose aucun entier auto-incrémenté", () => {
    const entiers: string[] = [];

    for (const table of tables) {
      const { name, columns } = getTableConfig(table);
      for (const column of columns) {
        if (!column.primary) continue;
        // `uuid` pour ce qui nous appartient, `text` pour ce que l'adaptateur
        // impose (un jeton de session est déjà une chaîne opaque).
        if (!["PgUUID", "PgText"].includes(column.columnType)) {
          entiers.push(`${name}.${column.name} → ${column.columnType}`);
        }
      }
    }

    expect(entiers).toEqual([]);
  });
});

/**
 * Le graphe d'effacement : quelles tables `delete from users` emporte-t-il ?
 *
 * On ne suit QUE les arêtes en cascade. Une clé étrangère en `set null` ne fait
 * pas partie du chemin, ce qui est correct : elle vide une référence, elle
 * n'efface pas la ligne.
 */
function cascadesVers(nomTable: string, cible: string, vus = new Set<string>()): boolean {
  if (nomTable === cible) return true;
  if (vus.has(nomTable)) return false;
  vus.add(nomTable);

  for (const fk of config(nomTable).foreignKeys) {
    if (fk.onDelete !== "cascade") continue;
    const parent = getTableConfig(fk.reference().foreignTable).name;
    if (cascadesVers(parent, cible, vus)) return true;
  }

  return false;
}

describe("droit à l'effacement", () => {
  /**
   * `users` est la racine, et `verification_tokens` est indexée par ADRESSE et
   * non par compte : un lien magique existe avant que le compte n'existe. Cette
   * table est purgée explicitement par `queries/erasure.ts`.
   */
  const horsGraphe = new Set(["users", "verification_tokens"]);

  it("efface tout ce qui concerne une personne en supprimant son compte", () => {
    const orphelines = tables
      .map((table) => getTableConfig(table).name)
      .filter((name) => !horsGraphe.has(name))
      .filter((name) => !cascadesVers(name, "users"));

    expect(orphelines).toEqual([]);
  });

  it("emporte le résultat complet avec son estimation", () => {
    expect(cascadesVers("estimation_results", "estimations")).toBe(true);
  });

  it("emporte les lignes d'un panier avec le panier", () => {
    expect(cascadesVers("comparable_items", "comparable_sets")).toBe(true);
  });

  it("emporte les demandes avec la fiche de contact", () => {
    expect(cascadesVers("leads", "contacts")).toBe(true);
  });

  it("ne détruit PAS une demande quand son estimation est oubliée", () => {
    const fk = config("leads").foreignKeys.find(
      (candidate) => getTableConfig(candidate.reference().foreignTable).name === "estimations",
    );
    expect(fk?.onDelete).toBe("set null");
  });

  it("ne détruit PAS un panier quand son estimation est oubliée", () => {
    const fk = config("comparable_sets").foreignKeys.find(
      (candidate) => getTableConfig(candidate.reference().foreignTable).name === "estimations",
    );
    expect(fk?.onDelete).toBe("set null");
  });
});

describe("déblocages d'outils", () => {
  it("interdit deux fois le même outil pour la même personne", () => {
    const unique = config("tool_unlocks").indexes.find(
      (index) => index.config.name === "tool_unlocks_user_tool_idx",
    );

    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns.map((column) => ("name" in column ? column.name : ""))).toEqual([
      "user_id",
      "tool_slug",
    ]);
  });

  it("indexe la personne ET la date, ce dont la fenêtre glissante a besoin", () => {
    expect(indexNames("tool_unlocks")).toContain("tool_unlocks_user_unlocked_at_idx");
  });

  it("n'écrit la règle du quota nulle part dans le schéma", () => {
    // Aucune contrainte de vérification, aucune colonne dérivée : le quota vit
    // dans `src/lib/access/core.ts`, et une seconde implémentation en SQL
    // finirait par diverger de la première.
    expect(config("tool_unlocks").checks).toEqual([]);
    expect(columnNames("tool_unlocks")).toEqual(["id", "user_id", "tool_slug", "unlocked_at"]);
  });
});

describe("estimations", () => {
  it("sépare le résumé du résultat complet", () => {
    // Le résumé ne porte AUCUN document : c'est ce qui garantit qu'afficher une
    // liste ne lit jamais trente charges JSON.
    expect(columnNames("estimations")).not.toContain("payload");
    expect(columnNames("estimation_results")).toContain("payload");
  });

  it("indexe l'historique par personne et par date", () => {
    expect(indexNames("estimations")).toContain("estimations_user_computed_at_idx");
  });

  it("écarte les doublons de résultat de moteur", () => {
    const unique = config("estimations").indexes.find(
      (index) => index.config.name === "estimations_user_engine_id_idx",
    );
    expect(unique?.config.unique).toBe(true);
  });

  it("garde le jeton de partage nullable et unique", () => {
    const shareToken = config("estimations").columns.find(
      (column) => column.name === "share_token",
    );
    expect(shareToken?.notNull).toBe(false);
    expect(shareToken?.isUnique).toBe(true);
  });
});

describe("consentements", () => {
  it("porte la finalité, la date, l'origine et la version", () => {
    expect(columnNames("consents")).toEqual(
      expect.arrayContaining(["purpose", "collected_at", "source", "version", "granted"]),
    );
  });

  it("laisse Postgres poser l'horodatage", () => {
    // La date par défaut vient de la base, pas de l'appelant : c'est ce qui
    // fait qu'un horodatage client ne peut pas se substituer à la preuve.
    const collectedAt = config("consents").columns.find(
      (column) => column.name === "collected_at",
    );
    expect(collectedAt?.hasDefault).toBe(true);
  });

  it("indexe la recherche par adresse et par finalité", () => {
    expect(indexNames("consents")).toContain("consents_email_purpose_idx");
  });
});

describe("contacts", () => {
  it("garde une seule fiche par adresse", () => {
    const unique = config("contacts").indexes.find(
      (index) => index.config.name === "contacts_email_idx",
    );
    expect(unique?.config.unique).toBe(true);
  });
});

describe("inventaire", () => {
  it("livre les treize tables attendues, et pas une de plus", () => {
    expect([...byName.keys()].sort()).toEqual([
      "accounts",
      "comparable_items",
      "comparable_sets",
      "consents",
      "contacts",
      "estimation_results",
      "estimations",
      "leads",
      "sessions",
      "tool_unlocks",
      "user_profiles",
      "users",
      "verification_tokens",
    ]);
  });
});
