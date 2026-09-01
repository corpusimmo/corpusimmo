# La base de données

## Ce que ce chantier livre, et ce qu'il ne fait pas encore

La couche de persistance est **écrite, typée, testée et inerte**. Le schéma
existe, les migrations sont versionnées, le client sait se connecter et les
fonctions d'accès sont là. Rien ne l'appelle.

C'est délibéré. Brancher la persistance touche à l'authentification, aux routes
d'API et à trois magasins de navigateur ; faire les deux dans le même geste
rendrait impossible de dire, le jour où quelque chose casse, si le problème
vient du schéma ou du branchement. La liste de ce qu'il reste à faire est en fin
de document, dans l'ordre où il faut la faire.

**Sans `DATABASE_URL`, absolument rien ne change.** Les déblocages d'outils
restent dans le cookie signé, l'historique d'estimations et le panier de
comparables dans `localStorage`. C'est le contrat du dépôt, écrit en tête de
`.env.example` et vérifié par la CI à chaque poussée : l'application démarre et
se construit avec un fichier d'environnement vide.

## Pourquoi Drizzle plutôt que Prisma

Le déploiement est sur Vercel, en environnement serverless, et c'est ce qui
tranche.

**Pas de moteur binaire à embarquer.** Prisma expédie un exécutable natif par
plateforme, qu'il faut faire tenir dans le paquet de la fonction et qui alourdit
chaque démarrage à froid. Drizzle est du TypeScript qui produit du SQL ; il n'y
a rien à installer à côté.

**Pas d'étape de génération au build.** `prisma generate` est un préalable
obligatoire : oublié, le build échoue ; présent, il ajoute une étape à chaque
déploiement et un artefact à garder cohérent avec le schéma. Ici, le type sort
directement de la définition des tables, sans passe intermédiaire.

