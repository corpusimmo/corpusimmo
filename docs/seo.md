# Référencement naturel

Ce document décrit ce qui est en place, comment le plan du site se régénère sans
qu'on y pense, et ce qui reste à faire hors du dépôt.

Le principe qui commande tout le reste : **un signal envoyé aux moteurs ne doit
jamais dire autre chose que ce que la page dit à ses lecteurs.** Pas de FAQ
balisée qui n'existe pas à l'écran, pas de `Dataset` sur une page qui ne publie
pas de données, pas de « sans compte » dans une description quand la page
demande une connexion, pas de note moyenne quand personne n'a noté. Ce projet
s'interdit les fausses promesses sur les prix ; la règle vaut aussi pour ce
qu'on raconte à Google.

---

## 1. Le plan du site, automatique par construction

`src/app/sitemap.ts` ne contient **aucune liste d'URL**. Il pose une question à
`src/lib/seo/routes.ts` et écrit la réponse.

### Ce que l'inventaire lit

| Source de vérité | Ce qu'elle décide |
|---|---|
| L'arborescence `src/app/**` | Quelles pages **existent** |
| L'export `metadata` de chaque `page.tsx` | Si la page est **indexable** |
| `src/data/tools-catalogue.ts` | Les dix valeurs de `/outils/[slug]` |
| `src/config/navigation.ts` | Ce qui est **publié** et à quel stade (`live`, `beta`, `preview`) |
| Les dates de fichier (`node:fs`) | Le `lastModified` de chaque entrée |

Conséquence directe, et c'est la seule qui compte : **une page ajoutée demain
entre au plan du site sans que personne y pense, et une page passée en `noindex`
en sort par le même mécanisme.** Le plan du site ne peut plus contredire les
métadonnées d'une page, puisqu'il les lit.

Ce n'est pas une promesse théorique. Pendant cette livraison, deux pages écrites
par d'autres sont apparues dans l'arbre : `/cookies` est entrée toute seule dans
le plan du site, `/hors-ligne` en est restée dehors toute seule, parce qu'elle se
déclare `noindex`. Aucune ligne n'a été écrite pour l'une ni pour l'autre.

### Comment la découverte lit le `noindex`

Elle lit le **texte** du fichier et y cherche le jeton `index: false`, sous les
deux formes que le dépôt emploie : `robots: { index: false, … }` écrit à la main
et `pageMetadata({ …, index: false })`. Les commentaires sont retirés avant la
recherche.

Pourquoi pas importer le module de la page pour lire son `metadata` ? Parce que
`/mon-espace` et `/outils/[slug]/calculer` lisent des cookies via `next/headers`
et ne s'importent donc pas hors du rendu d'une requête, et parce que cela
entraînerait tout l'arbre React dans le module du plan du site.

**Le piège, et il est assumé :** écrire `index: false` n'importe où ailleurs dans
un `page.tsx` (une branche d'erreur d'un `generateMetadata`, par exemple) en
sortirait la page sans rien casser. C'est arrivé en écrivant `routes.ts`, et le
test l'a attrapé en moins d'une minute.

### Cadence et priorité

Décidées **par section**, jamais page par page (`SECTION_POLICIES` dans
`routes.ts`) :

| Section | Cadence | Priorité de tête | Pourquoi |
|---|---|---|---|
| `/` | hebdomadaire | 1,0 | La seule page à 1,0, et le test le vérifie |
| `/estimer` | mensuelle | 0,9 | Le parcours change quand la méthode change |
| `/carte`, `/observatoire` | hebdomadaire | 0,9 / 0,8 | Suivent les publications DVF |
| `/outils` | mensuelle | 0,8 | Bouge à la révision d'un barème |
| `/solutions` | mensuelle | 0,6 | Prête pour le jour où l'offre ouvrira |
| Pages légales (`/mentions-legales`, `/confidentialite`, `/cookies`) | annuelle | 0,2 | Doivent être trouvables, ne disputent aucune requête |
| Section inconnue | mensuelle | 0,5 | Une page nouvelle entre sobrement plutôt que pas du tout |

Deux corrections s'appliquent ensuite, et elles sont dérivées, pas décidées :
0,1 de moins par niveau de profondeur, et 0,1 de moins pour une section marquée
`preview` dans la navigation. Une page qui affiche « Bientôt disponible » à ses
lecteurs ne doit pas dire « page majeure » aux moteurs.

### `lastModified` : ce qu'il vaut vraiment

