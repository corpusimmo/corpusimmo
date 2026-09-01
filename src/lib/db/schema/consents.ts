/**
 * LES CONSENTEMENTS HORODATÉS — une exigence de preuve, pas un confort.
 *
 * Deux fichiers du dépôt réclament cette table par écrit :
 *
 *   - `src/lib/email/contacts.ts` : « chez Resend, l'audience est une liste de
 *     diffusion, pas une preuve. La preuve du consentement devra vivre dans
 *     NOTRE base ». Le fournisseur d'e-mails ne peut pas être le registre : il
 *     n'accepte pas d'attributs libres, il se change, et il n'a aucune raison
 *     de conserver ce qu'on ne lui a pas demandé de conserver ;
 *   - `src/lib/consent/consent.ts` : le choix cookies vit dans `localStorage`,
 *     donc dans un seul navigateur, donc nulle part le jour où il faut le
 *     produire.
 *
 * QUATRE COLONNES ET RIEN D'AUTRE : une finalité, une date, une origine, une
 * version. C'est la forme que la CNIL attend, et chacune répond à une question
 * qui sera posée telle quelle.
 *
 *   `purpose`     — à QUOI la personne a dit oui. Une ligne par finalité, jamais
 *                   une ligne « consentements » avec quatre booléens : accepter
 *                   la lettre d'information et refuser d'être appelé sont deux
 *                   décisions, prises parfois à des instants différents, et
 *                   retirées séparément.
 *   `collected_at`— QUAND, et c'est le SERVEUR qui le dit. `contacts.ts` en fait
 *                   déjà une règle : « un horodatage fourni par le client ne
 *                   prouverait rien ». D'où `defaultNow()` : la valeur par
 *                   défaut est celle de Postgres, pas celle de l'appelant.
 *   `source`      — D'OÙ il vient : `estimation`, `newsletter`, `aimant:<slug>`,
 *                   `bandeau-cookies`. Sans l'origine, on sait qu'un accord
 *                   existe mais pas ce qu'on montrait à la personne au moment
 *                   où elle l'a donné.
 *   `version`     — SOUS QUEL PÉRIMÈTRE. `CONSENT_VERSION` existe déjà côté
 *                   navigateur pour redemander le choix quand les finalités
 *                   changent ; en base, la version dit qu'un accord de 2026 ne
 *                   couvre pas une finalité ajoutée en 2027.
 *
 * ON ENREGISTRE AUSSI LES REFUS. `granted` est un booléen, pas une présence de
 * ligne. Un refus est une décision, il se produit en défense (« vous m'avez
 * écrit alors que j'avais dit non ») et il empêche de reposer la question
 * indéfiniment. Une table qui ne garderait que les oui serait une table de
 * marketing, pas un registre.
 *
 * LA TABLE EST EN AJOUT SEUL. Retirer un consentement n'est pas modifier la
 * ligne : c'est en écrire une nouvelle, avec `granted` à faux et sa propre
 * date. L'état courant d'une finalité est la ligne la plus récente. Écraser
 * détruirait précisément ce qu'on cherche à prouver, c'est-à-dire l'histoire.
 *
 * LA TENSION AVEC LE DROIT À L'EFFACEMENT, tranchée ici plutôt que découverte
 * plus tard. Ces lignes sont effacées en cascade avec le compte. Cela ressemble
 * à détruire une preuve, mais la preuve du consentement ne sert qu'à justifier
 * un traitement en cours : quand il n'y a plus ni compte, ni contact, ni envoi,
 * il n'y a plus rien à justifier, et conserver le registre reviendrait à garder
 * des données personnelles pour se défendre d'un traitement qui n'existe plus.
 */

import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Les finalités soumises au choix.
 *
 * Les trois premières viennent du formulaire de contact
 * (`src/app/api/leads/route.ts`), la quatrième du bandeau cookies
 * (`src/lib/consent/consent.ts`). Ce qui est strictement nécessaire au service
 * demandé n'y figure pas : le soumettre au choix serait un consentement de
 * façade.
 */
export const CONSENT_PURPOSES = [
  /** Recevoir l'estimation demandée. Obligatoire pour que le service ait lieu. */
  "estimation_delivery",
  /** Être contacté par un professionnel de son secteur. */
  "professional_contact",
  /** Recevoir la lettre d'information et les nouveautés. */
  "marketing",
  /** Mesure d'audience. */
  "analytics",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Nul quand le consentement précède le compte, ce qui est le cas le plus
     * fréquent : on donne son accord dans un formulaire d'estimation, pas dans
     * un tunnel d'inscription.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /**
     * L'adresse, en minuscules, telle qu'elle a été donnée. C'est le seul
     * identifiant dont on dispose pour un visiteur sans compte, et c'est par
     * elle que se fait une demande d'effacement venue de l'extérieur.
     *
     * Nulle pour le bandeau cookies, qui ne demande aucune adresse et ne doit
     * surtout pas en réclamer une pour enregistrer un refus.
     */
    email: text("email"),
    purpose: text("purpose").$type<ConsentPurpose>().notNull(),
    /** Vrai pour un accord, faux pour un refus ou un retrait. */
    granted: boolean("granted").notNull(),
    /** Posé par Postgres. Voir l'en-tête : jamais par le client. */
    collectedAt: timestamp("collected_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    // « Où en est cette personne, finalité par finalité ? » — la question qu'on
    // pose avant chaque envoi.
    index("consents_email_purpose_idx").on(table.email, table.purpose, table.collectedAt.desc()),
    // La même question pour un compte, et le balayage d'effacement.
    index("consents_user_collected_at_idx").on(table.userId, table.collectedAt.desc()),
  ],
);

export type ConsentRow = typeof consents.$inferSelect;
export type ConsentInsert = typeof consents.$inferInsert;
