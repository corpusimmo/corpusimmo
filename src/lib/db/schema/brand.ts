/**
 * LA CHARTE GRAPHIQUE D'UN COMPTE.
 *
 * Ce que la personne dépose une fois et qui habille ensuite TOUS ses documents
 * générés : export PDF des comparables, trames PowerPoint, dossiers. La règle
 * de repli vit dans `src/lib/brand/charte.ts` et ne dépend pas de cette table :
 * ici on stocke ce qui a été saisi, y compris incomplet.
 *
 * POURQUOI UNE TABLE À PART DE `user_profiles`. Ce ne sont pas les mêmes
 * données ni le même cycle de vie. Le profil dit qui est la personne, prénom,
 * nom, téléphone, et sert aux e-mails et au score de lead. La charte dit à
 * quoi ressemblent ses documents, et n'existera que pour la fraction de
 * comptes qui génère des documents. Les mélanger obligerait à charger une
 * couleur de marque pour envoyer un e-mail d'estimation.
 *
 * LES COULEURS SONT DU TEXTE, PAS UN TYPE DÉDIÉ. Postgres n'a pas de type
 * couleur, et une contrainte `CHECK` sur un motif hexadécimal ferait échouer
 * l'écriture au lieu de laisser l'application dire ce qui ne va pas, dans sa
 * langue. La validation est donc dans `normaliserHex()`, testée, et la colonne
 * accepte ce qu'on lui donne.
 *
 * LE LOGO EST UNE URL, PAS UN BINAIRE. Une image en base gonfle les
 * sauvegardes et se sert mal ; le fichier vivra dans un stockage objet, la
 * colonne ne porte que son adresse. Tant qu'aucun stockage n'est branché, la
 * colonne reste vide et les documents utilisent le repli : c'est un manque
 * visible, pas une panne.
 */

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const brandProfiles = pgTable("brand_profiles", {
  /**
   * Clé primaire ET clé étrangère : une charte par compte. Une entreprise à
   * deux chartes concurrentes serait un problème d'organisation, pas de
   * modèle, et il faudrait un jour décider laquelle gagne.
   */
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Le nom affiché en pied de document. Sans lui, pas de bascule de charte. */
  companyName: text("company_name"),
  /** Le site, stocké tel que saisi ; le protocole est retiré à l'affichage. */
  website: text("website"),
  logoUrl: text("logo_url"),
  /** `#rrggbb`. Sans elle non plus, pas de bascule de charte. */
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BrandProfileRow = typeof brandProfiles.$inferSelect;
export type BrandProfileInsert = typeof brandProfiles.$inferInsert;
