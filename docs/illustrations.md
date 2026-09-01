# Illustrations

`src/components/illustrations/` contient sept illustrations dessinées en SVG
natif&nbsp;: six schémas et un jeu d’icônes de typologie. Aucune image, aucune
dépendance, aucune requête réseau.

Ce fichier dit **quoi mettre où**, à quelle taille, et pourquoi.

## Le principe

Trois règles tiennent toute la bibliothèque. Les casser, c’est casser la
cohérence de la marque ou l’accessibilité, jamais juste « un dessin ».

**Aucune couleur en dur.** Les schémas consomment les tokens par les
utilitaires Tailwind (`fill-ink`, `stroke-accent-rule`, `fill-brand-200`)&nbsp;; les
icônes consomment `currentColor`. Changer l’identité reste une modification de
`src/app/globals.css`, et de rien d’autre. C’est la règle absolue du design
system, appliquée aux dessins comme au reste.

**Aucun `id` SVG.** Pas de dégradé, pas de `<marker>`, pas de masque. Les
flèches sont des polygones tracés. Deux schémas posés sur la même page ne
peuvent donc pas se voler leurs définitions, et rien n’a besoin d’être
préfixé.

**Aucun état, aucun hook.** Tout est rendu côté serveur, comme les graphiques
de `src/components/charts/`.

## La fidélité, qui n’est pas négociable

Un schéma qui explique la méthode décrit la méthode **réelle**. Les seuils
dessinés sont les constantes de `src/lib/valuation/`&nbsp;: rayons 500 m, 1 km, 2 km,
5 km&nbsp;; seuil d’arrêt à 8 ventes retenues&nbsp;; plancher dur à 5&nbsp;; exposants 0,35 /
0,25 / 0,25 / 0,15&nbsp;; plafond de dominance à 40&nbsp;%&nbsp;; fourchette bornée entre
±5&nbsp;% et ±22&nbsp;%&nbsp;; niveaux de confiance à 45 et 70. Si une de ces
constantes change dans le moteur, le schéma correspondant est faux le jour
même.

Là où un schéma simplifie, **sa légende le dit**. C’est pour ça que chaque
schéma porte une légende en vrai texte HTML plutôt qu’un titre décoratif, et
que la légende peut être retirée (`caption={false}`) uniquement quand le texte
autour dit déjà la même chose.

Un test vérifie qu’aucun texte visible ne contient de tiret cadratin, et
qu’aucune couleur littérale ne s’est glissée dans le balisage.

---

## Le catalogue

### `MethodDiagram`

**Intention.** Le schéma d’ouverture, pour quelqu’un qui n’a jamais lu le mot
« comparable ». Il fait comprendre en une image que le chiffre vient de
**ventes**, et pas d’un modèle.

**Ce qu’il montre.** Quatre temps&nbsp;: le bien, les ventes retenues autour, la
pondération plafonnée, la fourchette qui en sort.

**Ce qu’il simplifie.** Le filtre des prix au m² aberrants (bornes de Tukey) et
les ajustements qualitatifs plafonnés à ±12&nbsp;% ne sont pas dessinés&nbsp;: ils
sont dits dans la légende.

`viewBox` 680 × 250, rapport 2,7:1.

### `RadiusEscalation`

**Intention.** Montrer que la recherche n’a pas un rayon fixe, et surtout que
« pas de réponse » est une réponse possible.

**Ce qu’il montre.** Quatre couronnes concentriques, le nombre de ventes
retenues à chaque palier, et la décision prise à chacun. Le palier retenu est
le seul cercle plein, en bronze.

**Ce qu’il simplifie.** Les rayons ne sont pas à l’échelle, et les nombres de
ventes sont un exemple. Le cas du marché dense (plus de 120 ventes candidates
dès 500 m, où 5 retenues suffisent) est écrit dans le schéma&nbsp;; le refus de
conclure sous 5 ventes est dans la légende.

`viewBox` 680 × 330, rapport 2,1:1.

### `WeightingDiagram`

**Intention.** Répondre à la question du professionnel qui conteste un chiffre,
sans écrire une formule dans une page.

**Ce qu’il montre.** En haut, les quatre sous-scores et leurs exposants,
combinés en un poids. En bas, la répartition des poids avant et après le
plafond de 40&nbsp;%, avec la verticale des 40&nbsp;% qui traverse les deux
barres.

