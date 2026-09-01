# Les pages villes

`/prix-immobilier` et `/prix-immobilier/[ville]`. Cent pages statiques, une par
commune, alimentées par les mutations DVF réellement enregistrées.

C'est le pari de référencement principal du projet : « prix immobilier
<commune> » est une requête à fort volume, et tous ceux qui y répondent
aujourd'hui extrapolent depuis des **annonces**, c'est-à-dire des prix demandés.
Nous partons d'**actes**, c'est-à-dire de prix payés. L'avantage n'est pas
technique, il est éditorial : nous pouvons dire combien de ventes fondent chaque
chiffre, et refuser d'en publier un quand elles ne suffisent pas.

Le principe qui commande tout le reste, et qui prime sur le référencement :
**aucun chiffre n'est publié sans son effectif, et aucune tendance n'est
affirmée quand l'écart mesuré tient dans le bruit.**

---

## 1. La sélection des communes

### Le critère

**Les cent communes les plus peuplées de France parmi celles que DVF couvre.**

La population n'est pas une mesure de marché : c'est une mesure de **demande de
la requête**. « Prix immobilier Nantes » est cherché parce que Nantes compte
328 000 habitants, pas parce qu'il s'y vend beaucoup. Le volume de mutations,
lui, décide d'autre chose : si la page a le **droit** d'exister. Les deux
critères ne sont donc pas en concurrence, ils s'enchaînent.

| Étape | Critère | Où |
|---|---|---|
| 1. Candidature | Population municipale INSEE, cent premières | `src/data/cities/communes.ts` |
| 2. Publication | Volume de mutations DVF réellement observé | `src/lib/cities/thresholds.ts` |

### Ce qui est exclu d'office

| Départements | Raison |
|---|---|
| 57, 67, 68 | Alsace-Moselle, régime du livre foncier, absente de DVF |
| 976 | Mayotte, hors publication DVF |
| 975, 977, 978, 984, 986, 987, 988 | Collectivités hors publication DGFiP |

Conséquence à ne pas taire : **Strasbourg, Mulhouse et Metz n'ont pas de page**,
et n'en auront pas tant que la donnée n'existera pas. Nouméa sortait dans les
cent premières par la population ; le fichier DVF correspondant répond 404. La
Guadeloupe, la Martinique, la Guyane et La Réunion, elles, sont couvertes et
figurent dans la liste. Le sommaire le dit à ses lecteurs, ce n'est pas un
détail de documentation.

### Combien de pages en sortent

**100 pages villes, plus le sommaire.** Aucune commune candidate n'a été
refusée : la moins fournie, Saint-André à La Réunion, porte 929 ventes de
logement sur cinq millésimes, soit près de quatre fois le seuil. C'est le
résultat attendu du critère de candidature, qui corrèle population et volume.
Le seuil de publication n'est donc pas décoratif pour autant : il est le
garde-fou de **l'extension** de la liste, et il est testé.

### Pour étendre

1. ajouter une entrée dans `cityCommunes` (`src/data/cities/communes.ts`), en
   respectant la règle de slug décrite dans `src/lib/cities/slug.ts` ;
2. régénérer les agrégats (section 3) ;
3. `pnpm vitest run src/lib/cities` : les tests vérifient l'unicité des slugs,
   la cohérence du jeu de données et le respect des seuils.

Une commune ajoutée sans agrégat n'a **pas** de page : le jeu de données
commande, pas la liste.

---

## 2. Les seuils, et ce qu'ils refusent

Tous dans `src/lib/cities/thresholds.ts`, tous testés dans
`thresholds.test.ts`.

| Seuil | Valeur | Ce qu'il refuse |
|---|---|---|
| `MIN_CITY_DWELLING_SALES` | 250 | La page entière |
| `MIN_FIGURE_SAMPLE` | 30 | Une médiane au m² |
| `MIN_DECILE_SAMPLE` | 100 | Les déciles (D1, D9) |
| `MIN_EVOLUTION_SAMPLE` | 60 par millésime | La comparaison de deux années |
| `MIN_SECTOR_SAMPLE` | 40 | Un secteur du découpage |
| `MIN_SECTOR_COUNT` | 3 | Le découpage entier |
| `MIN_SECTOR_COVERAGE` | 60 % des ventes | Le découpage entier |
| `MIN_SERIES_POINTS` | 3 millésimes | La courbe annuelle |