**Un typage qui vient du schéma, pas d'un fichier parallèle.** `typeof
users.$inferSelect` est le type d'une ligne, dérivé de la déclaration
elle-même. Il ne peut pas se désynchroniser, parce qu'il n'y a rien à
synchroniser.

**Et le SQL reste lisible.** Les fonctions d'accès de `src/lib/db/queries/`
ressemblent à ce qu'elles exécutent, ce qui compte pour une base dont on veut
pouvoir expliquer chaque requête.

Le prix payé : Drizzle n'a pas de couche de migration aussi bavarde que celle de
Prisma, et le pilote HTTP de Neon ne fait pas de transactions multi-instructions.
Les deux sont traités plus bas.

## Les treize tables

### Ce qu'Auth.js impose

| Table | Pourquoi elle existe |
| --- | --- |
| `users` | Le compte. Sa forme appartient à `@auth/drizzle-adapter`, pas à nous. |
| `accounts` | Le lien vers Google, avec ses jetons OAuth. Clé primaire `(provider, provider_account_id)`, celle du protocole. |
| `sessions` | Les sessions ouvertes, pour le jour où l'on quittera la session en JWT. |
| `verification_tokens` | Les jetons à usage unique du lien magique. Indexés par **adresse**, pas par compte : un lien existe avant le compte. |

L'adaptateur n'interroge pas ces tables par leur nom SQL : il lit les **clés
TypeScript** de l'objet Drizzle. Une clé renommée ne casse rien à la compilation
et fait échouer la connexion au premier aller-retour OAuth. Elles sont donc
recopiées à l'identique depuis la source du paquet, `snake_case` bizarres du
protocole compris (`refresh_token`, `expires_at`), et `schema.test.ts` monte
l'adaptateur sur nos tables au niveau des types : une dérive fait échouer
`pnpm typecheck`, à froid.

Trois écarts assumés par rapport au schéma de référence :

1. **`users.id` est un `uuid`** et non un `text`. L'adaptateur l'autorise
   explicitement, et un identifiant qui finira dans une URL ne doit rien laisser
   deviner du volume de la table.
2. **Tous les horodatages sont en `timestamptz`.** Le schéma de référence utilise
   un `timestamp` nu, qui stocke une heure sans dire laquelle. Une session
   expirant « à 2 h » sur une base en UTC et une application en Europe/Paris se
   ferme deux heures trop tôt l'hiver, une de plus l'été.
3. **La table `authenticator` n'est pas créée.** Elle est optionnelle, elle sert
   à WebAuthn, et le produit n'a ni clé de sécurité ni projet d'en avoir.

### Ce qui est à nous

| Table | Ce qu'elle remplace | Pourquoi |
| --- | --- | --- |
| `user_profiles` | Rien | Prénom, nom, téléphone facultatif. Séparé de `users` parce que l'adaptateur écrit dans `users` par `set(data)` sans savoir ce qu'on y aurait ajouté. |
| `tool_unlocks` | Le cookie signé de `src/lib/access/` | Un déblocage, une ligne. Index unique `(user_id, tool_slug)`. |
| `estimations` | `localStorage`, `corpusimmo.estimations.v1` | Le **résumé** qui se liste : où, quoi, combien, avec quelle confiance. |
| `estimation_results` | Rien | Le **résultat complet** en `jsonb`, qui se lit rarement. |
| `comparable_sets` | `localStorage`, `corpusimmo.pro.comparables.v1` | Le panier : son nom, son bien de référence, sa date. |
| `comparable_items` | La même clé | Les lignes du panier, chacune avec son exclusion, sa pondération imposée et son commentaire. |
| `consents` | Rien, et c'est le problème | Le registre horodaté, en ajout seul. |
| `contacts` | Rien | La personne, dédupliquée par adresse. |
| `leads` | Rien | La demande. Une personne, plusieurs demandes. |

### Le résumé et le résultat complet, séparés

L'historique local ne garde qu'un résumé, et il explique pourquoi : « un résumé
tient dans `localStorage` quand un résultat complet, avec ses cent mutations, ne
tient pas ». En base la contrainte disparaît, mais la séparation reste pour une
autre raison.

La page « mes estimations » liste trente lignes. Si le résultat complet était une
colonne de la même table, chaque affichage de liste traînerait trente documents
JSON de plusieurs centaines de kilo-octets. Postgres range les gros `jsonb` hors
ligne et ne les lit que si on les demande, mais un `select *` les demande, et un
`select *` finit toujours par arriver. Deux tables rendent l'erreur impossible
plutôt qu'improbable.

Garder le résultat complet ouvre trois choses qui sont hors de portée
aujourd'hui : le **lien partageable**, le **PDF régénéré** des mois plus tard, et
la **bande « valeur estimée » du score de lead**, que `POST /api/leads` refuse de
compter parce que la valeur lui arrive du client et qu'un client peut se déclarer
propriétaire d'une villa à deux millions.

### Le quota, et pourquoi il n'est écrit nulle part dans le schéma

La règle est : **deux outils par semaine glissante, on compte les déblocages et
jamais les usages, et rouvrir un outil déjà obtenu ne coûte rien.**

Elle vit dans `src/lib/access/core.ts`, sous forme pure et testée
(`computeQuota`, `applyGrant`, `WEEKLY_LIMIT`, `WINDOW_SECONDS`). Elle n'est
réécrite **nulle part** dans cette couche : ni vue SQL, ni contrainte de
vérification, ni `count(*) where unlocked_at > now() - interval '7 days'`. Deux
implémentations d'une même règle divergent toujours, sur le septième jour, sur la
réouverture, ou sur l'instant où le crédit se libère. Et c'est la règle à
laquelle l'utilisateur tient le plus.

Ce que la couche apporte se réduit donc à trois choses :

- `unlocksToGrants()` traduit des lignes de table en `Grant[]` ;
- `computeQuota()` et `applyGrant()`, importés tels quels, décident ;
- une ligne est insérée seulement si `applyGrant` a répondu « accordé, pas déjà
  possédé ».

L'index unique `(user_id, tool_slug)` traduit « rouvrir ne consomme rien » en
contrainte : une seconde ouverture ne peut pas créer de ligne, donc ne peut pas
consommer de crédit, même si un appelant s'y prenait mal. `unlocked_at` reste la
date de la **première** ouverture, exactement comme `applyGrant` le fait avec le
cookie.

Le test `scopes.test.ts` vérifie l'absence : il lit le SQL produit et refuse d'y
voir `interval`, `now()` ou une comparaison sur `unlocked_at`.

**La course qui reste.** Deux déblocages simultanés du dernier crédit peuvent
passer tous les deux : la décision est prise en TypeScript entre une lecture et
une écriture, et le pilote HTTP ne fait pas de transaction. Le coût maximal est
un outil offert, une fois, à quelqu'un qui a cliqué deux fois. Le prix de
l'éviter serait de recoder la fenêtre glissante en SQL, c'est-à-dire la
divergence qu'on refuse.

### Les consentements

Deux fichiers du dépôt réclamaient cette table par écrit. `src/lib/email/contacts.ts` :
« chez Resend, l'audience est une liste de diffusion, pas une preuve. La preuve
du consentement devra vivre dans NOTRE base ». Et `src/lib/consent/consent.ts`,
dont le choix cookies vit dans `localStorage`, donc dans un seul navigateur, donc
nulle part le jour où il faut le produire.

Quatre colonnes portent la preuve, et chacune répond à une question qui sera
posée telle quelle :

- `purpose` : à **quoi** la personne a dit oui. Une ligne par finalité, jamais
  une ligne avec quatre booléens. Accepter la lettre d'information et refuser
  d'être appelé sont deux décisions, prises parfois à des instants différents et
  retirées séparément.
- `collected_at` : **quand**, et c'est Postgres qui le dit. La valeur par défaut
  de la colonne est `now()`, et `recordConsent()` n'accepte **aucun** paramètre
  de date. Un `now` optionnel, même bien intentionné, finirait rempli avec une
  valeur venue d'un corps de requête.
- `source` : **d'où** il vient. Sans l'origine, on sait qu'un accord existe mais
  pas ce qu'on montrait à la personne au moment où elle l'a donné.
- `version` : **sous quel périmètre**. Un accord de 2026 ne couvre pas une
  finalité ajoutée en 2027.

Deux partis pris qui méritent d'être dits. Les **refus sont enregistrés** :
`granted` est un booléen, pas une présence de ligne, parce qu'un refus se produit
en défense et empêche de reposer la question indéfiniment. Et la table est **en
ajout seul** : retirer un consentement s'écrit en nouvelle ligne, jamais en
modification de l'ancienne. Écraser détruirait exactement ce qu'on cherche à
conserver.

## Le droit à l'effacement

L'article 17 ne demande pas qu'on **puisse** effacer, il demande qu'on efface. La
différence tient à ce qu'on oublie : une table ajoutée l'an prochain, qu'un
script écrit à la main ne connaîtra pas.

D'où le parti pris : l'effacement n'est pas une liste d'instructions, c'est
**une** suppression dans `users`, et le schéma fait le reste.

```
users ─┬─ accounts
       ├─ sessions
       ├─ user_profiles
       ├─ tool_unlocks
       ├─ estimations ─── estimation_results
       ├─ comparable_sets ─── comparable_items
       ├─ consents
       └─ contacts ─── leads