**Ce qu’il simplifie.** Les valeurs sont un exemple, mais elles sont
**calculées**&nbsp;: 0,86^0,35 × 0,74^0,25 × 0,55^0,25 × 0,70^0,15 = 0,72, et le
contre-exemple de la vente lointaine donne bien 0,65 en moyenne arithmétique
contre 0,40 en géométrique. La redistribution de l’excédent est nommée, pas
dessinée.

`viewBox` 680 × 400, rapport 1,7:1.

### `ConfidenceBand`

**Intention.** Le schéma qui accompagne un résultat. Il répond à « pourquoi
cette fourchette-là, et pourquoi ce score-là ».

**Ce qu’il montre.** La fourchette et ses trois repères&nbsp;; la décomposition de
la demi-largeur (base, dispersion, rareté, ancienneté)&nbsp;; la jauge de confiance
et ses trois niveaux, avec les plafonds durs écrits.

**Ce qu’il simplifie.** La décomposition dessinée illustre une demi-largeur de
±11&nbsp;%. Les bornes, les seuils et les plafonds, eux, sont les vrais.

`viewBox` 680 × 352, rapport 1,9:1.

### `DeveloperBalance`

**Intention.** Faire voir que le bilan promoteur se lit à l’envers&nbsp;: on part du
chiffre d’affaires, et le foncier est ce qui **reste**.

**Ce qu’il montre.** Une cascade où chaque poste entame le reste, et une
dernière barre, la seule en bronze et la seule ancrée à zéro&nbsp;: la charge
foncière admissible.

**Ce qu’il simplifie.** Les pourcentages sont un exemple d’opération, sans
valeur de référence. Ni TVA sur marge, ni participations d’urbanisme, ni risque
de recours.

`viewBox` 680 × 372, rapport 1,8:1.

### `WaultDiagram`

**Intention.** Montrer ce qu’une moyenne cache. Un WAULT de six ans peut
décrire un portefeuille dont 42&nbsp;% des loyers tombent dans trois ans.

**Ce qu’il montre.** En haut, cinq baux dont l’épaisseur suit le poids du
locataire, et la verticale du WAULT posée au milieu de ce qu’elle résume. En
bas, sur **le même axe des temps**, l’échéancier réel et son mur. C’est ce
partage d’abscisse qui fait la démonstration.

**Ce qu’il simplifie.** Exemple illustratif, cohérent et calculé&nbsp;: 0,42×3 +
0,20×8 + 0,16×9 + 0,12×8 + 0,10×7 = 5,96 ans. Le WAULT jusqu’à la prochaine
option de sortie triennale, qui raccourcit souvent la moyenne, est nommé dans
la légende mais pas dessiné.

`viewBox` 680 × 392, rapport 1,7:1.

### `AssetTypeIcons`

Neuf icônes de typologie, dessinées dans la grammaire du logotype. Voir la
section qui leur est consacrée plus bas.

---

## La table de correspondance

Où poser quoi. La colonne « largeur » est la largeur de **rendu** visée, pas une
propriété du composant&nbsp;: tous les schémas sont fluides.

