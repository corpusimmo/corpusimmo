# Design system

## Le principe

**Une seule direction artistique, figée.** Pas de sélecteur, pas de variantes,
pas de cookie lu au rendu. Le brouillon en portait huit, commutables à chaud :
4 400 lignes de CSS, et surtout une lecture de cookie dans le layout racine qui
forçait le rendu dynamique de **tout le site**. Ce dispositif d'aperçu n'a pas
été repris.

## Règle absolue

> Un composant n'écrit **jamais** de couleur, de rayon ou d'ombre en dur.

Interdit : `bg-blue-600`, `#2145e6`, `rounded-[14px]`, `shadow-[0_2px_8px…]`.
Attendu : `bg-primary`, `text-ink-muted`, `border-border`, `rounded-md`,
`shadow-sm`.

Conséquence utile : changer toute l'identité de marque = éditer
`src/app/globals.css`, et rien d'autre.

**Une seule exception, documentée dans le fichier concerné** : le fond de carte.
Un style MapLibre est du JSON rendu sur un canevas WebGL, il ne peut pas lire une
variable CSS. Les couleurs littérales de la cartographie vivent donc dans
`src/components/map/base-palette.ts`, et nulle part ailleurs. La *surcouche* DVF,
elle, lit bien les tokens, par `getComputedStyle`.

---

## Le registre

Une fintech institutionnelle. Concrètement :

| | |
|---|---|
| Fond | blanc froid à peine bleuté `#F4F7FB`, les sections marketing posées dessus en **panneaux** blancs (`panel`, rayon 36 px) |
| Encre et action | bleu nuit `#1B3349`, le bleu de l'acte notarié, pas le bleu d'application |
| Accent | or `#8A6A2F` en texte, `#C2A468` en filet — la marque, la sélection, le trait sous le chrome. Jamais jaune |
| Titrage | Manrope 700, resserrée (`-0.028em`), **h1 à h3** |
| Interface et corps | Inter |
| Citation | Source Serif 4 italique, par `font-serif` : le seul endroit où le sérif survit |
| Surtitre | capitales espacées **dans une pastille or pâle** (`eyebrow`) |
| Rayons | généreux : 8 / 12 / 16 / 22 / 28 px, 36 px pour les panneaux. Les boutons sont des pastilles |
| Ombres | en deux temps : contact court, puis halo large teinté de marine |

Ce qui reste institutionnel dans un registre produit : les capitales espacées,
les chiffres tabulaires, les filets or, le sérif de la citation, et le refus
de tout dégradé criard — le seul dégradé autorisé est le filet or du chrome.

---

## Le héros de l'accueil

Un **diaporama** de cinq vues urbaines en fondu enchaîné
(`marketing/hero-slideshow.tsx`), sous un voile de marine qui s'ouvre vers la
droite : le texte est en réserve, le relevé de ventes flotte sur l'image.

Trois règles, dans le composant :

- `prefers-reduced-motion` arrête le fondu **et** ne charge que la première
  image : un fond qui bouge sans qu'on l'ait demandé est une gêne réelle, et
  quatre fichiers pour un fond fixe sont un gâchis ;
- toutes les vues sont des illustrations générées (`docs/images.md`), jamais un
  bien du corpus, et le fond est `alt=""` — décoratif ;
- le voile n'est jamais moins opaque que 58 % à droite : c'est le seuil mesuré
  sous lequel le blanc du titre passe sous 4,5:1 sur l'image la plus claire.

Le texte du héros tient en **deux lignes** sous le titre. L'argument y est
entier (« des actes, pas des annonces ») ; la démonstration appartient aux
sections suivantes, qui ont la place de la porter.

---

## L'ordre de l'accueil

La page dit **ce que le site fait** avant **comment il le fait**, et ne montre
**aucun chiffre local**.

1. le héros et la recherche d'adresse, sur le diaporama ;
2. le bandeau du corpus : quatre bornes nationales, pas une commune ;
3. `ToolsShowcase` : les quatre entrées ouvertes, puis les dix calculateurs
   nommés un par un, avec une capture réelle d'un classeur ;
4. `TypologyStrip` : les typologies couvertes, en images ;
5. la méthode, l'engagement, les limites des données, puis les professionnels.

Pourquoi cet ordre : le relevé de ventes d'une commune occupait la droite du
héros, et sur un site national il faisait lire le produit comme un service
local à tous ceux qui n'y habitent pas. La méthode, elle, ne convainc que
quelqu'un qui sait déjà ce qu'on lui propose de faire.

---

## Le logotype

