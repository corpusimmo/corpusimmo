# Données DVF — source, pièges, limites

## 1. Ce que sont les DVF

Les **Demandes de Valeurs Foncières** sont publiées en open data par la DGFiP.
Elles recensent les mutations à titre onéreux (ventes, adjudications, échanges,
expropriations…) enregistrées au service de la publicité foncière.

Ce que DVF **contient** : date de mutation, nature de la mutation, valeur
foncière totale, type de local, surface réelle bâtie, nombre de pièces
principales, surface terrain, adresse, parcelle.

Ce que DVF **ne contient pas**, et que nous ne devons donc jamais prétendre
connaître : l'état intérieur réel, le DPE, la qualité des prestations, les
travaux réalisés, l'exposition, l'étage exact dans la plupart des cas, le
contexte de la vente (vente forcée, entre proches…), et l'identité des parties.

**Couverture** : toute la France sauf l'Alsace-Moselle (57, 67, 68) et Mayotte
(976), qui relèvent du livre foncier. Ces départements sont déclarés dans
`dvfCoverage.excludedDepartments` (`src/config/site.ts`) et le moteur
d'estimation doit y répondre par un échec explicite, jamais par une valeur.

## 2. Source retenue : « DVF géolocalisées » (Etalab)

```
https://files.data.gouv.fr/geo-dvf/latest/csv/{année}/communes/{dép}/{insee}.csv
```

Millésimes disponibles : **2021 → 2025**.

### Pourquoi celle-ci plutôt qu'une autre

| Source | Verdict |
|---|---|
| **geo-dvf (Etalab)** | ✅ Retenue. Officielle, géolocalisée à la parcelle, découpée par commune (donc requêtes petites et cachables), contient surface + pièces + adresse — tout ce dont le moteur d'estimation a besoin. |
| **API DVF+ Cerema** | Implémentée en second provider. Riche et pratique, mais emprise plafonnée à 0,02° × 0,02°, disponibilité inégale (503 observés), et pas de surface/pièces au niveau du local. |
| `api.cquest.org/dvf` | Écartée : non officielle, indisponible au moment de l'implémentation (502). |
| Fichiers DGFiP bruts | Écartés : non géolocalisés, format à parser intégralement pour toute la France. |

Le choix est encapsulé derrière l'interface `DvfProvider` (`src/types/dvf.ts`).
Changer de fournisseur ne doit toucher aucun composant React.

## 3. Le piège numéro un : une mutation ≠ une ligne

Dans le CSV, **une même mutation apparaît sur plusieurs lignes** — une par local
et par parcelle concernés. Et `valeur_fonciere` est le prix **total** de la
mutation, **répété à l'identique** sur chacune de ces lignes.

Conséquence : sommer naïvement les lignes multiplie le chiffre d'affaires du
secteur par 2 ou 3, et diviser le prix d'une ligne par la surface de cette
seule ligne produit des €/m² faux, parfois du simple au triple.

La normalisation regroupe donc systématiquement par `id_mutation` avant tout
calcul, additionne les surfaces des locaux d'habitation, et marque
`isMultiLot: true` dès que la mutation porte sur plusieurs locaux bâtis ou
plusieurs parcelles bâties. Les mutations multi-lots sont **exclues du calcul
d'estimation** : leur prix ne se rapporte pas à un bien unique.

## 4. Distinguer donné / calculé / estimé

C'est une règle de produit, pas seulement de code.

| Nature | Exemple | Traitement UI |
|---|---|---|
| **Donné** par DVF | prix, date, surface bâtie, type de local | affiché tel quel |
| **Calculé** par nous | €/m², distance au bien, âge de la vente, médianes | affiché, signalé comme calculé |
| **Estimé** par le moteur | valeur du bien, fourchette, confiance | toujours présenté comme une estimation, jamais comme une expertise |

Un champ absent reste `undefined` et s'affiche `—`. On ne comble jamais un trou
par une moyenne.

## 5. Réutilisation, vie privée, secret statistique