Il est dérivé du `mtime` du `page.tsx`, et pour les fiches outils du plus récent
entre ce fichier, `tools-catalogue.ts` et `definitions.ts` : c'est le catalogue
et la spécification qui portent le texte d'une fiche, pas son gabarit.

**Limite honnête :** git ne conserve pas les dates de modification. Sur une
construction Vercel, qui part d'un clone frais, tous les `mtime` valent l'heure
du build, et le `lastModified` de toutes les entrées est donc la date du dernier
déploiement. C'est exact en local et pendant un développement incrémental ; en
production, c'est un « pas plus ancien que » plutôt qu'une date de dernière
modification. Google traite de toute façon `lastmod` comme un indice et non
comme une vérité. Voir la piste d'amélioration au § 8.

### Le garde-fou

`src/app/sitemap.test.ts` vérifie, **sur la sortie réelle** de `sitemap()` :

- aucune URL relative, aucune URL hors du domaine canonique ;
- aucun doublon ;
- les dix fiches outils sont présentes ;
- aucune page qui se déclare `noindex` n'y figure ;
- les neuf pages publiques du site y figurent (liste écrite à la main : c'est la
  moitié que l'automatisme ne peut pas fournir, la découverte sachant dire ce
  qu'elle a trouvé mais pas ce qui manque) ;
- les huit écrans de service restent dehors ;
- aucune page non publiée, la liste étant **lue** dans `unpublishedNav` ;
- aucun segment dynamique laissé sans énumération ;
- des dates valides et jamais dans le futur, des cadences légales, des priorités
  bornées.

`src/app/robots.test.ts` vérifie en plus qu'aucune URL annoncée dans le plan du
site n'est interdite par `robots.txt`, ce qui est la contradiction classique et
celle que Google signale.

`src/lib/seo/page-metadata.test.ts` audite les treize pages importables : titres
tous différents, descriptions toutes différentes, longueurs tenables, aucun tiret
cadratin, canonique et Open Graph complets, et les six pages qui doivent rester
hors index le sont. Il importe les modules de page eux-mêmes, donc ce qui est
vérifié est exactement ce qui sera servi. Deux titres identiques sur deux pages
est la faute la plus banale du référencement, la plus facile à commettre en
dupliquant un fichier, et celle qu'aucun outil ne signale.

Sans ces tests, le plan du site automatique serait un pari : il échoue en
**silence**. Une page qui sort de l'index ne provoque aucune erreur, aucun test
rouge, aucun journal ; elle disparaît, et on l'apprend six mois plus tard.

---

## 2. `robots.txt`

`src/app/robots.ts` autorise l'exploration et ferme quatre familles :

| Interdit | Motif |
|---|---|
| `/api/` | Sert la donnée DVF détaillée en JSON. Déjà couvert par `X-Robots-Tag`, ceci est la seconde ceinture |
| `/observatoire/comparables` | Mutations détaillées, adresse comprise : décret du 28/12/2018 |
| `/connexion`, `/mon-espace` | Écrans de service, rien à indexer |
| `/outils/*/calculer` | Le calculateur, derrière connexion et quota. La fiche, elle, reste explorable |
| `/solutions` | Offre écrite mais pas ouverte. **Lu dans `unpublishedNav`** |

Le plan du site et l'hôte canonique (l'apex `https://corpus.immo`, sans `www`)
sont déclarés. L'URL n'est jamais écrite en dur : elle vient de
`siteConfig.url`, via `canonicalUrl()`.

**Nuance qui compte :** un `Disallow` empêche l'exploration, donc empêche aussi
de *lire* le `noindex` de la page. Les deux sont posés ensemble ici parce que ces
pages ne reçoivent presque aucun lien entrant. Sur une page très liée, il
faudrait choisir le `noindex` seul.

---

## 3. Les métadonnées de page

Tout passe par `pageMetadata()` (`src/lib/seo/metadata.ts`). Une page déclare un
titre, une description et un chemin ; elle obtient d'office la canonique,
l'Open Graph complet (`type`, `locale`, `siteName`, `url`, `title`,
`description`) et la carte Twitter. Une balise `og:` oubliée ne casse rien, ne
lève aucune erreur, et ne se voit qu'au moment où quelqu'un partage le lien :
c'est exactement le genre d'omission qu'une fonction empêche.

### Typographie

`polishMetaText()` est appliqué à **toutes** les chaînes produites :

