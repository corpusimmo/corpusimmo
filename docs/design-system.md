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

Un document de banque d'affaires devenu logiciel. Concrètement :

| | |
|---|---|
| Fond | papier chaud `#F6F5F2`, non bleuté — c'est ce qui sépare un document d'une interface |
| Encre et action | bleu nuit `#1B3349`, le bleu de l'acte notarié, pas le bleu d'application |
| Accent | bronze `#8A6A2F` — la marque, la sélection, les filets. Jamais jaune |
| Titrage | Source Serif 4, sérif éditorial, **h1 à h3 uniquement** |
| Interface et corps | Inter |
| Rayons | courts : 4 / 8 / 12 / 16 / 22 px. Un dossier a des angles |
| Ombres | fermes et courtes, teintées de l'encre. Rien ne déborde de plus de 40 px |

Le sérif titre, il ne rédige pas. Cette règle est la direction artistique tout
entière en une phrase : si un `h1` perd sa famille, la page change de registre
avant de changer de couleur.

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