### D'où viennent ces nombres

L'intervalle de confiance à 95 % d'une médiane vaut environ
**±1,58 × IQR / √n** (la formule des encoches de boîtes à moustaches). Sur le
prix au m² d'un type de logement dans une commune, l'écart interquartile relatif
tourne autour de 0,35. On en tire directement :

| n | Demi-largeur | Lecture |
|---|---|---|
| 5 | ±25 % | Plus large que l'écart entre deux communes voisines. Le chiffre ne dit rien. |
| 30 | ±10 % | L'ordre de grandeur de la fourchette que publie l'estimateur. |
| 60 | ±7 % | |

En dessous de 30, la médiane communale serait **plus bruitée que l'estimation
qu'elle est censée éclairer**. D'où `MIN_FIGURE_SAMPLE = 30`.

Un **écart** entre deux millésimes est une différence de deux médianes : son
incertitude vaut √2 fois celle d'une seule. Pour retrouver la précision d'un
niveau à n = 30, il faut environ 60 mutations de chaque côté. D'où
`MIN_EVOLUTION_SAMPLE = 60`, exactement le double, et non un chiffre rond.

Le plancher du reste du produit (`MIN_STATISTICAL_SAMPLE = 5`, dans
`src/lib/dvf/aggregate.ts`) répond à une autre question : le secret
statistique. C'est un minimum juridique, pas un seuil éditorial.

### Ce que nous avons refusé d'afficher, et pourquoi

**1. Une tendance, dans 149 cas sur 200.** Les cent pages publient au total
200 médianes au m² (deux types de bien par commune, aucune refusée) et
1 089 362 ventes de logement. Les déciles sont refusés 3 fois sur 200.

Sur les 200 couples commune × type de bien, l'évolution entre les deux derniers
millésimes complets est publiée comme **concluante 51 fois** (38 hausses,
13 baisses), comme **non concluante 135 fois**, et **refusée 14 fois** faute
d'effectif. Un écart qui ne dépasse pas la marge d'incertitude combinée des deux
médianes est affiché avec sa marge et la phrase « nous n'en tirons aucune
tendance ». Le taire serait aussi malhonnête que de l'appeler une tendance.

**2. Toute projection.** Aucune extrapolation, aucun « + 3 % attendus », aucune
évolution calculée sur un millésime partiel. Un test
(`copy.test.ts`) interdit les mots de prévision dans les phrases produites.

**3. Le millésime en cours.** DVF publie deux fois par an avec six mois de
décalage. Un millésime est déclaré partiel par **deux** mécanismes, le
calendrier (`isPartialYear`, réutilisé de `src/lib/dvf/coverage.ts`) et le
volume (effondrement sous 60 % de la médiane des autres millésimes). Le
calendrier seul rate une publication amputée ; le volume seul confond avec un
vrai creux de marché.

**4. Les quartiers.** DVF n'en publie pas. Deux découpages seulement sont
admis, parce que ce sont les seuls que la source contient :

- **l'arrondissement**, pour Paris, Lyon et Marseille, où DVF publie un fichier
  par arrondissement. Le découpage est exact, pas approché ;
- **le code postal** ailleurs, qui est un secteur de distribution du courrier et
  non un quartier. La page l'écrit ainsi, et ne lui donne jamais de nom.

Inventer des quartiers à partir des noms de voies aurait produit une
cartographie de notre fabrication présentée comme une donnée publique.

Résultat, une fois les seuils appliqués : **25 pages affichent un découpage**
(3 par arrondissement, 22 par code postal) et **75 n'en affichent aucun**. Le
jeu de données porte pourtant 46 découpages par code postal : 24 d'entre eux
sont écartés à l'affichage, soit parce qu'il reste moins de trois secteurs
au-dessus de 40 ventes, soit parce que ceux qui restent couvrent moins de 60 %
des ventes de la commune. C'est le seul endroit où un seuil retire vraiment une
section entière, et c'est aussi le plus difficile à voir sans lui : trois
secteurs denses dans une commune étalée donneraient à lire « les prix à Untel »
alors qu'ils ne parlent que du centre.

