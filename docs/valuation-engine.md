# Moteur d'estimation — méthode par comparaison

> Une estimation n'est pas une expertise. Ce document explique exactement
> comment le chiffre est obtenu, pour qu'un professionnel puisse l'auditer
> ligne à ligne et le contester.

## Principe

Le moteur ne cherche pas la précision maximale : il cherche à être
**défendable**. À chaque étape, on privilégie la méthode dont on peut expliquer
le comportement, et on préfère **ne rien répondre** plutôt que répondre un
chiffre que la donnée ne soutient pas.

Entrée : `ValuationRequest` (bien géolocalisé + caractéristiques).
Sortie : `ValuationResult` — fourchette, prix au m², confiance, comparables
retenus, et un journal complet de ce qui a été écarté et pourquoi.

## 1. Recherche des candidats

Escalade de rayon : **500 m → 1 km → 2 km → 5 km**. On s'arrête au premier
rayon qui produit assez de comparables retenus. Dans un secteur dense, on ne
s'élargit jamais.

Si `comparableIds` est fourni, **aucune recherche automatique** : le moteur
travaille exactement sur la sélection transmise. Aucun écran ne s'en sert
aujourd'hui — c'est la porte d'entrée d'un atelier de valorisation à construire,
et elle est déjà testée.

## 2. Filtrage

Chaque motif de rejet est compté séparément et exposé dans
`diagnostics.rejected` — l'écran pro affiche « ce qui a été écarté et pourquoi ».

| Motif | Raison |
|---|---|
| Typologie incompatible | on ne compare un appartement qu'à des appartements |
| Mutation non-vente | échange, expropriation, adjudication : le prix n'est pas un prix de marché |
| Mutation multi-lots | le prix ne se rapporte pas à un bien unique |
| Surface absente ou hors tolérance | ±30 %, élargi à ±50 % si la matière manque |
| Ancienneté > 60 mois | au-delà, la comparaison ne veut plus dire grand-chose |
| €/m² aberrant | bornes de Tukey (1,5·IQR) **et** garde-fous absolus |

## 3. Pondération

Quatre sous-scores dans [0,1] : **distance**, **récence**, **similarité de
surface**, **correspondance typologique**.

Ils sont combinés par une **moyenne géométrique pondérée** (exposants 0,35 /
0,25 / 0,25 / 0,15), et non arithmétique. La raison est concrète : une moyenne
arithmétique laisse un excellent sous-score compenser un sous-score
catastrophique — une vente à 4 km qui se trouve être très récente remonterait
dans le classement. La moyenne géométrique l'interdit : un sous-score proche de
zéro écrase le poids final.

Quand DVF ne fournit pas le nombre de pièces, le sous-score typologique vaut
**0,7**, jamais 1. On ne récompense pas une donnée manquante.

### Plafond de dominance — 40 %

Aucun comparable ne peut peser plus de **40 %** du total. Au-delà, l'excédent
est redistribué (*water-filling*), y compris par-dessus une pondération manuelle
maximale d'un professionnel.

C'est une exigence de **secret statistique** : sans ce plafond, une « valeur de
marché » pourrait n'être, en pratique, que le prix d'une seule vente.

## 4. Prix au m² central

**Moyenne pondérée sur les €/m² winsorisés aux déciles**, avec un garde-fou :
si elle diverge de plus de 25 % de la médiane pondérée, on bascule sur cette
dernière.

Pourquoi ni l'une ni l'autre seule :

- la **moyenne simple** est déplacée par un seul survivant du filtre IQR ;
- la **médiane pondérée seule**, sur 8 comparables, revient à choisir une vente
  et jeter les sept autres.

La médiane brute et la moyenne brute sont exposées à côté, dans le résultat :
le professionnel voit les trois et juge.

## 5. Valeur centrale

```
valeur = surface × €/m² pondéré × (1 + ajustements)
```

