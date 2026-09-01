# Connexion

## À quoi elle sert, et à quoi elle ne sert pas

**L'estimateur, la carte des ventes et l'observatoire sont ouverts, sans compte,
et le resteront.** C'est la doctrine d'accès du produit, et elle ne bouge pas.

Les **dix calculateurs** font exception depuis peu. Leur fiche reste publique,
statique et indexable : on y voit ce que l'outil calcule, ce qu'il ne fait pas,
et à quoi ressemble le classeur. Seule l'utilisation du calculateur, sur
`/outils/[slug]/calculer`, demande une connexion, puis passe le quota de deux
outils par semaine glissante.

La distinction n'est pas cosmétique. Une bibliothèque qu'on ne peut pas regarder
avant d'ouvrir un compte n'est pas une bibliothèque, c'est une porte fermée avec
une affiche. Ici, la personne sait exactement ce qu'elle vient chercher avant
qu'on lui demande quoi que ce soit.

La connexion sert donc à deux choses : savoir à qui ces outils servent, et
disposer d'une **adresse e-mail vérifiée par un tiers**, ce qui permet de
remettre un document sans repasser par un formulaire ni attendre un aller-retour
de courriel.

## Deux voies d'entrée, une seule exigence

**Google**, qui vérifie l'adresse et fournit un nom et une photo.

**Un lien de connexion par courriel**, sans mot de passe. Le lien est à usage
unique, valable quinze minutes, et il prouve l'adresse aussi bien que Google :
le jeton n'a été envoyé qu'à elle, et il a fallu cliquer.

Aucune des deux ne demande de mot de passe, et c'est délibéré. Un mot de passe
se stocke, se fuit, se réutilise ailleurs, et il faut prévoir de le
réinitialiser. Ce que nous voulons est une **adresse prouvée**, pas un compte de
plus. Un fournisseur qui ne vérifie pas l'adresse retirerait tout l'intérêt du
dispositif, et n'a donc pas sa place ici.

### Ce que le lien de connexion exige

**Une base.** Le jeton à usage unique doit être écrit quelque part entre l'envoi
du courriel et le clic. Sans `DATABASE_URL`, la voie n'existe pas, et la page de
connexion n'en montre rien plutôt que d'afficher un formulaire qui ne pourrait
pas aboutir. Elle interroge le serveur pour le savoir, elle ne le suppose pas.

**Aucune variable nouvelle.** Le courriel part par le transporteur du projet
(`EMAIL_PROVIDER`, `EMAIL_PROVIDER_KEY`, `EMAIL_FROM`), et non par celui
d'Auth.js. Trois conséquences utiles : le message porte la marque comme les
autres, il respecte `EMAIL_PROVIDER` donc en développement le lien s'affiche
dans la console au lieu de partir, et changer de fournisseur d'envoi ne touche
qu'un seul endroit.

**Un envoi qui échoue lève.** Sans cela, Auth.js redirigerait vers « vérifiez
votre boîte » alors que rien n'est parti, et la personne attendrait un message
qui n'arrivera jamais.

**La route de déblocage ne lit jamais l'adresse envoyée par le client**, mais
celle de la session. Une adresse postée dans un corps de requête serait une
déclaration que rien ne prouve, et il suffirait d'en changer à chaque appel pour
se donner autant d'accès qu'on veut.

**Sans authentification configurée, la porte n'existe pas** et les outils
restent ouverts : le dépôt doit démarrer avec un `.env` vide, et exiger une
connexion impossible fermerait le site au lieu de le protéger.

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
