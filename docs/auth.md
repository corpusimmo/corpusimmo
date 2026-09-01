# Connexion

## À quoi elle sert, et à quoi elle ne sert pas

Un compte ne sert **pas** à protéger quoi que ce soit : l'estimateur, la carte,
l'observatoire et les dix outils sont ouverts, sans compte, et le resteront —
c'est la doctrine d'accès du produit.

Il sert à une seule chose aujourd'hui : disposer d'une **adresse e-mail vérifiée
par un tiers**. C'est ce qui permet de remettre un document sans repasser par un
formulaire et sans attendre un aller-retour de courriel.

D'où le fournisseur unique : Google vérifie l'adresse. Ajouter un fournisseur
qui ne la vérifie pas retirerait tout l'intérêt du dispositif.

## Deux décisions d'architecture

**Session en JWT, sans base de données.** La session est un jeton signé dans un
cookie ; rien n'est stocké côté serveur. C'est ce qui permet à
l'authentification d'exister *avant* la persistance. Quand la base arrivera, on
ajoutera un adaptateur : la stratégie de session est alors une ligne à changer.

**Session résolue dans le navigateur.** Appeler `auth()` dans le layout racine
ferait basculer **toutes** les pages en rendu dynamique. `SessionProvider`
interroge `/api/auth/session` après l'hydratation : les pages restent statiques,
et seul l'en-tête change d'aspect une fois la réponse arrivée.

## Ce qu'il faut créer chez Google

1. **Google Cloud Console** → un projet.
2. **APIs & Services → OAuth consent screen** : type *External*, nom de
   l'application, e-mail d'assistance, domaine autorisé. Tant que l'écran est en
   *Testing*, seuls les comptes ajoutés en testeurs peuvent se connecter.
3. **Credentials → Create credentials → OAuth client ID**, type *Web
   application*, avec les URI de redirection **exactes** :

   ```
   http://localhost:3000/api/auth/callback/google
   https://corpus.immo/api/auth/callback/google
   ```

   Une URI qui ne correspond pas au caractère près donne `redirect_uri_mismatch`,
   et c'est de loin l'erreur la plus fréquente.
4. Reporter l'identifiant et le secret dans `AUTH_GOOGLE_ID` et
   `AUTH_GOOGLE_SECRET`, plus un `AUTH_SECRET` généré par
   `openssl rand -base64 32`.

Sur Vercel, ces trois variables vont dans *Production* **et** *Preview*. Chaque
URL de prévisualisation aurait besoin de sa propre URI de redirection : c'est
pourquoi il vaut mieux tester la connexion sur un domaine stable.

## Périmètre demandé

`openid email profile`, et rien de plus. Aucun accès aux contacts, à l'agenda ni
aux fichiers. Chaque périmètre supplémentaire est une case de plus à cocher pour
l'utilisateur, une raison de plus de renoncer, et une donnée de plus à protéger.

## Une adresse non vérifiée n'ouvre pas de session

Le rappel `signIn` refuse un profil dont `email_verified` n'est pas vrai. Si
l'adresse n'est pas prouvée, elle ne vaut pas mieux qu'un champ de formulaire —
elle ne doit donc pas donner accès à ce que le formulaire protège.

La session expose `user.verifiedEmail`. Le nom évite délibérément
`emailVerified`, déjà pris par les types d'adaptateur d'Auth.js où il vaut une
`Date | null`.

## Tout reste optionnel

Sans les trois variables, la liste de fournisseurs est vide, `/connexion`
l'annonce en toutes lettres, et le reste du site fonctionne à l'identique. La CI
construit avec un `.env` vide, et cette page en fait partie.

## Ce qui n'est pas fait

- **Pas d'espace membre.** Une personne connectée n'a rien à consulter tant que
  rien n'est stocké : ses estimations ne survivent pas à la requête. L'ordre
  correct est base de données → espace membre, et l'authentification est
  simplement prête avant.
- **Pas de suppression de compte** : il n'y a pas de compte à supprimer, la
  session est un cookie. Se déconnecter suffit à ne plus rien laisser.
