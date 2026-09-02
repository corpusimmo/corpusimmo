# Images

`public/illustrations/` contient les photographies d’ambiance du site. Ce
fichier dit **d’où elles viennent**, **où elles sont posées**, et **ce qu’on
s’interdit** avec elles. Les prompts qui les produisent sont dans le catalogue
`promptsimages.md` (hors dépôt) ; leurs numéros de section sont repris ici.

## Le nommage

`famille-sujet[-variante].webp`, en minuscules, sans accent, un tiret par mot.

- `bien-…` : une typologie d’actif vue de l’extérieur, celle du sélecteur de
  l’estimateur et de la carte. C’est la seule famille posée sur l’accueil.
- `interieur-…` : l’intérieur d’un local, vide. Réservé aux pages d’offre, où
  l’on parle du travail des professionnels, jamais à côté d’une typologie.
- `ville-…` : une vue urbaine, aérienne ou depuis la rue. Les bandeaux
  d’ambiance des pages éditoriales.
- Le suffixe `-2` marque une seconde prise du même sujet, gardée en réserve.

## Provenance

Toutes les images ont été générées le 2 septembre 2026 (ChatGPT pour la
plupart, Gemini pour `ville-metropole-aerienne`), à partir des prompts du
catalogue (sujet + direction artistique commune + interdits), puis recadrées et
converties en WebP (qualité 80, largeur maximale 1 600 px) par `sharp`. La
banque entière pèse 5,4 Mo ; `next/image` la resert à la taille de chaque
emplacement. Aucune image n’est la photographie d’un lieu réel.

| Fichier | Prompt | Ce que montre l’image | Posée |
|---|---|---|---|
| `bien-appartement-ancien.webp` | 3.1 | Façade haussmannienne, balcons filants, platane | accueil |
| `bien-appartement-ancien-2.webp` | 3.1 | Même sujet, cadré en contre-plongée | `/blog` |
| `bien-appartement-recent.webp` | 3.2 | Immeuble résidentiel des années 2010, loggias, dernier étage en retrait | accueil |
| `bien-maison.webp` | 3.3 | Pavillon des années 1970 sur sous-sol, volets roulants, hortensia | accueil |
| `bien-immeuble.webp` | 3.4 | Immeuble de rapport de faubourg, portrait 4:5, rideau métallique fermé | accueil |
| `bien-terrain.webp` | 3.5 | Parcelle bornée de piquets, lisière de village | accueil |
| `bien-bureaux.webp` | 3.6 | Immeuble de bureaux des années 2000, plateaux allumés | accueil (×2) |
| `bien-bureaux-2.webp` | 3.6 | Immeuble de bureaux en verre dans un parc d’affaires | accueil, section « pour les professionnels ». Sa lumière de midi sort de la direction artistique, ce qui se voit peu à la taille où elle est posée |
| `bien-commerce.webp` | 3.7 | Vitrine de pied d’immeuble sans enseigne, rue pavée | accueil |
| `bien-local-activite.webp` | 3.8 | Bâtiment d’activité en bardage, porte sectionnelle fermée | accueil |
| `bien-local-activite-2.webp` | 3.8 | Hangar en bardage sombre, porte ouverte sur des rayonnages | réserve |
| `bien-entrepot.webp` | 3.9 | Entrepôt logistique, quais de chargement, remorque sans marque | accueil |
| `bien-parking.webp` | 3.10 | Parking silo en béton brut, lumière rasante | accueil |
| `interieur-bureaux-plateau.webp` | hors catalogue | Plateau de bureaux vide, fenêtres sur des toits | `/solutions` |
| `interieur-bureaux-openspace.webp` | hors catalogue | Open space vide, baies vitrées | `/solutions/automatisation` |
| `interieur-bureaux-hall.webp` | hors catalogue | Hall de bureaux béton et verre, mezzanine | `/solutions/formation` |
| `interieur-commerce.webp` | hors catalogue | Local commercial vide, vitrines sur rue | `/solutions/leads-vendeurs` |
| `interieur-local-activite.webp` | hors catalogue | Cellule d’activité vide, mezzanine métallique | réserve |
| `interieur-entrepot.webp` | hors catalogue | Entrepôt en exploitation, palettiers pleins | réserve |
| `ville-moyenne-aerienne.webp` | 4.2 | Vue aérienne oblique d’une ville moyenne, cœur ancien et rivière | `/prix-immobilier` |
| `ville-metropole-aerienne.webp` | 4.1 / 5.3 | Îlots haussmanniens vus du ciel, toits de zinc, cours intérieures | accueil (diaporama) et **image sociale** (`src/lib/seo/og-fond.jpg`, recadrée en 1200 × 630) |
| `ville-nantes-aerienne.webp` | 4.1 | Vue aérienne « de Nantes » avec cathédrale et rivière | réserve : une ville nommée et reconnaissable, mais générée, donc fausse dans le détail. Ne jamais la poser sur la page de la commune. |
| `ville-rue-fenetre.webp` | 5.1 | Rue de maisons de ville vue d’une fenêtre du premier étage | `/a-propos` |
| `ville-toits.webp` | 5.4 | Toits de zinc en fin de journée. Un dôme est visible au loin : l’image n’est posée que sous un voile de marine, où il ne se lit plus | accueil, fond |
| `ville-quai.webp` | hors catalogue | Quai de rivière et front bâti haussmannien | réserve |
| `ville-pont.webp` | hors catalogue | Pont de pierre au coucher du soleil | accueil, diaporama du héros. Le soleil dans le cadre sort de la direction artistique, mais il disparaît sous le voile de marine |

