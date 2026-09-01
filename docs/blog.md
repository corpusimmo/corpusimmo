# Le journal

Le blog est **construit mais pas montré**. Les pages existent, elles sont
générées au build, le flux RSS est en place, trois articles sont écrits. Rien
n'est proposé aux moteurs, aucune entrée de menu n'y mène, et le plan du site
ne le déclare pas.

Ce document dit comment écrire un article, comment le publier, et quels gestes
exacts restent à faire le jour où la rubrique devient visible.

## Où vit quoi

| Chemin | Rôle |
| --- | --- |
| `src/content/blog/*.md` | Les articles. Un fichier, un article, une URL. |
| `src/types/blog.ts` | Le contrat d'un article. |
| `src/lib/blog/` | Lecture, validation, tri, filtrage, temps de lecture, plan du site. |
| `src/app/(site)/blog/page.tsx` | L'index. |
| `src/app/(site)/blog/[slug]/page.tsx` | La fiche d'un article. |
| `src/app/(site)/blog/rss.xml/route.ts` | Le flux RSS, articles publiés uniquement. |
| `src/lib/blog/visibility.ts` | L'interrupteur `BLOG_IS_PUBLIC`. |

Le découpage suit celui de `src/lib/access/` : la logique pure (`select.ts`,
`markdown.ts`, `post.ts`) ne connaît ni le disque ni Next, et se teste donc
sans monter un build. `registry.ts` est la seule couche qui lit des fichiers.

## Ajouter un article

1. Créer `src/content/blog/mon-nouvel-article.md`. **Le nom du fichier fait
   l'URL** : ce fichier sera servi sous `/blog/mon-nouvel-article`. Minuscules,
   chiffres et tirets simples, sans accent.
2. Écrire l'en-tête, puis le corps en Markdown.
3. Lancer `pnpm vitest run src/lib/blog`. Le test de contenu lit les vrais
   fichiers : si une clé manque, il le dit, avec le nom du fichier.

### L'en-tête

```markdown
---
title: Pourquoi un prix au m² de quartier ne vaut pas pour votre bien
excerpt: Une à trois phrases. Sert de chapeau, de méta-description et de description RSS.
status: draft
category: methode
publishedAt: 2026-09-22
updatedAt: 2026-10-06
author: Rédaction CorpusImmo
authorRole: Analyse de données
tags: [méthode, prix au m2]
socialImage: /og/blog/mon-article.png
related:
  - ce-que-dvf-dit-et-ne-dit-pas
---
```

| Clé | Obligatoire | Défaut | Règle |
| --- | --- | --- | --- |
| `title` | oui | | Le `h1` de la page. Le corps ne doit pas en créer un second. |
| `excerpt` | oui | | Une à trois phrases, écrites pour une personne. |
| `status` | non | `draft` | `draft` ou `published`. **L'oubli ne publie rien.** |
| `category` | oui | | `methode`, `donnees`, `marche` ou `pratique` (`src/lib/blog/taxonomy.ts`). |
| `publishedAt` | oui | | `AAAA-MM-JJ`, date réelle au calendrier. |
| `updatedAt` | non | `publishedAt` | Jamais antérieure à la publication. |
| `author` | oui | | Le nom affiché sous le titre. |
| `authorRole` | non | | La fonction, affichée à côté du nom. |
| `tags` | non | aucune | Libres. Normalisées en minuscules, dédoublonnées. |
| `socialImage` | non | image générée | Commence par `/` ou `https://`. Voir l'avertissement plus bas. |
| `related` | non | calculés | Slugs d'articles à mettre en avant, dans l'ordre voulu. |
| `slug` | non | nom du fichier | À n'utiliser que pour renommer une URL sans renommer le fichier. |

Deux écritures de liste sont acceptées, `[a, b]` sur une ligne ou une suite de
tirets sur les lignes suivantes. Une valeur peut contenir des deux-points : la
coupure se fait au **premier** seulement.

**`socialImage` désactive l'image sociale générée** par la convention de
fichier (`opengraph-image.tsx`). Ne la renseigner que pour une illustration
propre à l'article, sinon la laisser absente.

### Le Markdown accepté

L'analyseur est maison (`src/lib/blog/markdown.ts`), il n'y a pas de MDX dans
le dépôt. Ce qu'il comprend, et rien d'autre :

- `##` et `###` pour les titres. Un `#` est ramené au niveau 2, le `h1` étant
  déjà le titre de l'en-tête.
- Les paragraphes, séparés par une ligne vide. Les retours à la ligne à
  l'intérieur d'un paragraphe sont recollés.
- Les listes `- ` et `1. `.
- Les citations `> `.
- `**gras**`, `*italique*`, `` `code` ``, `[libellé](adresse)`.
- `---` pour un filet.

Ce qui n'existe pas : les images, les tableaux, les blocs de code, le HTML
brut. Les marques ne s'imbriquent pas : un gras à l'intérieur d'un lien reste
du texte.