| Page ou composant | Illustration | Largeur | Pourquoi là |
|---|---|---|---|
| `/` accueil, bloc « comment ça marche » | `MethodDiagram` | 720 px, pleine colonne | C’est la promesse du produit en une image&nbsp;: des ventes, pas un modèle. Elle doit être vue avant tout argument. |
| `/` accueil, grille des typologies | `AssetTypeIcons` | 24 px | Elles donnent une famille visuelle aux entrées de parcours, sans photo. |
| `/estimer`, étape « type de bien » (`steps/step-type.tsx`) | `AssetTypeIcons` | 24 px dans `ChoiceCard` | Remplace les icônes lucide génériques par des silhouettes réellement distinctes&nbsp;: bureaux, commerce et activité ne se confondent plus. |
| `/estimer`, résultat, panneau de confiance (`result/confidence-panel.tsx`) | `ConfidenceBand` | 640 à 720 px | Posée **au-dessus** du score, elle apprend à le lire avant de le donner. |
| `/estimer`, résultat, bloc méthode (`result/methodology.tsx`) | `MethodDiagram` | 680 px | Le tableau de traçabilité dit ce qui a été fait&nbsp;; le schéma dit comment. Les deux ensemble, jamais l’un sans l’autre. |
| `/estimer`, résultat en échec (`result/failed-result.tsx`) | `RadiusEscalation` | 640 px | Quand le moteur refuse de conclure, ce schéma explique le refus mieux qu’un paragraphe. C’est son emploi le plus utile. |
| `/estimer`, résultat, liste des comparables (`result/comparables-list.tsx`) | `WeightingDiagram` | 680 px, dans une divulgation repliée | Le détail de la pondération intéresse un professionnel sur dix&nbsp;: replié par défaut, jamais absent. |
| `/carte`, légende des filtres | `AssetTypeIcons` | 20 px | Même vocabulaire de typologie que l’estimateur. Une carte et un formulaire qui ne nomment pas les biens pareil se contredisent. |
| `/observatoire`, filtres et panneau de comparables | `AssetTypeIcons` | 20 px | Idem, et le panier de comparables gagne à montrer la typologie retenue. |
| `/observatoire`, panneau méthodologique | `WeightingDiagram` | 680 px | C’est l’écran de travail du professionnel&nbsp;: c’est là que le plafond de dominance doit être visible. |
| `/outils`, en-tête de la bibliothèque | `AssetTypeIcons` | 20 px, en filtre par famille d’actif | Le catalogue est déjà classé par `assetTypes`&nbsp;: les icônes rendent ce classement lisible d’un coup d’œil. |
| `/outils/bilan-promoteur` | `DeveloperBalance` | 680 px, sous le premier paragraphe | La fiche dit déjà « le bilan se lit à l’envers ». Le schéma le montre, ce qui vaut mieux que de le répéter. |
| `/outils/wault` | `WaultDiagram` | 680 px, sous le premier paragraphe | La fiche annonce le mur d’échéances caché par la moyenne. Le schéma est la démonstration. |
| `/a-propos` | `MethodDiagram` puis `RadiusEscalation` | 720 px | La page explique la démarche&nbsp;: la méthode, puis le refus de conclure. Dans cet ordre, parce que le second n’a de sens qu’après le premier. |
| `/solutions` et ses offres | aucun schéma | | Ce sont des pages commerciales. Y poser un schéma de méthode donnerait à une offre l’autorité d’un calcul. |

Deux règles de placement, valables partout&nbsp;:

- **Un schéma par écran, deux au maximum.** Trois schémas sur une page se
  neutralisent, et le lecteur cesse de les lire.
- **Jamais un schéma à côté d’un prix.** Un dessin d’exemple posé contre un
  résultat réel invite à lire les chiffres d’exemple comme des chiffres du bien.
  Les schémas s’intercalent entre les blocs, ils ne les décorent pas.

---

## Les largeurs, et le cas du mobile

Le texte d’un SVG fluide grandit et rétrécit avec le dessin. Sur les six
schémas, le plus petit libellé mesure 9 à 9,5 unités sur une grille de 680.
Concrètement&nbsp;:

| Largeur de rendu | Plus petit texte | Verdict |
|---|---|---|
| 800 px | 11 px | Confortable |
| 720 px | 10 px | Cible |
| 680 px | 9,5 px | Plancher acceptable |
| 620 px | 8,7 px | Limite basse |
| 375 px | 5,2 px | Illisible |

En dessous de 620 px, il ne faut pas rétrécir le schéma&nbsp;: il faut le faire
défiler, exactement comme le projet le fait déjà des tableaux denses.

```tsx
{/* Sous 620 px, le schéma défile dans son propre conteneur, jamais la page. */}
<div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
  <div className="min-w-[620px]">
    <MethodDiagram />
  </div>
</div>
```

La légende, elle, reste du texte HTML et se remet en page normalement à toutes
les largeurs. C’est la raison d’être de ce partage entre dessin et légende.

---

## Les icônes de typologie

### La grille et le trait

Même grille de 32 que `BrandMark`, mêmes jonctions arrondies. Le trait vaut
**2 unités sur 32**, soit exactement **1,5 px quand l’icône est rendue à
24 px**, la taille standard d’une icône dans ce produit.