**5. Une adresse pré-remplie dans l'estimateur.** C'est le refus le plus
discutable, et il est délibéré. Le parcours d'estimation sait recevoir une
adresse par l'URL (`buildEstimatorHref`) ; lui passer le centre de la commune
aurait été facile. Mais une adresse reçue par ce canal est marquée **validée** :
le parcours saute l'étape d'adresse et calcule autour du point reçu. On aurait
donc estimé tous les biens de Nantes depuis la place du Commerce, alors que la
page elle-même démontre que la dispersion **à l'intérieur** d'une commune est
presque toujours plus large que l'écart entre deux communes voisines. Le lien ne
transmet donc que l'usage (`/estimer?usage=residential`), et la page écrit
pourquoi. Voir `src/lib/cities/links.ts` et la section 7.

**6. `Dataset`, `Product`, `AggregateRating`, `FAQPage`.** Le balisage de ces
pages s'arrête au `BreadcrumbList`, et le sommaire y ajoute un `ItemList`. Le
jeu de données appartient à la DGFiP et vit sur data.gouv.fr ; rien n'est vendu ;
personne n'a noté quoi que ce soit ; aucune page n'affiche de questions-réponses.

---

## 3. D'où viennent les agrégats, et comment on les régénère

### La décision : pré-calculés et versionnés

Le fournisseur DVF télécharge **un fichier CSV par commune et par millésime**
(`src/lib/dvf/providers/geodvf.ts`) : 2,2 Mo pour Nantes, et il en faut cinq par
commune. Cent communes, dont trois développées en arrondissements, font
**710 fichiers et près d'un gigaoctet**.

Appeler ça au build signifierait trois choses, toutes mauvaises : un build de
plusieurs minutes, un build qui **échoue** quand data.gouv.fr est indisponible,
et un site dont le contenu change sans qu'aucun commit ne le montre.

Les agrégats sont donc calculés **une fois**, hors build, et versionnés dans
`src/data/cities/aggregates.json` (≈ 700 ko). Trois conséquences, toutes
voulues :

- le build ne fait **aucun appel réseau** et ne peut pas échouer pour ça ;
- un changement de chiffre affiché se lit dans un diff, se relit, se réverte ;
- durcir un seuil éditorial ne demande **pas** de retélécharger quoi que ce
  soit.

Ce dernier point vient d'une règle de conception : **le fichier ne porte que des
faits, le code porte les refus.** On n'y stocke jamais « cette évolution est
publiable », seulement des effectifs, des médianes et des quartiles. Un fichier
d'agrégats vieux de six mois ne peut donc pas transporter une règle éditoriale
périmée.

Le coût est assumé et il est unique : les chiffres ont l'âge de la dernière
régénération. **La page l'affiche, à la date près.**

### La commande

```sh
CITIES_REGENERATE=1 pnpm vitest run src/lib/cities/regenerate.test.ts
```

Environ **deux minutes** pour les cent communes et cinq millésimes.

| Variable | Effet |
|---|---|
| `CITIES_REGENERATE=1` | Arme le script. Obligatoire. |
| `CITIES_LIMIT=5` | Ne traite que les N premières communes (essai). |
| `CITIES_YEARS=2022-2025` | Restreint les millésimes. |

### Pourquoi le script est un fichier de test

Parce que le dépôt n'exécute du TypeScript que d'une seule façon : par Vitest.
Il n'y a ni `tsx`, ni `ts-node`, et `node --experimental-strip-types` ne résout
ni l'alias `@/` ni les imports sans extension du dépôt. Ajouter une dépendance
pour un script qui tourne **deux fois par an**, au rythme des publications DVF,
coûterait plus cher que cette bizarrerie assumée.

Le garde est un drapeau d'environnement et non un `skip` discret : sans
`CITIES_REGENERATE=1`, `pnpm vitest run` passe devant sans télécharger un octet.

### Quand régénérer

À chaque publication DVF, soit **en avril et en octobre**. Le script réécrit le
fichier entier ; le diff montre exactement quels chiffres ont bougé.

---

## 4. Ce que contient une page

| Bloc | Ce qu'il apporte | Refus possible |
|---|---|---|
| Chiffres clés | Médiane au m² par type, avec l'effectif | « Non publié » sous 30 ventes |
| Tableau des prix | Médiane, quartiles, déciles, vente médiane, effectifs | Ligne conservée avec le motif du refus |
| Dispersion | Histogramme borné aux déciles + phrase | Rien si la médiane n'est pas publiable |
| Évolution | Deux derniers millésimes complets + courbe annuelle | Trois motifs distincts, tous écrits |
| Volume | Ventes par millésime | Aucun, un comptage n'a pas de seuil |
| Secteurs | Arrondissements ou codes postaux | Section absente si le découpage ne tient pas |
| Maillage | Cinq communes voisines, trois outils | |
| Limites | Mutations écartées, millésimes partiels, date de calcul | |

