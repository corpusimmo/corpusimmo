# Architecture

## La décision fondatrice : un seul site, une seule navigation

Tout vit sur un seul domaine, sous une seule marque, avec **un seul menu**. Il
n'y a pas d'espace « Particuliers » et pas d'espace « Professionnels ».

Trois raisons, dans l'ordre d'importance :

1. **Le référencement.** Un domaine neuf passe par une sandbox de 3 à 6 mois, et
   jusqu'à 12 sur l'immobilier, classé YMYL. Deux domaines, ou deux menus, c'est
   deux sandbox et une autorité divisée. Le menu est répété sur toutes les pages :
   c'est lui qui irrigue l'autorité vers tous les hubs. Deux menus coupent le
   graphe de liens en deux grappes faiblement connectées.
2. **La preuve commerciale.** L'estimateur, la carte et les outils ne sont pas le
   produit : ce sont les **démonstrations**. Un professionnel qui découvre
   l'offre de services doit constater en deux clics qu'on a construit un
   estimateur et une carte qui fonctionnent. Séparer les outils des services
   revient à séparer l'argument de vente de la page de vente.
3. **Presque tout est partagé.** La carte, l'observatoire, les outils, l'à-propos
   servent les deux audiences. Dans un modèle à deux espaces, où met-on la
   carte ? Dans l'espace grand public, et le professionnel doit « sortir de son
   espace » pour voir la démo phare ? Dupliquée, et on crée du contenu dupliqué
   et une double maintenance ?

**Règle de décision, à opposer à toute reprise du débat :** un espace séparé se
justifie quand chaque audience remplit son propre menu, que presque rien n'est
partagé, et qu'il existe un produit connecté derrière. Zéro sur trois
aujourd'hui.

L'évolution naturelle existe : le jour où l'offre professionnelle devient un vrai
produit — abonnement data, API, tableau de bord — un espace connecté se
justifiera, sous forme d'**application avec login**, pas de site marketing
séparé.

### La règle de tri, à trois niveaux

1. **Le menu trie par intention** — estimer, explorer, calculer, déléguer.
   Jamais d'onglet « Particuliers », « Professionnels », « Résidentiel » ou
   « Entreprise ».
2. **Les pages trient par audience** — l'accueil parle à tout le monde,
   Solutions parle au professionnel. Mais rien n'est verrouillé par profil.
3. **Résidentiel et professionnel sont des filtres à l'intérieur des outils** —
   la première question de l'estimateur, une pastille sur la carte, une facette
   dans la bibliothèque.

> On trie les gens **une fois à l'entrée**, on trie le contenu **à l'intérieur**,
> on ne trie **jamais le site lui-même**.

---

## Arborescence

```
src/
├── app/
│   ├── (site)/              toutes les pages publiques, une seule coque
│   │   ├── page.tsx                 /
│   │   ├── estimer/                 /estimer
│   │   ├── carte/                   /carte
│   │   ├── observatoire/            /observatoire, /transactions, /comparables
│   │   ├── outils/                  /outils, /outils/[slug]
│   │   ├── solutions/               /solutions et ses trois offres
│   │   ├── a-propos/
│   │   ├── mentions-legales/ · confidentialite/
│   │   └── layout.tsx               en-tête + pied de page, partagés
│   ├── api/                 route handlers — la seule porte vers l'extérieur
│   ├── globals.css          les tokens de la direction artistique
│   ├── layout.tsx           polices, métadonnées, ToastProvider
│   ├── robots.ts · sitemap.ts
│   └── error.tsx · not-found.tsx
├── components/
│   ├── ui/                  design system — 25 primitives
│   ├── charts/              graphiques SVG, zéro dépendance
│   ├── layout/              logotype, en-tête, pied de page
│   ├── map/                 MapLibre, géocodeur, filtres
│   ├── marketing/           sections d'accueil et trame des pages d'offre
│   ├── estimation/          parcours en six étapes + affichage du résultat
│   ├── observatoire/        carte augmentée, recherche tabulaire, comparables
│   └── tools/               moteur des dix calculateurs + bibliothèque
├── lib/
│   ├── dvf/                 adapters de données de transactions
│   ├── geo/                 géocodage, distances, communes
│   ├── valuation/           moteur d'estimation
│   ├── tools/               spécification et définitions des dix outils
│   ├── email/               adapter d'envoi
│   ├── pdf/                 génération du rapport
│   └── leads/               scoring et limitation de débit
├── types/                   contrats partagés — la colonne vertébrale
├── config/                  site, env, navigation
└── data/                    catalogue éditorial des outils
```

Une remarque sur `components/observatoire/` : ces composants venaient d'un
répertoire `pro/` dans le brouillon. Le renommage n'est pas cosmétique — tant
qu'un répertoire s'appelle « pro », quelqu'un finira par y ranger une frontière
d'univers.

