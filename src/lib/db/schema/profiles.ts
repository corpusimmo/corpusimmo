/**
 * LE PROFIL — ce que la personne nous dit d'elle, à côté de ce que Google nous
 * en dit.
 *
 * POURQUOI UNE TABLE SÉPARÉE DE `users`. Ce n'est pas un goût de la
 * normalisation : `users` appartient à l'adaptateur Auth.js, qui y écrit par
 * `.set(data)` sans savoir ce qu'on y aurait ajouté. Une colonne `phone` posée
 * là serait à la merci du prochain `updateUser`, et le schéma de l'adaptateur
 * pourrait s'élargir sur une version mineure. On garde donc `users` intact et
 * on met à côté ce qui est à nous.
 *
 * POURQUOI PRÉNOM ET NOM SÉPARÉS, alors que `users.name` existe déjà. Google
 * rend un nom d'affichage d'un seul tenant, et le découper est un art perdu
 * d'avance. Or le formulaire de contact demande DÉJÀ un prénom et un nom
 * séparés (`src/app/api/leads/route.ts`), et l'e-mail d'estimation s'adresse à
 * la personne par son prénom. La seconde voie de connexion prévue, par lien
 * magique, ne fournira aucun nom du tout : ces colonnes sont ce qui rendra le
 * compte utilisable sans Google.
 *
 * LE TÉLÉPHONE EST FACULTATIF ET LE RESTE. C'est le champ qui pèse le plus
 * lourd dans le score de lead (`src/lib/leads/score.ts`), donc exactement celui
 * qu'on aurait envie de rendre obligatoire. Le rendre obligatoire échangerait
 * des contacts réels contre des numéros inventés.
 */

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const userProfiles = pgTable("user_profiles", {
  /**
   * Clé primaire ET clé étrangère : un profil par compte, ni plus ni moins.
   * Une table de jointure avec son propre identifiant autoriserait deux profils
   * pour la même personne, et il faudrait un jour décider lequel a raison.
   */
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserProfileRow = typeof userProfiles.$inferSelect;
export type UserProfileInsert = typeof userProfiles.$inferInsert;