### La sélection des mutations est celle du moteur d'estimation

Volontairement. Une page ville et l'estimateur doivent répondre le même prix
pour le même secteur, sinon l'un des deux ment. On applique donc exactement les
règles de `src/lib/valuation/comparables.ts` : vente de gré à gré seulement, lot
unique, et les garde-fous absolus en €/m² (`PRICE_PER_SQM_GUARDS`).

Deux filtres du moteur sont en revanche délibérément **absents** : l'écart de
surface et le filtre de Tukey. Le moteur cherche des biens **comparables à un
bien donné** ; une page ville décrit un **marché**. Écarter les ventes atypiques
d'une commune reviendrait à décrire une commune dont on aurait retiré ce qui la
rend chère ou bon marché. Ici, la dispersion est le sujet, pas le bruit.

### La rédaction

`src/lib/cities/copy.ts`. Ce n'est pas un gabarit à trous : chaque fonction
branche sur ce que les chiffres disent, et chaque branche est une phrase écrite
pour ce cas-là.

| Axe | Branches |
|---|---|
| Forme du marché | appartements dominants / maisons dominantes / deux marchés |
| Dispersion | resserrée / marquée / très étalée |
| Évolution | hausse / baisse / non concluante / trois motifs de refus |
| Comparaison | au-dessus / en dessous / à égalité avec la voisine la plus proche |

La comparaison à la commune voisine la plus proche est la phrase qui rend chaque
page singulière : deux médianes calculées de la même façon, sur la même période,
avec les deux effectifs affichés. Aucun classement, aucun palmarès, aucune
moyenne départementale que nous n'aurions pas calculée.

`copy.test.ts` vérifie sur les cent communes à la fois qu'aucun paragraphe
d'ouverture n'est identique à un autre, qu'aucune description de recherche ne se
répète, que toutes les branches sont réellement empruntées, et que la
typographie tient : pas de tiret cadratin, espace insécable devant `: ; ! ? %`,
pas de tutoiement.

### Deux composants dédiés, et pourquoi

- `src/components/cities/price-series.tsx` plutôt que le `LineChart` du système.
  L'infobulle du graphique générique affiche une valeur sans son effectif, et
  sépare la série de l'abscisse par un tiret cadratin, qui est proscrit dans
  tout texte visible. L'infobulle d'ici dit « 2025 : 3 390 €/m², sur 3 962
  ventes ».
- `price-table.tsx` et `sector-table.tsx` en balisage direct plutôt que la
  primitive `Table`, qui est un composant client (elle porte le tri par
  en-tête). Ces tableaux ne se trient pas et ne changent jamais après le rendu :
  leur faire traverser une frontière client chargerait du JavaScript sur cent
  pages statiques pour rien. Les jetons de style sont les mêmes.

`BarChart` et les autres graphiques SVG du dépôt sont réutilisés tels quels :
ils sont sans état et rendus côté serveur.

---

## 5. Le rendu statique

`generateStaticParams` énumère `publishedCities()`. Aucun `cookies()`, aucun
`headers()`, aucun `searchParams`, aucun appel réseau. `dynamicParams = false`
ferme la porte au reste : une URL inventée répond 404 plutôt que de tenter un
rendu à la volée qui produirait une page à moitié vide.

L'invariant du dépôt tient donc : hors routes API, `/mon-espace` et
`/outils/[slug]/calculer`, tout reste statique.

---

## 6. Le branchement au plan du site (à faire)

**`citiesSitemapEntries()` est exposée mais n'est PAS branchée.** Deux lignes à
écrire, dans deux fichiers, et **les deux vont ensemble** : brancher l'une sans
l'autre casse `src/app/sitemap.test.ts`.

### a. `src/lib/seo/routes.ts`

```ts
const EXCLUDED_PREFIXES = ["/blog", "/prix-immobilier"] as const;
```

Sans cette ligne, la découverte automatique trouve le motif
`/prix-immobilier/[ville]`, ne sait pas l'énumérer, et
`unresolvedDynamicPatterns()` le signale : le test
« sait énumérer tous ses segments dynamiques » échoue. C'est exactement le
garde-fou voulu, et c'est le même chemin que celui du journal.