Deux garde-fous, volontaires :

- **Aucun HTML ne peut entrer.** Le corps devient un arbre de nœuds typés, rendu
  en JSX. Il n'existe aucun chemin entre un fichier et `dangerouslySetInnerHTML`.
- **Les liens sont filtrés par schéma.** Seuls `https://`, `/`, `#` et `mailto:`
  produisent un lien ; le reste ne garde que son libellé.

### La typographie

Écrire du français normal, avec des espaces ordinaires. Les espaces insécables
avant `: ; ! ?` et à l'intérieur des guillemets français sont posées à la
lecture, dans `frenchSpacing()`.

Une règle n'est pas automatisée et se vérifie à la relecture : **pas de tiret
cadratin dans un texte visible**. Deux-points, virgule, point-virgule,
parenthèses ou une phrase coupée en deux font le même travail. Un test échoue
si un article en contient un (`src/lib/blog/content.test.ts`).

## Publier un article

Une ligne : `status: published`.

À partir de là, et sans autre intervention, l'article est généré au build,
listé sur l'index, présent dans le flux RSS et dans `blogSitemapEntries()`. Il
n'est **indexable** que si le journal est ouvert (voir la section suivante).

Un brouillon, à l'inverse, est visible en développement uniquement. En
production il n'est ni listé, ni construit, ni atteignable : `dynamicParams`
vaut `false` sur la fiche d'article, donc une URL devinée rend un 404.

## Le jour de la mise en visibilité

Trois gestes, dans cet ordre. Aucun ne demande d'écrire du code.

**1. Ouvrir le journal.** Dans `src/lib/blog/visibility.ts` :

```ts
export const BLOG_IS_PUBLIC = true;
```

C'est le retrait du `noindex`. Le second verrou reste en place : tant qu'aucun
article n'est publié, l'index reste `noindex` malgré ce drapeau.

**2. Brancher le plan du site.** Dans `src/app/sitemap.ts`, à l'endroit prévu :

```ts
import { blogSitemapEntries } from "@/lib/blog";
```

```ts
routes.push(...blogSitemapEntries());
```

`blogSitemapEntries()` ne rend que les articles **publiés**, et ne rend rien
tant que `BLOG_IS_PUBLIC` vaut `false` : un plan de site ne doit jamais
annoncer une URL que la page déclare `noindex`. Le branchement peut donc être
fait avant l'ouverture sans rien exposer.

L'index `/blog` lui-même n'est pas dans cette liste, qui ne porte que des
articles. Il entre au plan du site par la découverte automatique, en retirant
`"/blog"` de `EXCLUDED_PREFIXES` dans `src/lib/seo/routes.ts`. Attention : la
découverte produirait alors le motif `/blog/[slug]`, qu'il faut résoudre dans
la table `DYNAMIC_PARAMS` du même fichier :

```ts
"/blog/[slug]": publishedBlogPosts().map((post) => post.slug),
```

**3. Mettre l'entrée au menu.** Dans `src/config/navigation.ts`, dans `mainNav` :

```ts
  { label: "Journal", href: "/blog", status: "live", description: "Méthode, données publiques et limites assumées" },
```

Placer l'entrée après « Outils » : le menu trie par intention, et lire vient
après faire.

**Puis mettre les tests à jour.** Deux d'entre eux décrivent l'état actuel et
échoueront, ce qui est leur rôle :

- `src/lib/blog/content.test.ts`, bloc « le journal n'est pas encore ouvert ».
  Le remplacer par ce que l'on veut garantir ensuite, par exemple qu'au moins
  un article est publié.
- `src/lib/blog/registry.test.ts`, test « n'expose rien tant que le journal
  n'est pas ouvert ».

## Vérifier

```bash
pnpm vitest run src/lib/blog   # lecture, validation, tri, brouillons, flux, plan du site
pnpm typecheck
pnpm lint
```

Le test de contenu lit les vrais fichiers du dépôt. Un en-tête incomplet fait
échouer le test avant de faire échouer un build, avec le nom du fichier et la
clé fautive.

## Ce qui n'existe pas encore

Ces manques sont assumés ; les fonctions nécessaires existent déjà dans
`src/lib/blog/select.ts`, il ne manque que les pages.

- **Pas de page de rubrique ni d'étiquette.** `byCategory()` et `byTag()` sont
  écrits et testés. Le jour venu, une route statique
  `/blog/rubrique/[id]` avec `generateStaticParams` fera l'affaire. Aucun
  filtre ne passera par un paramètre de requête : lire la requête rendrait la
  page dynamique, ce que le dépôt s'interdit.
- **Pas de pagination.** Inutile en dessous de trente articles.
- **Pas d'images dans les articles.** Ni la syntaxe Markdown, ni le rendu.
- **Le flux RSS ne porte que les chapeaux**, pas le corps complet.
