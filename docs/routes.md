# Cartographie des routes

Deux régimes coexistent, et les confondre coûterait cher : indexer des mutations
DVF détaillées est interdit par le décret du 28/12/2018.

Il n'y a **pas** de troisième régime. Aucune page n'exige de compte, parce qu'il
n'y a pas de compte.

## 1. Public et indexable

Ce sont les seules pages qui existent pour un moteur de recherche. Elles sont
listées dans `sitemap.ts` et autorisées dans `robots.ts`.

| Route | Rôle | Rendu |
|---|---|---|
| `/` | Accueil, entrée d'acquisition | statique |
| `/estimer` | Parcours d'estimation en six étapes | statique |
| `/carte` | Carte DVF des ventes, plein écran | statique |
| `/observatoire` | Carte augmentée : indicateurs, dispersion | statique |
| `/observatoire/transactions` | Recherche tabulaire des mutations | statique |
| `/outils` | Bibliothèque des dix calculateurs | statique |
| `/outils/[slug]` | Les dix fiches, pré-générées | statique (SSG) |
| `/solutions` + ses trois offres | Pôle professionnel | statique |
| `/a-propos`, `/mentions-legales`, `/confidentialite` | | statique |

### Pourquoi `/observatoire` est indexable alors qu'il sert du DVF

Ce que le robot reçoit, c'est **l'outil** : un titre, une description, une carte
vide et des filtres. Pas une seule mutation détaillée n'est rendue côté serveur —
la donnée arrive par `fetch` après l'hydratation. On indexe la page d'outil,
jamais le jeu de données.

### Pourquoi `/carte` et `/observatoire` ne font pas doublon

C'est la distinction à tenir, et elle est structurante :

- **`/carte`** — la carte DVF **brute**, plein écran, sans chrome d'analyse.
  C'est la démonstration : elle prouve, elle se partage, elle ne capture rien.
- **`/observatoire`** — la **même donnée, augmentée** : indicateurs de marché,
  dispersion des prix au m², recherche tabulaire, sélection de comparables. C'est
  l'outil de travail.

## 2. Public mais NON indexable

| Route | Pourquoi `noindex` |
|---|---|
| `/observatoire/comparables` | Deux raisons qui se rejoignent. Il n'y a rien à indexer — la page rend une sélection **personnelle**, tenue dans le navigateur, et un robot n'y verrait qu'un état vide. Et ce qu'elle affiche, quand elle affiche quelque chose, ce sont des mutations détaillées, adresse comprise. |

`follow` reste vrai : les liens sortants vers l'observatoire et la recherche
doivent continuer d'irriguer le reste du site.

## 3. Routes API

| Route | Méthode | Cache |
|---|---|---|
| `/api/geocode` | GET | `s-maxage=3600`, `noindex` |
| `/api/dvf/transactions` | GET | `s-maxage=3600` — les mutations sont immuables |
| `/api/dvf/transactions/[id]` | GET | idem |
| `/api/estimation` | POST | `no-store` |
| `/api/estimation/pdf` | POST | `no-store`, `noindex` |
| `/api/leads` | POST | `no-store` |

Toutes les réponses DVF portent `X-Robots-Tag: noindex, nofollow, noarchive`, en
plus du `Disallow: /api/` de `robots.ts`. Ceinture et bretelles : une métadonnée
de page ne protège pas une route JSON.

`/api/estimation/pdf` est un **POST** et non un `GET /api/estimation/[id]/pdf` :
aucun résultat n'étant stocké, le rapport se fabrique à partir du
`ValuationResult` que la page détient déjà. Un identifiant dans l'URL supposerait
un stockage, donc promettrait un lien partageable qui ne survivrait pas au
rechargement.

## 4. Le contrôle du rendu statique

Le build doit montrer **toutes** les pages en `○ (Static)` ou `● (SSG)`, et seules
les routes `/api/*` en `ƒ (Dynamic)`. Une page qui bascule en dynamique signale
presque toujours qu'un `cookies()`, un `headers()` ou un `searchParams` vient
d'apparaître dans un layout — c'est exactement ce qu'il faut attraper en revue.