### b. `src/app/sitemap.ts`

```ts
import { citiesSitemapEntries } from "@/lib/cities";
routes.push(...citiesSitemapEntries());
```

`citiesSitemapEntries()` rend **le sommaire ET les cent communes**, contrairement
à `blogSitemapEntries()` qui ne rend que les articles et a obligé à traiter
`/blog` à part. Un seul `push` suffit, et aucune page ne peut être oubliée.

Ordre des deux changements : si l'on branche (b) sans faire (a), `/prix-immobilier`
apparaît deux fois et le test « ne contient aucun doublon » échoue. Si l'on fait
(a) sans (b), les cent pages sortent silencieusement du plan du site.

État actuel, tant que rien n'est branché : le sommaire `/prix-immobilier` est
déjà dans le plan du site, trouvé tout seul par la découverte ; les cent pages
n'y sont pas, et le test « sait énumérer tous ses segments dynamiques » échoue,
comme il est censé le faire.

### La variante, en une seule ligne

Elle est plus courte et plus fidèle à l'esprit de `routes.ts`, qui dérive tout
plutôt que de recopier. Elle se substitue à (a) ET à (b) :

```ts
// src/lib/seo/routes.ts
const DYNAMIC_PARAMS: Readonly<Record<string, readonly string[]>> = {
  "/outils/[slug]": toolCatalogue.map((tool) => tool.id),
  "/prix-immobilier/[ville]": publishedCities().map((city) => city.slug),
};
```

Ce qu'on y perd : la cadence et la priorité viennent alors de la politique par
défaut de `SECTION_POLICIES` (0,5 pour le sommaire, 0,4 pour une page ville
après la pénalité de profondeur), et la date de dernière modification vient de
la date du `page.tsx`, non de celle du jeu de données. C'est cette seconde perte
qui a fait retenir `citiesSitemapEntries()` : le `page.tsx` ne bouge presque
jamais, alors que les chiffres, eux, changent deux fois par an.

### c. `src/config/navigation.ts`

Entrée à ajouter dans `mainNav`, en sous-entrée de l'Observatoire :

```ts
{
  label: "Prix par commune",
  href: "/prix-immobilier",
  status: "live",
  description: "Le prix au m² dans cent communes, sur les ventes enregistrées",
},
```

Le menu est répété sur toutes les pages : c'est lui qui irrigue l'autorité vers
le sommaire, et le sommaire vers les cent pages. Sans cette entrée, les pages
villes ne reçoivent de lien que depuis elles-mêmes.

---

## 7. Ce qui reste à faire

**Le centrage de la carte.** `/carte` ne lit aucun paramètre d'URL : le lien
d'une page ville y mène nu, et le libellé ne promet pas un centrage qui n'aurait
pas lieu. Faire accepter à `carte-client.tsx` un couple de coordonnées et un
niveau de zoom rendrait le lien réellement contextuel. Hors périmètre de cette
livraison, qui ne touche aucun fichier existant.

**Le pré-remplissage honnête de l'estimateur.** Aujourd'hui, une adresse
transmise par l'URL est marquée validée et saute l'étape d'adresse (section 2,
refus n° 5). Un troisième état, « adresse suggérée, non validée », qui
pré-remplirait le champ sans le verrouiller, rendrait le lien contextuel sans
mentir. Il se pose dans `components/estimation/wizard-state.ts`.

**Les millésimes.** Le jeu de données couvre 2021 à 2025 ; 2021 est le premier
millésime publié en DVF géolocalisé. Rien à faire, sinon régénérer en avril et en
octobre.

**Les communes sous le seuil.** Rien n'est prévu pour elles, et c'est un choix :
une page « prix immobilier à Trifouillis » adossée à trois ventes est un
mensonge, et Google finit de toute façon par traiter ces pages comme du contenu
de faible valeur. Le sommaire renvoie ces lecteurs vers la carte, qui affiche les
mutations une par une et reste honnête là où une médiane ne le serait pas.

**Une image sociale de section.** `opengraph-image.tsx` existe pour
`/observatoire` et `/outils` ; `/prix-immobilier` retombe sur celle de la racine.
Une image de section reprenant le nom de la commune demanderait un rendu par
page, à mettre en balance avec le temps de build de cent pages.
