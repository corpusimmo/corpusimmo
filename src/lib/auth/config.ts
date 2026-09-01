/**
 * L'authentification — un seul fournisseur, Google, et aucune base de données.
 *
 * POURQUOI SANS BASE
 *   La session est un JWT signé, posé dans un cookie. Rien n'est stocké côté
 *   serveur, ce qui permet à l'authentification d'exister AVANT la persistance
 *   (voir `docs/architecture.md`). Quand la base arrivera, on ajoutera un
 *   adaptateur ; la stratégie de session est alors une ligne à changer, pas une
 *   refonte.
 *
 * POURQUOI GOOGLE SEUL
 *   Ce qui nous intéresse ici n'est pas « avoir des comptes » mais disposer
 *   d'une **adresse e-mail vérifiée par un tiers**. C'est ce qui permet de
 *   remettre un document sans repasser par un formulaire et sans attendre un
 *   aller-retour de courriel. Ajouter un fournisseur qui ne vérifie pas
 *   l'adresse retirerait tout l'intérêt.
 *
 * TOUT RESTE OPTIONNEL
 *   Sans `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` et `AUTH_SECRET`, la
 *   configuration reste inerte et l'interface n'affiche aucun bouton de
 *   connexion. C'est le contrat du dépôt : l'application démarre et se
 *   construit avec un `.env` vide.
 */

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const googleId = clean(process.env.AUTH_GOOGLE_ID);
const googleSecret = clean(process.env.AUTH_GOOGLE_SECRET);
const authSecret = clean(process.env.AUTH_SECRET);

/**
 * Vrai quand les trois secrets sont là. Lu par l'en-tête pour décider
 * d'afficher — ou non — le bouton de connexion : un bouton qui mène à une
 * erreur est pire que pas de bouton.
 */
export const isAuthConfigured = Boolean(googleId && googleSecret && authSecret);

export const authConfig: NextAuthConfig = {
  // Sans fournisseur configuré, la liste est vide : Auth.js reste montable,
  // il n'a simplement rien à proposer.
  providers:
    googleId && googleSecret
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            // On ne demande que l'identité. Pas d'accès aux contacts, à
            // l'agenda ni au disque : chaque périmètre supplémentaire est une
            // case de plus à cocher pour l'utilisateur, et une donnée de plus
            // à protéger pour nous.
            authorization: { params: { scope: "openid email profile" } },
          }),
        ]
      : [],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },

  callbacks: {
    /**
     * Une adresse non vérifiée par Google n'ouvre pas de session.
     *
     * C'est tout l'intérêt du dispositif : si l'adresse n'est pas prouvée, elle
     * ne vaut pas mieux qu'un champ de formulaire, et elle ne doit donc pas
     * donner accès à ce que le formulaire protège.
     */
    signIn({ profile }) {
      if (!profile) return true;
      return profile.email_verified === true;
    },

    jwt({ token, profile }) {
      if (profile?.email_verified === true) {
        token.verifiedEmail = true;
      }
      return token;
    },

    session({ session, token }) {
      session.user.verifiedEmail = token.verifiedEmail === true;
      return session;
    },
  },

  // Le cookie de session ne sert à rien à un script tiers, et un site externe
  // n'a aucune raison de déclencher une action authentifiée chez nous.
  cookies: {
    sessionToken: {
      name: "corpusimmo.session",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
  },

  trustHost: true,
};