```

Toutes ces arêtes sont en `on delete cascade`. Ajouter une table sans la
rattacher à cette arborescence est une faute, et `schema.test.ts` la fait
échouer : le test parcourt le graphe et exige que chaque table atteigne `users`
en cascade, y compris celles qui n'existent pas encore.

Deux arêtes sont volontairement en `set null` : `leads.estimation_id` et
`comparable_sets.estimation_id`. Oublier une estimation ne doit pas effacer une
transaction commerciale ni le travail de sélection qui l'a produite.

Trois choses que la cascade ne couvre pas, traitées par `queries/erasure.ts` :

- les `verification_tokens`, indexés par adresse et non par compte ;
- les contacts jamais rattachés à un compte, effaçables par leur seule adresse
  (`forgetEmail`) ;
- **les données confiées à des tiers**. Une liste Brevo ou une audience Resend ne
  s'efface pas par une clé étrangère. La propagation reste à la charge de
  l'appelant.

Le registre de consentement part aussi, ce qui ressemble à détruire une preuve.
Le raisonnement est le suivant : la preuve d'un consentement ne justifie qu'un
traitement en cours. Quand il n'y a plus ni compte, ni contact, ni envoi, il n'y
a plus rien à justifier, et garder le registre reviendrait à conserver des
données personnelles pour se défendre d'un traitement qui n'existe plus.

## Le client

`src/lib/db/client.ts` ouvre la connexion Neon en **HTTP**. Chaque invocation
serverless peut être un processus neuf, et une poignée de main TCP plus une
négociation TLS coûtent plus cher que la requête elle-même. Le mode HTTP envoie
une requête comme on envoie un `fetch`, sans connexion à garder ouverte et sans
pool à épuiser. C'est aussi la seule forme qui fonctionne dans le runtime Edge.

Ce qu'il ne fait pas : les **transactions multi-instructions**. Chaque appel est
atomique tout seul, et rien de plus. Aucune écriture du produit n'en a besoin
aujourd'hui ; les deux endroits où deux instructions se suivent sont documentés
dans le code, avec la dégradation qui en résulte. Le jour où une transaction sera
nécessaire, `drizzle-orm/neon-serverless` et le pilote WebSocket sont
l'échappatoire, sans changer une ligne de schéma.

**L'absence de `DATABASE_URL` ne lève jamais à l'import.** Le module se charge
toujours ; `getDb()` lève seulement si quelqu'un demande vraiment une requête, et
avec un message qui dit quoi faire. `isDatabaseConfigured()` permet de décider
sans provoquer d'erreur, comme `isAuthConfigured` le fait déjà pour la connexion,
et `tryGetDb()` rend `null` pour ceux qui préfèrent dégrader que rattraper. Une
valeur présente mais qui ne ressemble pas à une chaîne Postgres est traitée comme
absente, avec un avertissement : c'est la position de `src/config/env.ts`,
avertir sans jamais interrompre.

## Les fonctions d'accès

`src/lib/db/queries/` expose **une fonction par intention**, jamais l'ORM. Aucune
page, aucune route ne doit importer `drizzle-orm` : elles appellent
`listEstimations` ou `grantStoredAccess`, et cette couche reste seule à savoir
qu'il y a des tables derrière.

| Module | Ce qu'il sait faire |
| --- | --- |
| `unlocks.ts` | `readStoredAccess`, `hasStoredAccess`, `grantStoredAccess` |
| `estimations.ts` | `listEstimations`, `saveEstimation`, `readEstimation`, `readSharedEstimation`, `shareEstimation`, `unshareEstimation`, `forgetEstimation`, `clearEstimations` |
| `comparables.ts` | `readCurrentSet`, `readComparableSet`, `listComparableSets`, `createComparableSet`, `addComparable`, `removeComparable`, `updateComparable`, `clearComparableSet`, `deleteComparableSet`, `setComparableSubject` |
| `consents.ts` | `recordConsent`, `recordConsents`, `listConsents`, `currentConsent` |
| `leads.ts` | `upsertContact`, `recordLead`, `readContactByEmail`, `listLeadsOfContact` |
| `profiles.ts` | `readProfile`, `upsertProfile` |
| `erasure.ts` | `eraseUser`, `forgetEmail`, `purgeExpired` |

Les écritures rendent un résultat plutôt que de lever, comme
`ContactSyncOutcome` le fait déjà pour les listes de diffusion. Trois issues, et
elles ne se valent pas : `stored: true`, `reason: "not_configured"` qui n'est pas
une panne mais le contrat du dépôt, et `reason: "failed"` qui en est une et qui
est journalisée. Se rabattre silencieusement sur le navigateur dans le second cas
masquerait une base en train de tomber.

**Une exception, et elle est importante** : la lecture du quota ne rattrape rien.
Une base configurée mais muette ne doit pas se traduire par « aucun déblocage
compté », ce qui ouvrirait la bibliothèque en grand. L'erreur remonte, et
l'appelant doit refuser.

Toute lecture de donnée personnelle est bornée à son propriétaire. Les clauses
`where` sont isolées dans `src/lib/db/scopes.ts` précisément pour être
vérifiables : `scopes.test.ts` construit chaque requête et lit le SQL produit.
Une requête qui oublie `user_id = ?` ne lève pas, ne ralentit rien, et rend
l'estimation de quelqu'un d'autre ; elle passe la relecture parce qu'elle a l'air
correcte, et les tests d'interface parce qu'en développement il n'y a qu'un
compte. Le seul endroit où elle se voit est le SQL.

## Les migrations

Elles sont dans `drizzle/`, versionnées, et **jamais appliquées automatiquement**.

```bash
pnpm db:generate            # relit le schéma, écrit un nouveau fichier SQL
pnpm db:generate --name=…   # avec un nom lisible plutôt qu'un nom tiré au sort
pnpm db:check               # vérifie la cohérence de l'historique
pnpm db:migrate             # APPLIQUE, sciemment, sur la base pointée
```

`db:generate` ne demande aucune connexion : il compare le schéma à l'historique
déjà écrit. Seul `db:migrate` touche une base, il faut savoir laquelle, et il
n'est branché sur aucun script de build. Une migration appliquée par un build sur
la base de production est le genre d'accident qu'on ne remarque qu'une fois les
données parties.

La migration initiale, `0000_socle_persistance.sql`, crée les treize tables,
quatorze clés étrangères et seize index. Elle **n'a pas été exécutée** : aucune
base n'était joignable depuis l'environnement où elle a été écrite.

## Ce qu'il reste à brancher

Dans cet ordre, parce que chaque étape suppose la précédente.

**1. Déclarer la variable.** Ajouter `DATABASE_URL` au schéma Zod de
`src/config/env.ts`, en optionnel comme tout le reste :
`DATABASE_URL: z.string().url().optional()`. Puis exposer `env.databaseUrl`.
Aujourd'hui `src/lib/db/config.ts` lit `process.env.DATABASE_URL` en direct, comme
`src/lib/auth/config.ts` lit ses trois secrets ; les deux devraient converger vers
`env`, et c'est le bon moment.

**2. Appliquer les migrations.** Créer la base Neon, poser `DATABASE_URL` et
`DATABASE_URL_UNPOOLED` dans `.env.local`, lancer `pnpm db:migrate` et vérifier
les treize tables. Le faire d'abord sur une branche Neon, pas sur la base
principale.

**3. Poser l'adaptateur.** Dans `src/lib/auth/config.ts` :

```ts
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