Le **décret n° 2018-1350 du 28 décembre 2018** encadre la réutilisation des DVF.
Deux interdictions structurent directement l'architecture du produit :

1. **Pas de réidentification, même indirecte.** Aucune page ne croise une
   mutation avec une personne. Les adresses sont affichées telles que publiées,
   jamais enrichies par un service tiers d'identité ou d'annuaire.
2. **Pas d'indexation par les moteurs de recherche.** `robots.ts` et les
   `metadata` des pages concernées interdisent l'indexation de
   `/observatoire/comparables`, seule page publique qui rende des mutations
   détaillées. Le `sitemap.ts` ne génère volontairement **aucune** URL par
   commune ni par transaction, et chaque réponse des routes `/api/dvf/*` porte
   un en-tête `X-Robots-Tag: noindex, nofollow, noarchive` — ceinture et
   bretelles, parce qu'une métadonnée de page ne protège pas une route JSON.

S'y ajoute le **secret statistique** (loi du 7 juin 1951) : on ne publie pas
d'agrégat calculé sur un effectif trop faible, ni d'agrégat dominé par une seule
observation. Le produit applique donc deux garde-fous, dans le moteur comme dans
l'observatoire :

- **plancher d'effectif** : pas de médiane, de moyenne ni de valeur estimée
  sous **5 mutations** retenues. En dessous, l'interface dit « effectif
  insuffisant » et le moteur renvoie un échec explicite — jamais un chiffre ;
- **règle de dominance** : le poids d'un comparable unique est plafonné, pour
  qu'une valeur publiée ne soit jamais, en pratique, le prix d'une seule vente.

## 6. Angles morts à ne jamais masquer

| Angle mort | Conséquence produit |
|---|---|
| DVF ne couvre **que les ventes** | Aucun indicateur locatif ne peut être dérivé de DVF. Les modules Rendement et DCF ne s'appuient donc pas dessus, et c'est l'une des raisons pour lesquelles ils restent en préparation. |
| DVF capte **mal l'immobilier d'entreprise** | Beaucoup de transactions tertiaires passent par cession de parts de société (share deals) et n'apparaissent pas. Une estimation sur bureaux, commerce ou local d'activité doit porter un facteur de confiance négatif explicite. |
| **Décalage d'environ 6 mois**, publication semestrielle (avril / octobre) | Le millésime le plus récent est toujours partiel. L'UI affiche « Données DVF jusqu'à &lt;année&gt; » et ne présente jamais l'année en cours comme complète. |
| Le type de local tertiaire est un **fourre-tout** | On expose la catégorie `commercial` telle quelle, sans inventer de sous-typologie (bureaux / entrepôt / commerce) que la donnée ne porte pas. |
| Surface et pièces parfois **absentes** | Le champ reste `undefined`, la mutation est écartée du calcul plutôt que complétée par une moyenne. |

## 6. Stratégie de cache

Les mutations passées ne changent pas. La stratégie est donc agressive :

```
requête carte
   ↓ debounce 400 ms
emprise (bbox)
   ↓ résolution des communes  (geo.api.gouv.fr, échantillonnage en grille)
   ↓ cache mémoire process (TTL) + déduplication des fetch en vol
fetch CSV par commune × année   (next: { revalidate: 86400 })
   ↓ parsing + regroupement par mutation
   ↓ filtrage par emprise et par critères
réponse  (Cache-Control: s-maxage=3600, stale-while-revalidate=86400)
```

La déduplication en vol est indispensable : un déplacement de carte peut
déclencher 8 requêtes concurrentes visant les mêmes communes.

## 7. Indisponibilité

Si la source est injoignable, l'application affiche

> Les transactions sont temporairement indisponibles. Réessayer.

Elle ne bascule **jamais** silencieusement sur des données fabriquées. Un jeu de
démonstration existe (`providers/mock.ts`) mais il est conditionné à
`USE_MOCK_DVF=true` **et** neutralisé en production par construction
(`src/config/env.ts`).