Ce chiffre n’est pas arbitraire&nbsp;: 1,5 px à 24 px est le poids de
`lucide-react` avec `strokeWidth={1.5}`. Les deux familles cohabitent alors
sans qu’aucune ne paraisse plus grasse que l’autre. **Les icônes lucide
voisines doivent donc recevoir `strokeWidth={1.5}`.** À l’inverse, si un écran
tient à garder le poids lucide par défaut (2 sur une grille de 24), il faut
passer `strokeWidth={2.67}` aux icônes de typologie.

### Ce que chaque icône dit

| Icône | Signe distinctif |
|---|---|
| `apartment` | Un bloc avec un **lot rempli**&nbsp;: la seule zone pleine de toute la famille. On achète une unité, pas l’immeuble. |
| `house` | Le toit, les murs et le sol du logotype, à l’identique. La marque se reconnaît dans le jeu. |
| `land` | Un contour **tireté** et ses quatre bornes. Rien de bâti&nbsp;: ce qui se vend est un périmètre. |
| `building` | Deux volumes de hauteurs différentes, et aucun lot désigné. On achète le tout. |
| `office` | Des bandeaux **en retrait des rives** (façade rideau), là où l’appartement porte des planchers de mur à mur, plus une entrée. |
| `retail` | La dalle de l’étage au-dessus, le store, la vitrine. Le trait du haut n’est pas un toit. |
| `business_premises` | Toiture à un seul pan et rideau métallique&nbsp;: la silhouette réelle d’un atelier de zone d’activité. |
| `warehouse` | Toit plat, casquette de quai, deux portes de quai. Les quais sont ce qui distingue la logistique. |
| `parking` | La lettre, **tracée** et non composée&nbsp;: une icône ne doit pas dépendre d’une police. |

### Correspondance avec `PropertyType`

Huit des neuf noms sont ceux de `src/types/property.ts`. Le neuvième,
`warehouse`, n’existe pas dans `PropertyType`&nbsp;: DVF ne distingue pas
l’entrepôt, qui passe par `business_premises`. L’icône existe quand même,
parce que le catalogue d’outils, lui, parle bien de logistique.

| `AssetIconName` | `PropertyType` |
|---|---|
| `apartment`, `house`, `land`, `building`, `office`, `retail`, `business_premises`, `parking` | même nom |
| `warehouse` | aucun&nbsp;; à rattacher à `business_premises` côté données |
| aucun | `other`&nbsp;; garder une icône lucide générique, un bien atypique ne mérite pas une silhouette qui prétendrait le typer |

---

## Accessibilité

- Chaque schéma est une `<figure>`&nbsp;: `role="img"` et `aria-label` portent
  le nom court, `<desc>` porte la description longue, celle qui décrit ce qu’un
  lecteur voyant lit dans le dessin. Une illustration qui explique la méthode et
  qu’un lecteur d’écran annonce « image » n’explique rien à la moitié des
  lecteurs.
- Les icônes sont **décoratives par défaut** (`aria-hidden`), parce qu’un
  libellé texte les accompagne presque toujours. Passer `label` les transforme
  en images nommées, avec un `<title>`. Une icône nommée à côté d’un texte
  identique fait doublon à l’oreille&nbsp;: ne nommer que les icônes seules.
- Toutes les couleurs viennent des tokens, dont les ratios de contraste sont
  mesurés dans `globals.css`. Le bronze clair `--accent-rule` ne porte jamais de
  texte&nbsp;: dans les schémas, il ne sert que d’aplat et de filet.
- Aucune animation. Un schéma qui bouge se lit moins bien qu’un schéma qui ne
  bouge pas.

## Utilisation

```tsx
import { ConfidenceBand, AssetTypeIcon } from "@/components/illustrations";

<ConfidenceBand />                      {/* avec sa légende */}
<ConfidenceBand caption={false} />      {/* quand le texte autour la porte déjà */}
<ConfidenceBand className="max-w-3xl" />

<AssetTypeIcon name="office" />                          {/* décorative */}
<AssetTypeIcon name="office" label="Bureaux" />          {/* nommée */}
<AssetTypeIcon name="office" className="size-5" />       {/* 24 px par défaut */}
```

## Tests

`src/components/illustrations/illustrations.test.tsx` verrouille les promesses
que l’œil ne rattrape pas&nbsp;: nom accessible et description longue présents,
`viewBox` et largeur en pourcentage, aucune couleur littérale dans le balisage,
aucun `id` émis, aucun tiret cadratin dans un texte visible, légende
retirable, icônes décoratives par défaut et grille de 32 respectée.
