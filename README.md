# CorpusImmo

> **L'immobilier sur pièces.**

Plateforme française d'estimation immobilière et d'observatoire des
transactions, construite sur les **DVF** — les Demandes de Valeurs Foncières
publiées en open data par la DGFiP.

Un *corpus*, en science comme en droit, est un ensemble fini, clos et structuré
de pièces authentiques réunies pour être analysées : rien n'y entre qui n'ait été
constaté. C'est exactement ce qu'est DVF, et c'est tout l'écart avec un
estimateur qui extrapole depuis des annonces. Une annonce est une demande ; un
acte est un fait.

Résidentiel et professionnel vivent sur le même site, sous le même menu. Il n'y
a pas d'espace « Particuliers » et pas d'espace « Pros » — l'usage est une
question posée à l'intérieur des outils, jamais une branche de navigation.
Pourquoi : **[docs/architecture.md](docs/architecture.md)**.

---

## Démarrage

```bash
pnpm install
pnpm dev
```

L'application démarre sur <http://localhost:3000> **sans aucune variable
d'environnement** et sert de vraies données DVF. Aucune clé d'API n'est requise
pour le géocodage, la carte ou les transactions.

```bash
pnpm build      # build de production
pnpm start      # sert le build
pnpm check      # typecheck + lint + tests
```

---

## Stack

| Brique | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15**, App Router | Server Components, route handlers, déploiement sans configuration |
| Langage | **TypeScript strict** + `noUncheckedIndexedAccess` | le moteur d'estimation manipule des tableaux en continu |
| Styles | **Tailwind CSS v4**, tokens en CSS natif | l'identité tient dans un fichier, sans provider React |
| Carte | **MapLibre GL** + tuiles vectorielles OpenFreeMap | open source, sans clé, sans quota commercial |
| Graphiques | SVG écrits à la main | ~150 ko économisés par rapport à une librairie de charts |
| Icônes | lucide-react | tree-shaké via `optimizePackageImports` |
| Validation | zod | toute entrée externe est validée côté serveur |
| Tests | Vitest + Testing Library | rapide, même résolution d'alias que l'app |

**Aucune base de données, aucune authentification.** C'est une décision, pas un
manque : voir « Persistance » plus bas.

---

## Ce qui est réel

| Module | État |
|---|---|
| Carte DVF plein écran | **réel** |
| Géocodage d'adresse (Géoplateforme IGN / BAN) | **réel** |
| Estimateur en six étapes, résidentiel et professionnel | **réel** |
| Moteur de valorisation par comparaison | **réel**, 131 tests |
| Observatoire : indicateurs, recherche tabulaire, comparables | **réel** |
| Dix outils de calcul métier | **réel** |
| Rapport PDF d'estimation | **réel** |
| Pages Solutions | descriptives, rien n'est ouvert à la commande |

Il n'y a **aucune donnée de démonstration** dans ce dépôt. Tout ce qui s'affiche
vient de DVF, ou d'une saisie de l'utilisateur.

---

## Variables d'environnement

Toutes sont **optionnelles**. Copier `.env.example` en `.env.local` pour les
activer.

| Variable | Effet si absente |
|---|---|
| `NEXT_PUBLIC_APP_URL` | détectée depuis la plateforme, sinon `http://localhost:3000` |
| `NEXT_PUBLIC_MAP_STYLE_URL` | la carte construit son propre style vectoriel |
| `DVF_PROVIDER` | `geodvf` (fichiers Etalab) |
| `USE_MOCK_DVF` | `false` — et **ignoré en production**, par conception |
| `EMAIL_PROVIDER` / `EMAIL_PROVIDER_KEY` | les e-mails sont journalisés dans le terminal |

La CI rejoue `pnpm build` avec un environnement **vide** à chaque push : c'est ce
qui vérifie en continu qu'aucune clé n'est devenue obligatoire.

---

## Les quatre règles sur les données

Elles ne sont pas décoratives : elles sont appliquées dans le code, et testées.

