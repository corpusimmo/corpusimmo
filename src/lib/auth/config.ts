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

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig } from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import Google from "next-auth/providers/google";

import { env } from "@/config/env";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { getMailer, maskEmail, renderSignInLinkEmail } from "@/lib/email";

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const googleId = clean(process.env.AUTH_GOOGLE_ID);
const googleSecret = clean(process.env.AUTH_GOOGLE_SECRET);
const authSecret = clean(process.env.AUTH_SECRET);

/**
 * LA SECONDE VOIE D'ENTRÉE : un lien de connexion par courriel.
 *
 * POURQUOI PAS DE MOT DE PASSE. Un mot de passe se stocke, se fuit, se réutilise
 * ailleurs, et il faut prévoir de le réinitialiser. Un lien à usage unique
 * vérifie l'adresse au passage, exactement comme Google le fait, et ne laisse
 * rien à protéger chez nous. L'exigence est la même pour les deux voies : ce
 * que nous voulons est une ADRESSE PROUVÉE, pas un compte de plus.
 *
 * ELLE EXIGE UNE BASE, et ce n'est pas un choix : le jeton à usage unique doit
 * être écrit quelque part entre l'envoi du courriel et le clic. Sans base, la
 * voie n'existe pas, et l'interface n'en montre rien plutôt que de proposer un
 * formulaire qui ne pourrait pas aboutir.
 *
 * ELLE PASSE PAR NOTRE PROPRE TRANSPORTEUR, pas par celui d'Auth.js. Trois
 * raisons : le courriel porte la marque comme les autres ; il respecte
 * `EMAIL_PROVIDER`, donc en développement le lien s'affiche dans la console au
 * lieu de partir ; et le jour où l'on change de fournisseur d'envoi, il n'y a
 * qu'un endroit à toucher.
 *
 * QUINZE MINUTES de validité. Assez pour aller chercher son courrier, trop peu
 * pour qu'un lien oublié dans une boîte partagée serve six mois plus tard.
 */
const SIGN_IN_LINK_MAX_AGE_SECONDS = 15 * 60;

const emailLinkProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "Lien de connexion",
  from: env.email.from,
  maxAge: SIGN_IN_LINK_MAX_AGE_SECONDS,
  async sendVerificationRequest({ identifier, url, expires }) {
    const template = renderSignInLinkEmail({ url, expiresAt: expires });
    const result = await getMailer().send({ to: identifier, ...template });

    // Un envoi qui échoue doit LEVER : sans cela, Auth.js redirigerait vers
    // « vérifiez votre boîte » alors que rien n'est parti, et la personne
    // attendrait un message qui n'arrivera jamais.
    if (!result.delivered) {
      console.error(
        `[auth] lien de connexion non envoyé à ${maskEmail(identifier)} : ` +
          (result.error ?? "raison inconnue"),
      );
      throw new Error("sign_in_link_not_sent");
    }
  },
};

/**
 * Vrai quand les trois secrets sont là. Lu par l'en-tête pour décider
 * d'afficher — ou non — le bouton de connexion : un bouton qui mène à une
 * erreur est pire que pas de bouton.
 */
export const isAuthConfigured = Boolean(googleId && googleSecret && authSecret);

/**
 * L'ÉTAT DE LA CONNEXION, DIT AU DÉMARRAGE ET PIÈCE PAR PIÈCE.
 *
 * Auth.js répond `error=Configuration` — « la connexion n'est pas configurée
 * sur ce site » — pour quatre causes très différentes : secret absent,
 * identifiants Google absents, base injoignable, ou base joignable dont les
 * TABLES n'existent pas encore. Le message est le même dans les quatre cas, et
 * sans ce journal il faut deviner laquelle.
 *
 * La ligne ne contient aucun secret : des booléens, et le nom de ce qui
 * manque. Elle est écrite une fois par instance, au chargement du module.
 */
if (!isAuthConfigured || isDatabaseConfigured()) {
  const missing = [
    authSecret ? null : "AUTH_SECRET",
    googleId ? null : "AUTH_GOOGLE_ID",
    googleSecret ? null : "AUTH_GOOGLE_SECRET",
  ].filter(Boolean);

  if (missing.length > 0) {
    console.warn(
      `[auth] connexion indisponible, variables manquantes : ${missing.join(", ")}. ` +
        "Le reste du site n'en dépend pas.",
    );
  } else if (isDatabaseConfigured()) {
    console.info(
      "[auth] connexion configurée, adaptateur base ACTIF. " +
        "Une erreur « Configuration » à ce stade vient de la base : chaîne de " +
        "connexion invalide, ou migrations non appliquées (pnpm db:migrate).",
    );
  }
}

export const authConfig: NextAuthConfig = {
  /**
   * L'ADAPTATEUR EST CONDITIONNEL, et il doit le rester.
   *
   * Sans base, la configuration demeure inerte et la session en jeton signé
   * continue de fonctionner : c'est le contrat du dépôt, qui doit démarrer et
   * se construire avec un `.env` vide.
   *
   * Avec base, l'adaptateur persiste les utilisateurs et les comptes. C'est ce
   * qui donne enfin un IDENTIFIANT STABLE à une personne, et donc ce qui permet
   * à ses outils débloqués, à ses estimations et à ses comparables de la suivre
   * d'un appareil à l'autre.
   */
  adapter: isDatabaseConfigured()
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,

  // Sans fournisseur configuré, la liste est vide : Auth.js reste montable,
  // il n'a simplement rien à proposer.
  providers: [
    ...(googleId && googleSecret
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
      : []),
    // Le lien de connexion n'existe que s'il y a une base pour y écrire son
    // jeton. Voir l'en-tête de `emailLinkProvider`.
    ...(isDatabaseConfigured() ? [emailLinkProvider] : []),
  ],

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
      // Pas de profil : c'est la voie du lien de connexion. L'adresse y est
      // prouvée par le clic sur un jeton envoyé à elle seule, ce qui est
      // exactement la garantie que `email_verified` apporte côté Google.
      if (!profile) return true;
      return profile.email_verified === true;
    },

    /**
     * `user` n'est fourni qu'à la connexion, et il vient de l'adaptateur : son
     * `id` est celui de la ligne `users` en base. On le fige dans `sub`, sinon
     * la session ne saurait plus à qui elle appartient dès la requête suivante,
     * et aucune lecture en base ne serait possible.
     */
    jwt({ token, user, profile, account }) {
      if (profile?.email_verified === true) {
        token.verifiedEmail = true;
      }
      // Le lien de connexion n'a pas de profil, mais il prouve l'adresse tout
      // aussi bien : le jeton n'a été envoyé qu'à elle, et il a fallu cliquer.
      // Sans cette ligne, une personne entrée par cette voie serait tenue pour
      // non vérifiée, alors qu'elle vient d'en administrer la preuve.
      if (account?.provider === "email") {
        token.verifiedEmail = true;
      }
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },

    session({ session, token }) {
      session.user.verifiedEmail = token.verifiedEmail === true;
      // Sans base, `sub` reste l'identifiant du fournisseur : utilisable comme
      // clé opaque, mais il ne désigne aucune ligne. Les appelants vérifient
      // `isDatabaseConfigured()` avant d'en faire une clé étrangère.
      if (token.sub) {
        session.user.id = token.sub;
      }
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