| `ville-quartier-affaires.webp` | hors catalogue | Esplanade d’un quartier d’affaires, passants en tenue de bureau | réserve : des personnes, ce que le catalogue interdit (cliché de banque d’images). À ne poser que si cette règle est revue. |
| `interieur-bureaux-visite.webp` | hors catalogue | Trois personnes casquées de dos dans un plateau vide | réserve : des personnes et des visages partiels (droit à l’image). Même réserve que ci-dessus. |

## Où elles sont posées

| Page | Fichier | Emploi |
|---|---|---|
| `/` accueil, bandeau des typologies (`marketing/typology-strip.tsx`) | les dix `bien-…` | Une carte par typologie, `alt` honnête, lien vers l’estimateur avec l’usage pré-rempli |
| `/` accueil, section « Notre engagement » | `ville-toits.webp` | Fond sous un voile de marine, `alt=""` : décorative |
| `/` accueil, section « Pour les professionnels » | `bien-bureaux-2.webp` | Colonne de droite, à partir de 1024 px seulement |
| `/a-propos` | `ville-rue-fenetre.webp` | Bandeau d’ouverture 21:9 |
| `/prix-immobilier` | `ville-moyenne-aerienne.webp` | Bandeau pleine largeur DERRIÈRE le titre, sous voile de marine, comme le héros de l’accueil. En vignette à côté du titre, avec bordure, ombre et légende, elle se lisait comme une illustration rapportée |
| `/blog` | `bien-appartement-ancien-2.webp` | Colonne de droite de l’en-tête |
| `/solutions` | `interieur-bureaux-plateau.webp` | Colonne de droite du héros, à partir de 1024 px |
| `/solutions/*` (`marketing/offer-page.tsx`, prop `illustration`) | un `interieur-…` par offre | Colonne de droite de l’en-tête, à partir de 1024 px |
| `/estimer` (`estimation/estimator-backdrop.tsx`) | un `bien-…` par typologie, un `ville-…`/`interieur-…` avant le choix | Fond fixe du parcours, à 28 % sous un voile de canvas, `alt=""`. Il change quand la typologie change : c’est un accusé de réception, pas une décoration. Le RÉSULTAT, lui, n’en porte aucune (règle du prix ci-dessous) |

## Les règles

Elles viennent du catalogue de prompts, et elles ne sont pas de forme.

- **Jamais deux fois sur la même page.** Le diaporama du héros et le bandeau
  des typologies sont sur le même écran : une vue qui apparaît dans les deux
  fait lire la banque comme trop courte. La table ci-dessus est la seule façon
  de le vérifier avant de poser une image.
- **Jamais à côté d’un prix.** Une image générée n’est jamais la photographie
  d’un bien réel : elle n’a pas sa place près d’une fourchette d’estimation ni
  d’une vente DVF. Les résultats de l’estimateur, la carte et l’observatoire
  n’en portent aucune.
- **Le `alt` dit ce que l’image est.** « Illustration : façade haussmannienne »,
  jamais « appartement à Lyon ». Une image de fond porte `alt=""`.
- **Une mention visible.** Chaque figure posée dans une page porte une légende
  qui dit « illustration », pour que personne ne prenne une ambiance pour une
  pièce du corpus.
- **Ni visage, ni marque, ni texte lisible, ni adresse identifiable.** À
  vérifier sur chaque image livrée, pas seulement dans le prompt.
- **Les schémas de méthode ne sont pas des images.** Ils sont dessinés dans
  `src/components/illustrations/` et documentés dans `docs/illustrations.md`.
  Un schéma engage un raisonnement ; une photo n’engage qu’une atmosphère.