- le tiret cadratin et le tiret demi-cadratin sont remplacés par une virgule,
  consigne éditoriale du propriétaire, y compris sur les textes recopiés depuis
  `definitions.ts` qui en contiennent encore ;
- l'espace devant `: ; ! ?` devient insécable, en **U+00A0** et non en `&nbsp;` :
  une entité HTML serait affichée telle quelle dans un onglet et dans un extrait
  de résultat de recherche.

### Pages revues

| Page | Ce qui a changé |
|---|---|
| `layout.tsx` | Titre par défaut débarrassé de son tiret cadratin, gabarit `%s · CorpusImmo`, description ramenée sous 170 signes, `googleBot` (`max-snippet`, `max-image-preview: large`), `authors` / `creator` / `publisher`, `formatDetection` |
| `/` | Titre absolu (il porte déjà la marque), description propre, titre social distinct |
| `/estimer` | Description réécrite, titre social distinct, Open Graph par la fabrique |
| `/carte` | Idem |
| `/observatoire` | Description recentrée sur ce que la page montre, sans parenthèse technique |
| `/observatoire/transactions` | Description réécrite, fil d'Ariane ajouté |
| `/observatoire/comparables` | Passe par la fabrique, `noindex` conservé, description enrichie |
| `/outils` | Description ramenée de 232 à 146 signes (six outils cités, pas dix : au-delà, l'extrait est coupé en plein nom) |
| `/outils/[slug]` | Description **composée** (voir ci-dessous), titre social distinct |
| `/outils/[slug]/calculer` | Canonique corrigée : elle pointait sur la fiche tout en étant `noindex`, ce qui envoie deux ordres contradictoires. Elle pointe désormais sur elle-même |
| `/a-propos` | Description réécrite |
| `/connexion` | Passe par la fabrique, `noindex, nofollow` conservé |
| `/mon-espace` | Passe par la fabrique, `noindex` conservé |
| `/solutions` et ses trois offres | Passent en `noindex, follow` (offre non publiée), descriptions réécrites, titres sociaux distincts |

Non touchées, hors périmètre : `/mentions-legales`, `/confidentialite`,
`/cookies`, `/hors-ligne` et `/blog`. Les trois premières sont correctes ; elles
gagneraient à passer par `pageMetadata()` pour hériter de l'Open Graph, qu'elles
n'ont pas.

### Les descriptions de fiches outils

`src/lib/seo/tool-metadata.ts` **compose** au lieu de recopier. Le résumé d'un
outil est écrit pour tenir sous un titre : il fait 78 à 114 signes, là où un
extrait de résultat de recherche en affiche 150 à 160. Un complément vrai de tous
les outils (les hypothèses sont affichées, modifiables, datées) est ajouté, en
trois longueurs selon la place restante. Les dix descriptions tombent entre 145
et 170 signes, elles sont toutes différentes, et le test le vérifie.

Elles ne disent **plus** « sans compte » : depuis le changement de régime
d'accès, la fiche est en consultation libre mais le calculateur demande une
connexion. Un test l'interdit explicitement.

---

## 4. Données structurées

`src/lib/seo/json-ld.ts`, typé, sans `any`, rendu par `<JsonLd>` avec un
échappement maison : `<`, `>`, `&`, U+2028 et U+2029 sont convertis en séquences
`\uXXXX`. `JSON.stringify` seul produit du JSON valide et du HTML dangereux :
une chaîne contenant `</script>` refermerait la balise.

### Ce qui est posé

| Schéma | Où | Pourquoi |
|---|---|---|
| `Organization` + `WebSite` | `layout.tsx`, en `@graph` | Une fois pour tout le site ; le second référence le premier par `@id` |
| `WebApplication` | `/estimer`, `/carte`, `/observatoire`, les dix fiches | Ce sont des applications, pas des articles |
| `BreadcrumbList` | `/observatoire/transactions`, les dix fiches | Pages de deuxième niveau, avec un lien de retour réellement affiché |
| `ItemList` | `/outils` | Un sommaire se balise comme une liste |

`offers` à zéro euro est posé partout : rien n'est vendu sur ce site, aucun
paiement n'est demandé nulle part. `isAccessibleForFree` n'est posé **que** sur
l'estimateur, la carte et l'observatoire, qui n'ont aucune porte. Sur les fiches
outils, la propriété est **omise** plutôt que mise à `false` : une connexion
gratuite reste gratuite, mais ce n'est pas un accès libre, et `false` signalerait
un paywall qui n'existe pas.

### Ce qui est écarté, et pourquoi

- **`FAQPage`.** Aucune page du site n'affiche de questions-réponses. Baliser une
  FAQ absente de l'écran est une infraction explicite aux règles de Google, et
  la sanction porte sur le domaine entier. Le constructeur `faqNode()` est livré,
  documenté et **inutilisé** ; un test vérifie qu'aucun fichier de `src/app/` ne
  l'appelle. Au jour où une page en affichera une, les couples balisés devront
  être exactement ceux rendus dans le HTML, mot pour mot.
- **`Dataset` sur l'observatoire.** La page rend un **outil** : côté serveur,
  elle n'affiche aucune mutation, la donnée arrive par `fetch` après hydratation
  (voir `docs/routes.md`). Et le jeu de données appartient à la DGFiP, publié sur
  data.gouv.fr. Le revendiquer serait faux deux fois : sur ce que la page montre,
  et sur qui le publie.
- **`SearchAction` sur `WebSite`.** Il n'existe aucune recherche à l'échelle du
  site. Le champ de la bibliothèque d'outils filtre dix cartes dans le
  navigateur, sans URL de résultats. Déclarer un point d'entrée qui n'existe pas
  ne rapporte rien.
- **`AggregateRating`, `Review`.** Personne n'a noté quoi que ce soit.
- **Adresse postale, téléphone, identifiant d'entreprise** sur `Organization` :
  ils ne figurent pas non plus sur la page des mentions légales.

---

## 5. Images sociales

`src/lib/seo/og-image.tsx` compose l'image au build avec `ImageResponse`
(`next/og`), en 1200 × 630. Trois routes l'utilisent : la racine (héritée par
toute page qui n'en déclare pas), `/outils` (héritée par les dix fiches) et
`/observatoire` (héritée par la recherche de transactions).

### La composition, en trois calques

1. **Le fond** : papier chaud, trame de plan cadastral, logotype en filigrane.
2. **Le voile** : un dégradé qui garantit la lisibilité du texte quoi qu'il y ait
   dessous. Presque invisible aujourd'hui, il est là pour ne pas avoir à
   redessiner la composition plus tard.
3. **Le texte** : logotype, surtitre, titre, phrase, domaine.

Ce découpage a une seule raison d'être, et elle est écrite en tête du fichier :
**le jour où des photographies existeront, le calque 1 se remplace par un `<img>`
en `objectFit: "cover"`, le voile passe au bleu nuit, et rien d'autre ne bouge.**
C'est ce qui est annoncé comme la suite.

La composition est **paramétrable** (surtitre, titre, phrase) : les fiches
outils et, plus tard, les articles du journal s'en servent sans écrire une image
par page. Le corps du titre s'adapte à sa longueur en trois paliers, Satori ne
sachant pas rétrécir un texte qui déborde.

### Deux contraintes assumées

- **Les couleurs sont littérales**, comme dans `src/app/icon.svg`. Satori compose
  hors de tout navigateur : `var(--primary)` n'y vaut rien. Elles sont listées en
  tête de fichier et doivent être tenues à jour à la main si la palette de
  `globals.css` bouge.
- **Aucune police n'est chargée.** `next/og` embarque Noto Sans en graisse
  normale, et elle seule ; aller chercher Inter ou Source Serif supposerait un
  appel réseau pendant le build, donc un build qui peut échouer pour une image.
  La hiérarchie ne repose donc sur aucun gras : elle tient par les corps,
  l'interlettrage, la couleur et les filets, ce qui donne d'ailleurs à la
  composition son air de document plutôt que d'affiche.

Aucun chiffre n'y figure : une image sociale est mise en cache un an par les
réseaux qui la relaient, et un prix médian affiché dessus serait faux bien avant
d'être remplacé.

La géométrie du logotype est recopiée de `brand-mark.tsx` (Satori ne sait pas
rendre un composant React de l'application) : **c'est le seul point de
duplication de la marque, les deux fichiers doivent bouger ensemble.**

Les images ont été rendues et regardées avant validation, sur trois longueurs de
titre.

---

## 6. Maillage interne

Aucune page indexable n'est orpheline : chacune est référencée depuis au moins
deux endroits (en-tête, pied de page, sommaire des outils).

Le trou réel était ailleurs : **les dix fiches outils ne se liaient qu'au
sommaire.** On y entrait par `/outils` et on n'en ressortait que par le bouton
retour. `src/lib/seo/related-tools.ts` calcule trois voisins par fiche à partir
des axes du catalogue (type d'actif × usage), l'usage pesant deux fois plus que
le type d'actif parce qu'il décrit ce que la personne est en train de faire, et
`tous-actifs` ne valant qu'un demi-point : un outil universel est voisin de tout
le monde, donc de personne.

Trois liens, pas un pavé. Un test vérifie qu'aucune fiche ne reste sans voisin,
qu'aucune ne se propose elle-même et que le classement est déterministe (sans
quoi le HTML de dix pages changerait à chaque build).

---

## 7. L'invariant de rendu statique

Rien de cette livraison ne le touche :

- aucun `cookies()`, `headers()` ni `searchParams` n'a été ajouté nulle part ;
- `<JsonLd>` est un composant serveur sans état ;
- `sitemap.ts` porte `export const dynamic = "force-static"`. C'est ce qui
  autorise `node:fs` dans `routes.ts` : à l'exécution sur Vercel, `src/` n'est
  pas dans le bundle. `routes.ts` n'est importé que par `sitemap.ts` et son test ;
- les trois `opengraph-image.tsx` sont des routes d'image statiques, construites
  au build.

La liste des pages construites au build est donc inchangée, **plus** trois
nouvelles routes d'image sociale. À vérifier au prochain `pnpm build` : toutes
les pages en `○ (Static)` ou `● (SSG)`, seules les routes `/api/*`,
`/mon-espace` et `/outils/[slug]/calculer` en `ƒ (Dynamic)`.

---

## 8. Ce qui reste à faire

### Dans le dépôt

- **Brancher le journal sur le plan du site.** `src/lib/blog/` expose
  `blogSitemapEntries()` et l'endroit est signalé dans `sitemap.ts`. Deux points
  à régler au branchement : la fonction ne rend que les **articles**, pas l'index
  `/blog`, qu'il faudra ajouter ; et `/blog` est écarté de la découverte
  automatique parce que son indexabilité est **calculée** au build
  (`blogRobots(...)`) au lieu d'être écrite dans le source, ce que le détecteur
  de `noindex` ne peut pas voir.
- **Faire passer `/mentions-legales`, `/confidentialite` et `/cookies` par
  `pageMetadata()`.** Elles n'ont aujourd'hui ni Open Graph ni carte Twitter.
- **Corriger la copie de `/outils/[slug]`**, qui annonce encore « Gratuit, sans
  compte, dans le navigateur. Une adresse e-mail suffit à déverrouiller deux
  outils par semaine glissante ». Les descriptions méta ont été corrigées, le
  texte visible non : il est hors du périmètre de cette livraison, mais il dit
  désormais l'inverse de ce que fait la page.
- **La page d'accueil lie encore `/solutions`**, qui est passée en `noindex` et
  en `Disallow`. Ce n'est pas grave (le lien reste utile à un visiteur) mais il
  faudra trancher : ou l'offre s'ouvre, ou le lien part.
- **Deux tirets cadratins subsistent dans des titres d'outils affichés à
  l'écran** (`definitions.ts`), et un titre porte un `?` sans espace insécable.
  Les métadonnées sont nettoyées à la volée, la copie visible non.
- **`lastModified` réel en production**, si on veut mieux qu'une date de build :
  activer le clone git complet sur Vercel et stamper les dates par
  `git log -1 --format=%cI -- <fichier>` dans une étape de build. À ne faire que
  si la Search Console montre que ça compte.

### Hors du dépôt

- **Search Console** : déclarer la propriété de domaine `corpus.immo` (pas le
  préfixe d'URL : la propriété de domaine couvre l'apex et les sous-domaines),
  soumettre `https://corpus.immo/sitemap.xml`, vérifier que l'apex est bien
  choisi comme canonique et qu'aucune page n'est signalée « explorée, non
  indexée ».
- **Bing Webmaster Tools**, qui alimente aussi les réponses de plusieurs
  assistants.
- **Vérifier les cartes de partage** sur les validateurs de LinkedIn, X et
  Facebook une fois le site en ligne : ce sont eux qui mettent l'image en cache,
  et la première version relayée est celle qui reste.
- **Images sociales par article de journal** : la composition est déjà
  paramétrable, il suffira d'un `opengraph-image.tsx` sous `/blog/[slug]` qui lui
  passe le titre et la rubrique de l'article.
- **Photographies d'illustration** : quand elles existeront, remplacer le calque
  de fond (§ 5). C'est un remplacement de calque, pas une réécriture.