---

## Flux de données

```
                    ┌──────────────────────────┐
   Navigateur  ───► │  Route handlers /api/*    │  ← seule sortie réseau
                    │  validation zod           │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
      lib/geo (IGN)      lib/dvf (Etalab)    lib/valuation
      géocodage BAN      DvfProvider          moteur de
                         + cache + dédup      comparaison
```

Règle stricte : **aucun composant React n'appelle une API externe.** Tout passe
par un adapter dans `src/lib`, puis par un route handler. Cela garde les clés
côté serveur, rend le cache possible, et permet de changer de fournisseur sans
toucher à l'interface.

---

## Décisions techniques et leurs raisons

| Décision | Pourquoi |
|---|---|
| **Next.js 15 App Router** | Server Components = moins de JS envoyé ; route handlers = cache HTTP natif ; déploiement sans configuration. |
| **Tailwind v4, tokens en CSS natif** | L'identité tient dans un fichier. Aucun provider de thème, aucun re-render. |
| **Rien n'est lu dans le layout racine** | Ni cookie, ni en-tête, ni session. La moindre lecture de `cookies()` bascule **toutes** les pages en rendu dynamique. Le build le confirme : hors routes API, tout est statique. |
| **MapLibre GL + tuiles vectorielles** | Open source, pas de clé, pas de quota commercial. Le style reste remplaçable par variable d'environnement. |
| **Graphiques en SVG maison** | Une librairie de charts pèse 100 à 200 ko pour cinq graphiques simples. |
| **Pas de librairie de composants headless** | ~25 primitives suffisent. Les écrire évite une dépendance structurante et garde le contrôle total de l'accessibilité. |
| **Une spécification de données pour les dix outils** | Un outil **est** une donnée : ses champs, ses formules, ses résultats. Un seul composant les rend tous, et les barèmes réglementaires vivent dans `params`, jamais dans une formule. |
| **`noUncheckedIndexedAccess`** | Le moteur d'estimation manipule des tableaux en permanence ; cette option transforme une classe entière de bugs silencieux en erreurs de compilation. |

---

## Ce qui n'existe pas, et ce que ça coûte

Ces absences sont des décisions de cadrage, pas des oublis. Chacune est visible
dans l'interface plutôt que masquée.

### Pas de base de données

L'estimation est calculée et **renvoyée en entier**. La page la détient ; le PDF
et la notification par e-mail se fabriquent à partir du même objet.

Ce que ça coûte, précisément :

- **pas de lien partageable** vers un résultat. Une URL `/estimation/<id>` serait
  morte au premier rechargement ;
- **pas d'historique** : personne ne retrouve une estimation faite la semaine
  dernière ;
- **le score de lead est amputé d'une bande**. Le moteur de scoring en compte
  cinq : intention, consentement, complétude, fraîcheur, et valeur du bien. La
  cinquième est délibérément neutralisée, parce que la valeur nous revient du
  client — et qu'un client peut se déclarer propriétaire d'une villa à 2 M€ pour
  gonfler sa propre note. Elle reviendra le jour où une estimation sera relue
  depuis un stockage, pas depuis un corps de requête.

L'objet qui fait l'aller-retour est revalidé par zod au retour
(`lib/valuation/result-schema.ts`) : il a quitté le serveur, il redevient une
entrée non fiable.

### Pas d'authentification

Rien n'est verrouillé : consulter, filtrer, exporter en CSV, télécharger un
rapport, utiliser les dix outils. Le compte n'apparaîtra qu'au moment où quelque
chose devra **survivre à l'appareil** — retrouver une sélection ailleurs,
reprendre une recherche. Jamais avant, et jamais pour un simple téléchargement.

### Pas de données de démonstration

Le brouillon en portait, badgées à l'écran. Elles n'ont pas été reprises : un
module de préfiguration alimenté par des chiffres inventés finit toujours par
être pris pour un module réel. Un seul marqueur de provenance existe
(`components/observatoire/data-notice.tsx`), et il ne dit qu'une chose : d'où
vient la donnée.

---

## Ce qui est prévu mais pas construit

L'architecture réserve la place, sans code inutile aujourd'hui :

- **Autres méthodes de valorisation** : `ValuationMethodId` accepte déjà
  `capitalization`, `dcf`, `replacement_cost`. Ajouter une méthode = ajouter un
  module dans `lib/valuation`, pas refondre le modèle.
- **Atelier de comparaison** : le moteur accepte déjà `comparableIds`,
  `manualWeights` et `excludedIds`, et ces chemins sont testés. Il manque
  l'écran.
- **Pages villes** : `/prix-immobilier/[ville]`, 50 à 100 pages programmatiques.
  C'est le pari de référencement principal, et il n'est pas encore posé.
- **Persistance et comptes** : voir ci-dessus.