1. **Jamais de repli silencieux.** Si la source est indisponible, l'interface dit
   « les transactions sont temporairement indisponibles » et propose de
   réessayer. Elle ne substitue jamais de fausses valeurs.
2. **Plancher statistique de cinq mutations.** En dessous, aucune valeur ni
   médiane n'est publiée.
3. **Aucun comparable ne pèse plus de 40 %.** Sans ce plafond, une « valeur de
   marché » pourrait n'être que le prix d'une seule vente — c'est autant une
   exigence statistique qu'une exigence de secret.
4. **Le mot est estimation, jamais expertise.**

Détail des sources, pièges de parsing et contraintes réglementaires :
**[docs/dvf.md](docs/dvf.md)**.

---

## Moteur d'estimation

Méthode par comparaison, documentée pas à pas dans
**[docs/valuation-engine.md](docs/valuation-engine.md)** : escalade de rayon,
filtrage des mutations inexploitables, pondération distance / récence / surface /
typologie par moyenne géométrique, prix au m² robuste, fourchette dont la largeur
dépend de la qualité du jeu de comparables, et score de confiance.

Le moteur **préfère ne rien répondre** plutôt que répondre un chiffre que la
donnée ne soutient pas.

---

## Design system

Une seule direction artistique, figée. Pas de sélecteur, pas de variantes, pas de
cookie lu au rendu — c'est ce qui garde **toutes les pages statiques**.

```
Bleu nuit  #1B3349   ·  l'encre et l'action
Bronze     #8A6A2F   ·  la marque, la sélection, les filets
Papier     #F6F5F2   ·  le fond, chaud et non bleuté
```

Titrage en Source Serif 4, interface en Inter, rayons courts, ombres fermes. Le
registre visé : un document de banque d'affaires devenu logiciel.

Les composants n'écrivent **jamais** de couleur : ils consomment des tokens
sémantiques (`bg-surface`, `text-ink-muted`, `bg-accent`…). Changer l'identité de
marque = éditer `src/app/globals.css`, et rien d'autre. Détail :
**[docs/design-system.md](docs/design-system.md)**.

---

## Persistance

Il n'y a **ni base de données, ni compte, ni mot de passe**, et c'est assumé pour
cette version :

- l'estimation est calculée et renvoyée **en entier** ; la page la détient, le
  PDF se fabrique à partir du même objet. Conséquence honnête : **pas de lien
  partageable** vers un résultat, parce qu'une URL permanente qui ne survivrait
  pas au rechargement serait exactement le genre de fausse promesse que ce
  produit s'interdit ailleurs ;
- la saisie en cours et la sélection de comparables vivent dans le navigateur ;
- un contact soumis est validé, scoré et envoyé par e-mail, puis oublié. La route
  répond `202 Accepted`, jamais `201 Created` : rien n'a été créé.

Ce que cela coûte, et ce qu'il faudra brancher, est écrit dans
**[docs/architecture.md](docs/architecture.md)**.

---

## Documentation

| Document | Sujet |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Arborescence, flux de données, décisions techniques et ce qui reste à construire |
| [docs/design-system.md](docs/design-system.md) | Tokens, composants, accessibilité, mouvement, responsive |
| [docs/routes.md](docs/routes.md) | Le régime de chaque route : public, indexable, `noindex` |
| [docs/dvf.md](docs/dvf.md) | La donnée : source, pièges, vie privée, secret statistique |
| [docs/valuation-engine.md](docs/valuation-engine.md) | Le calcul, étape par étape |
| [docs/data-sources.md](docs/data-sources.md) | Sources branchées et candidates, contraintes juridiques |
| [docs/strategie-commerciale.md](docs/strategie-commerciale.md) | Client cible, offre, tunnel, métriques |

---

## Licence et attributions

Données DVF : DGFiP, diffusées en open data via data.gouv.fr. Fond de carte :
OpenFreeMap sur données OpenStreetMap (ODbL). Géocodage : Géoplateforme IGN, base
adresse nationale. L'usage de ces données est soumis aux conditions rappelées
dans [docs/dvf.md](docs/dvf.md), notamment l'interdiction de réidentification et
d'indexation par les moteurs de recherche.