Les ajustements portent sur ce que DVF **ne capture pas** dans le €/m² : état
déclaré, étage et ascenseur, extérieur, stationnement. Ils sont **plafonnés à
±12 % au total** et systématiquement listés dans l'explication.

Ce plafond serré est délibéré : ces coefficients sont des ordres de grandeur de
marché, pas des paramètres calibrés statistiquement. Les afficher et les borner
vaut mieux que les cacher.

## 6. Fourchette

La largeur **dépend de la qualité du jeu de comparables** — ce n'est jamais un
±8 % décoratif.

```
demi-largeur = 0,03
             + 0,50 × dispersion        (IQR / médiane des €/m² retenus)
             + 0,09 × rareté            (peu de comparables)
             + 0,04 × ancienneté
             bornée entre ±5 % et ±22 %
```

Dispersion inconnue ⇒ pénalisée à 0,25. On ne suppose jamais que ce qu'on ignore
est favorable.

## 7. Score de confiance

```
35 pts  effectif (en √)
30 pts  homogénéité (dispersion)
20 pts  récence
15 pts  proximité
```

Puis des **plafonds durs**, que l'arithmétique ne peut pas franchir :

| Situation | Plafond |
|---|---|
| moins de 6 comparables | 55 |
| dispersion > 0,35 | 55 |
| ancienneté moyenne > 42 mois | 65 |
| immobilier d'entreprise | 60 |

`confidence.factors` renvoie des libellés **déjà rédigés en français**, étiquetés
`positive / neutral / negative`, prêts à afficher.

## 8. Refus de conclure

Le moteur renvoie `status: "failed"` — jamais un chiffre — quand :

- moins de **5 comparables** sont retenus. Règle dure, vérifiée deux fois (après
  filtrage, puis après exclusions), et appliquée **aussi au panier
  professionnel** : une sélection manuelle de 3 ventes reste 3 ventes ;
- la surface manque ;
- le département n'est pas couvert par DVF (57, 67, 68, 976).

`diagnostics.failureReason` est rédigé pour un humain et affiché tel quel.

## 9. Explication

```ts
import { explainValuation } from "@/lib/valuation";
const texte = explainValuation(result); // string, 3 à 5 phrases
```

C'est une **fonction pure du résultat**, pas un champ stocké : la phrase ne peut
donc jamais se désynchroniser du chiffre affiché. Elle mentionne la publication
semestrielle des DVF et, pour un actif tertiaire, l'avertissement sur la
couverture partielle.

## 10. Tests

**131 tests** sur le moteur seul, **aucun appel réseau** : le provider DVF est
injecté (`estimateByComparison(req, { provider, now, id })`).

Couverture : statistiques sur effectifs pairs/impairs et tableaux vides
(`undefined`, jamais `NaN`), chaque motif de rejet et son comptage, monotonie de
la pondération, somme des poids à 1, plafond de dominance, `manualWeights` et
`excludedIds`, escalade de rayon, plancher de 5, monotonie de la confiance.

Deux bugs réels ont été trouvés par ces tests avant toute mise en service :

- à n = 2, le plafond de dominance devenait infaisable et **aplatissait les poids
  à 50/50**, détruisant l'ordre réel. Corrigé : pas de plafonnement quand
  `n × plafond < 1` ;
- l'explication produisait « **ce** appartement ». Table de démonstratifs
  explicite (genre, élision, pluriel), testée.

## 11. Limites assumées

- **Pas de correction temporelle par indice de prix.** Une vente de 2021 entre à
  sa valeur nominale, seulement dépondérée par la récence. Une reflation par
  indice INSEE départemental est le prochain gain réel.
- **Ajustements qualitatifs non calibrés** — d'où le plafond de ±12 %.
- **Tertiaire et parkings** passent par le chemin résidentiel avec les mêmes
  garde-fous : techniquement fonctionnel, mais peu de mutations survivent au
  filtre de surface, et la confiance est plafonnée à 60.
- **Escalade séquentielle** : jusqu'à 4 appels au provider dans un secteur creux.
  Le cache DVF amortit.