**Un titre de propriété.** C'est la seule forme où les deux moitiés du nom ne
sont pas juxtaposées mais confondues : un titre de propriété est à la fois la
pièce et le bien. La page porte une maison, et la ligne bronze en dessous est
celle de la signature de l'acte.

Trois décisions de dessin, toutes vérifiables à l'œil en réduisant la marque :

- **La maison a des murs.** Le toit seul se lit comme un chevron — une flèche
  vers le haut, un bouton « replier » — dès qu'on descend sous 32 px. Deux
  traits verticaux suffisent à lever l'ambiguïté.
- **La ligne bronze porte deux rôles.** Les murs s'arrêtent juste au-dessus
  d'elle : elle est le sol sur lequel la maison est posée autant que la ligne de
  signature. Un seul trait, deux lectures.
- **Le coin corné n'est pas décoratif.** C'est lui qui empêche la forme d'être
  lue comme une simple carte, et il rappelle qu'un corpus est fait de feuillets.

### Deux tirages

`BrandMark` accepte un `tone`. Ce n'est pas un thème :

| | |
|---|---|
| `default` | page pleine en bleu nuit — l'en-tête, sur fond clair |
| `inverted` | page en trait blanc — le pied de page, où un aplat bleu nuit sur bleu nuit disparaîtrait |

Le bronze ne bouge dans aucun des deux.

### Le favicon

`src/app/icon.svg` inverse le rapport : page claire dans un carré bleu nuit.
Une icône d'onglet est posée sur un fond que nous ne choisissons pas — clair ou
sombre selon le thème du navigateur — et le carré plein garantit le contraste
dans les deux cas.

Ses couleurs sont **littérales** : un fichier servi hors de l'application ne peut
pas lire les variables de `globals.css`. C'est la seconde et dernière exception
à la règle « aucune couleur en dur », après le fond de carte. Elle est annotée
dans le fichier, et il faudra la tenir à jour à la main si la palette bouge.

---

## Les tokens

Trois couches, de la plus concrète à la plus abstraite.

### 1. Rampes brutes
`--brand-50 … --brand-950` (bleu nuit), `--bronze-50 … --bronze-900`,
`--paper-25 … --paper-500`.