adapter: isDatabaseConfigured()
  ? DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    })
  : undefined,
```

L'adaptateur doit rester **conditionnel** : sans base, la configuration reste
inerte et la session en JWT continue de fonctionner, ce qui est le contrat du
dépôt. La conformité de forme est déjà vérifiée par `pnpm typecheck`, donc cette
étape ne devrait rien révéler.

**4. Choisir la stratégie de session.** `session: { strategy: "jwt" }` peut
rester : l'adaptateur sert alors uniquement à persister les comptes et les
utilisateurs, ce qui est déjà l'essentiel. Basculer en `"database"` fait des
`sessions` la source de vérité, permet de révoquer une session côté serveur, et
coûte une requête par requête authentifiée. La table est prête dans les deux cas.

**5. Brancher le verrou.** Dans `src/lib/access/ledger.ts`, faire lire
`readStoredAccess` / `grantStoredAccess` quand une session existe **et** que la
base est configurée, et garder le cookie signé pour les visiteurs anonymes. Le
cookie reste utile : c'est lui qui porte les déblocages de qui n'a pas de compte.
Prévoir le report des déblocages du cookie vers la base à la première connexion,
sinon la mise en ligne fera perdre à tout le monde ce qui avait été obtenu.

**6. Brancher les estimations.** `POST /api/estimation` appelle `saveEstimation`
avec l'identifiant de session s'il y en a un. Côté client,
`useEstimationHistory()` devient la couche « visiteur anonyme », comme son
en-tête l'annonce déjà : le module de base rend un `EstimationSummary` qui est un
sur-ensemble de `EstimationRecord`, l'affectation est vérifiée à la compilation
par `mappers.test.ts`, et aucun composant n'a besoin de changer.

**7. Brancher le panier.** `ComparablesProvider` lit et écrit la base quand il y
a une session, `localStorage` sinon. La forme est identique, `SavedComparable`
étant structurellement `ComparableEntry`.

**8. Brancher les consentements et les leads.** `POST /api/leads` appelle
`recordConsents` puis `recordLead`, et peut alors répondre **201** au lieu de
202. C'est aussi le moment de rendre à `scoreLead` la bande « valeur estimée », en
la relisant depuis `estimation_results` plutôt que depuis le corps de la requête.
Ne pas oublier `answerConsent()` côté bandeau cookies, qui doit désormais écrire
aussi côté serveur.

**9. Le compte.** `readProfile` et `upsertProfile` alimentent une page de compte,
`eraseUser` un bouton de suppression, `listConsents` un export de ce qu'on
détient. Les trois sont exigés par le règlement et aucun n'existe aujourd'hui.

**10. Le ménage.** `purgeExpired` doit tourner sur une tâche planifiée, pas sur
une requête utilisateur. Auth.js ne supprime pas les sessions périmées, il les
ignore.

## Ce qui n'a pas pu être vérifié

Aucune base n'était joignable pendant l'écriture de cette couche. Ce qui suit n'a
donc **pas** été éprouvé et demande une vérification manuelle à la première
connexion :

- **l'exécution de la migration**. Le SQL est produit par `drizzle-kit` à partir
  d'un schéma qui compile, mais personne ne l'a lancé ;
- **le comportement réel de l'adaptateur Auth.js**. La conformité est vérifiée
  au niveau des types, ce qui couvre les noms et les formes de colonnes, mais pas
  un aller-retour OAuth complet ;
- **les `on conflict`**. `upsertContact`, `saveEstimation` et `upsertProfile`
  reposent sur des index uniques et sur `excluded.*` ; la syntaxe est celle de
  Postgres et le SQL est produit par Drizzle, mais l'idempotence n'a été observée
  sur aucune vraie collision ;
- **les performances**. Les index sont posés d'après les requêtes écrites, pas
  d'après un plan d'exécution mesuré ;
- **le `jsonb` de `ValuationResult`**. La sérialisation d'un résultat complet
  avec ses cent comparables n'a pas été mesurée, ni pour sa taille ni pour son
  temps de lecture ;
- **`gen_random_uuid()`**. Intégré à Postgres depuis la version 13 et donc
  disponible sur Neon, mais la migration ne crée aucune extension : si la base
  était plus ancienne, il faudrait activer `pgcrypto`.

Les tests livrés portent sur ce qui est éprouvable sans base : la forme du
schéma, la compatibilité avec l'adaptateur, la présence de `timestamptz`, le
graphe d'effacement, la construction des clauses `where`, la traduction des
lignes en objets du domaine, la cohérence avec `summarise()` et avec
`access/core.ts`, et le comportement quand `DATABASE_URL` est absent. Quatre-vingts
cas environ, tous sans connexion.
