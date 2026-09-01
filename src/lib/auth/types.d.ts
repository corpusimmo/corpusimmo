/**
 * Élargissements de types d'Auth.js.
 *
 * On expose `verifiedEmail` : la seule chose que cette application demande
 * vraiment à Google, une adresse prouvée. Sans ce champ, chaque appelant
 * devrait refaire le raisonnement à partir du profil brut.
 *
 * Le nom évite délibérément `emailVerified`, déjà pris par les types
 * d'adaptateur d'Auth.js où il vaut une `Date | null` — deux sens différents
 * sous un même nom finiraient par se confondre.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /**
       * L'identifiant de la ligne `users` en base, quand une base est
       * configurée. Sinon, l'identifiant opaque du fournisseur : utilisable
       * comme clé de session, jamais comme clé étrangère.
       */
      id: string;
      /** Google a confirmé que l'adresse appartient à la personne. */
      verifiedEmail: boolean;
    } & DefaultSession["user"];
  }

  interface Profile {
    email_verified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    verifiedEmail?: boolean;
  }
}