Le bronze mérite une note. `--bronze-500` (#A8874A) ne tient que **3,39:1** sur
blanc : il reste un **aplat** et un **filet**. Le token qui porte du texte est
`--accent` (#8A6A2F, **5,02:1**), une marche plus bas. Confondre les deux est la
seule façon de casser l'accessibilité de cette palette.

### 2. Tokens sémantiques
C'est ce que les composants consomment.

| Famille | Tokens |
|---|---|
| Surfaces | `--canvas`, `--surface`, `--surface-2`, `--surface-3`, `--surface-inverted`, `--overlay` |
| Texte | `--ink`, `--ink-muted`, `--ink-subtle`, `--ink-inverted` |
| Bordures | `--border`, `--border-soft`, `--border-strong` |
| Action | `--primary`, `--primary-hover`, `--primary-active`, `--primary-fg`, `--primary-soft`, `--primary-soft-fg` |
| Accent | `--accent`, `--accent-hover`, `--accent-active`, `--accent-fg`, `--accent-soft`, `--accent-soft-fg`, `--accent-rule` |
| Retour | `--success`, `--warning`, `--danger`, `--info` (+ variantes `-soft`, `-soft-fg`) |
| Focus | `--ring` |
| Carte | `--map-marker`, `--map-cluster`, `--map-selected`, `--map-subject` |

La carte porte en plus deux rampes qui ne peuvent pas être des tokens, puisque
MapLibre peint sur un canevas WebGL sans lire le CSS : `PRICE_RAMP` (cinq
classes de prix au m², sauge → sang-de-bœuf) et `HEAT_RAMP` (densité des
ventes, sable → bleu nuit), toutes deux dans `components/map/base-palette.ts`.
Les bornes des classes sont les quintiles des ventes à l'écran, jamais des
seuils fixes (`components/map/price-scale.ts`, testé), et la légende les
affiche pour le dire.
| Géométrie | `--radius-xs … --radius-xl`, `--shadow-xs … --shadow-lg` |

### 3. Pont Tailwind
`@theme inline` réexpose les tokens sémantiques en utilitaires : `bg-surface`,
`text-ink`, `border-border-strong`, `rounded-lg`, `shadow-md`.

---

## La densité

Les écrans d'analyse — observatoire, tableaux de mutations, outils de calcul — ne
changent pas de marque, ils changent de **respiration** :

```html
<div data-density="compact">
```

Cet attribut resserre les rayons d'un cran, et rien d'autre. Aucune couleur ne
bouge, aucun composant n'est dupliqué, il n'y a rien à re-rendre côté React.

C'est délibérément **pauvre**. Dans le brouillon, la densité était portée par un
second thème complet (`data-theme="professional"`, palette or et bleu nuit
distincte), et ce second thème a fini par servir de frontière d'univers — ce que
l'architecture du site interdit désormais. Un attribut qui ne peut pas changer de
couleur ne peut pas redevenir une frontière.

---

## Utilitaires maison

Quatre, pas davantage :

- `container-page` — la gouttière commune, 78 rem au plus ;
- `tnum` — chiffres alignés. Une colonne de prix dont les chiffres ne s'alignent
  pas se lit comme une erreur ;
- `eyebrow` — le surtitre en capitales espacées, en bronze. Le signal
  typographique du registre éditorial ;
- `rule-accent` — le filet bronze sous un titre de section. Un trait, pas une
  décoration.

Plus `skeleton` et `scroll-slim`, qui sont des mécaniques.

---

## Inventaire des composants

`src/components/ui/` — primitives : `Button`, `Card`, `Badge` / `StatusBadge`,
`Input` / `Textarea` / `Field`, `Select`, `ChoiceCard` / `ChoiceGroup`,
`Toggle` / `Checkbox`, `Modal`, `Drawer`, `Tooltip`, `Tabs`, `Table`,
`Skeleton`, `EmptyState` / `ErrorState` / `LoadingState`, `Spinner`,
`ToastProvider` / `useToast`, `Stat`, `Progress` / `Stepper`, `Accordion`,
`PageHeader`.

`src/components/charts/` — SVG pur, zéro dépendance : `BarChart`, `LineChart`,
`Sparkline`, `RangeBar`, `DistributionChart`.

`RangeBar` est le composant signature du produit : c'est lui qui matérialise
qu'une estimation est une **fourchette** et pas un prix ferme.

---

## Accessibilité — le contrat minimum

- Contraste **AA** sur tout texte. Les ratios non évidents sont annotés
  directement dans `globals.css`, avec leur mesure.
- `:focus-visible` toujours visible, jamais supprimé — défini une fois, hérité
  partout. L'anneau est en bronze moyen (`--ring`) : **3,39:1** sur blanc et
  **3,84:1** sur le bleu nuit du pied de page. Un indicateur de focus est un
  élément non textuel, 3:1 est le seuil — et le bronze est lisible sur les deux
  fonds du produit, ce qu'un bleu ne ferait pas sur une surface déjà bleue.
- `Modal` et `Drawer` : `role="dialog"`, `aria-modal`, piège de focus, `Esc`
  ferme, focus restitué au déclencheur, défilement du corps verrouillé.
- `Tabs` : roving tabindex, flèches, `Home` / `End`.
- L'autocomplétion d'adresse est une **combobox ARIA** complète, pas un champ
  avec une liste posée dessous.
- Cibles tactiles ≥ 44 px.
- `aria-live` sur tout résultat asynchrone.
- Les menus déroulants de l'en-tête sont des **divulgations**, pas des survols :
  un menu qui ne s'ouvre qu'au survol est inatteignable au clavier et hostile au
  tactile. Le survol ouvre aussi, en confort ; le clic et `Entrée` restent le
  contrat.
- `prefers-reduced-motion` neutralise les animations, globalement et sans
  exception.

---

## Mouvement

Cinq animations d'entrée, pas une de plus : `animate-fade-up`,
`animate-fade-in`, `animate-slide-up` (bottom sheets), `animate-slide-right`
(drawers), `animate-zoom-in` (modals). Plus le miroitement des squelettes et le
halo pulsé du marqueur du bien étudié.

Transitions de 150 à 200 ms sur couleur, ombre et `transform`.

Une animation qui ne sert pas à comprendre un changement d'état n'a pas sa place.

---

## Responsive

Mobile-first sur les deux parcours critiques — l'estimateur et la carte. Le
mobile n'est pas un desktop réduit :

- les panneaux latéraux deviennent des **bottom sheets** ;
- les tableaux denses deviennent des **cartes empilées**, ou défilent
  horizontalement dans leur propre conteneur — jamais la page ;
- la carte passe en plein écran avec recherche flottante et filtres en tiroir ;
- la barre d'onglets de l'observatoire défile **à l'intérieur d'elle-même**.

Points de contrôle : 375, 430, 768, 1024, 1440 et au-delà.
