# Kit LinkedIn — CorpusImmo

Tout ce qu'il faut pour tenir deux profils personnels et une page entreprise
sans réinventer la marque à chaque publication : les visuels, les textes, et
la règle qui décide de ce qu'on écrit.

Les visuels se **régénèrent** :

```bash
node scripts/kit-linkedin.mjs
```

Ils sortent dans `public/brand/linkedin/`. Palette, logotype et fontes sont
ceux du site : quand la charte bouge, on relance, et rien ne dérive.

---

## 1. Ce que le kit contient

| Fichier | Format | Où il va |
| --- | --- | --- |
| `banniere-corpusimmo.png` | 1584 × 396 | Bannière de la page entreprise |
| `banniere-mathieu.png` | 1584 × 396 | Bannière du profil de Mathieu |
| `banniere-gael.png` | 1584 × 396 | Bannière du profil de Gaël |
| `selection-estimer.png` | 1200 × 627 | Section « Sélection », lien vers l'estimateur |
| `selection-observatoire.png` | 1200 × 627 | Section « Sélection », lien vers l'observatoire |
| `selection-outils.png` | 1200 × 627 | Section « Sélection », lien vers les outils |
| `selection-pros.png` | 1200 × 627 | Section « Sélection », argument professionnel |

**La zone utile d'une bannière n'est pas sa surface.** La photo de profil
ronde recouvre le coin bas-gauche sur environ 300 pixels, et sur mobile la
carte du profil mange le bas. Le texte des bannières tient donc dans la moitié
droite, au-dessus de la ligne des deux tiers. Toute retouche doit respecter
cette contrainte, sinon le titre disparaît sur téléphone, c'est-à-dire pour la
majorité des lecteurs.

**Les vignettes de « Sélection » sont des images, pas des aperçus de lien.**
Quand on ajoute un lien à la section Sélection, LinkedIn va chercher l'image
Open Graph de la page, produite par `src/lib/seo/og-image.tsx`. Les fichiers
`selection-*.png` servent quand on veut maîtriser le visuel exactement, en
ajoutant un média plutôt qu'un lien.

---

## 2. Titres de profil

Le titre est la seule chose que voient les gens qui ne cliquent pas. Il dit ce
qu'on fait et pour qui, pas un statut.

**Mathieu**

> Cofondateur de CorpusImmo · L'estimation immobilière à partir des ventes
> réellement enregistrées, pour les professionnels

**Gaël**

> Associé de CorpusImmo · Investisseur immobilier · L'estimation sur les
> ventes réellement enregistrées

**Page entreprise, sous-titre**

> Estimer, comparer, décider. Sur les ventes réelles.

---

## 3. Section « Infos » (À propos)

### Mathieu

> La plupart des estimateurs en ligne partent d'annonces, c'est-à-dire de prix
> demandés. CorpusImmo part des actes : les Demandes de Valeurs Foncières
> publiées par la DGFiP, un million de ventes de logement enregistrées depuis
> 2021.
>
> Ce que ça change pour un professionnel : chaque chiffre remis à un client est
> vérifiable, et l'effectif accompagne toujours la médiane. Une estimation
> fondée sur onze ventes ne se présente pas comme une estimation fondée sur
> onze mille.
>
> Ce que le produit fait aujourd'hui :
> · l'estimation d'un bien à partir des ventes comparables autour de l'adresse
>   exacte, avec leur dispersion ;
> · un observatoire cartographique des mutations, à l'échelle de la rue ;
> · les loyers de marché, calés sur les baux réellement signés relevés par les
>   observatoires locaux, et non sur les loyers d'annonce qui les surestiment
>   d'environ 15 % ;
> · les calculs qu'un professionnel refait à chaque dossier : net vendeur,
>   rendement brut, avis de valeur par comparaison.
>
> Je m'occupe du produit et de la donnée. Si vous estimez des biens au
> quotidien et que quelque chose vous manque, écrivez-moi : c'est comme ça que
> la liste ci-dessus s'est écrite.
>
> corpus.immo

### Gaël

> J'investis dans l'immobilier, et je suis associé de CorpusImmo.
>
> Le point de départ est une gêne de terrain : on décide d'un achat avec des
> prix d'annonce, alors que les prix réellement payés sont publics. CorpusImmo
> part de ces derniers, les Demandes de Valeurs Foncières publiées par la
> DGFiP, et les met en face de ce qu'un bien rapporterait loué.
>
> Ce que je regarde en priorité : les comparables autour de l'adresse, la
> dispersion des prix dans le secteur, et le rendement brut calculé sur un
> loyer hors charges plutôt que sur une annonce.
>
> corpus.immo

---

## 4. Expérience à déclarer

Poste identique sur les deux profils, intitulé différent :

- **Intitulé** : Cofondateur (Mathieu) · Associé (Gaël)
- **Entreprise** : CorpusImmo
- **Lieu** : Nantes, France · à distance
- **Description commune** :

> CorpusImmo estime les biens et cartographie le marché à partir des ventes
> réellement enregistrées, publiées par la DGFiP. Estimateur, observatoire des
> mutations, loyers calés sur les baux signés, outils de calcul pour les
> professionnels. Gratuit, sans abonnement.

---

## 5. Section « Sélection »

Quatre entrées, dans cet ordre. L'ordre n'est pas neutre : on montre l'outil
avant le discours.

1. **Estimer un bien** → `https://corpus.immo` · visuel `selection-estimer.png`
2. **L'observatoire des ventes** → `https://corpus.immo/observatoire` ·
   visuel `selection-observatoire.png`
3. **Les outils de calcul** → `https://corpus.immo/outils` ·
   visuel `selection-outils.png`
4. **Pourquoi les actes plutôt que les annonces** → `https://corpus.immo` ·
   visuel `selection-pros.png`

---

## 6. Ce qu'on écrit, et ce qu'on n'écrit pas

Les mêmes règles que le site, parce qu'un post est une surface publique du
produit :

- **Aucun chiffre sans son effectif.** « 3 670 €/m² » ne se publie pas seul,
  « 3 670 €/m² sur 21 170 ventes » oui.
- **Ventes enregistrées, jamais annonces.** C'est la différence qui fonde le
  produit ; la diluer dans un post la dilue partout.
- **Pas de tiret cadratin** dans un texte affiché. Phrases courtes.
- **Pas de prévision.** On décrit ce qui a été enregistré. « Le marché va
  repartir » n'est pas une phrase de ce produit.
- **Une estimation n'est pas une expertise**, et un rendement brut n'est pas un
  revenu. Les deux réserves valent en post comme à l'écran.

---

## 7. Trois premiers posts, prêts à couper

**Post 1 — la différence de source**

> Un estimateur en ligne vous donne un prix. La question à lui poser est :
> d'où vient-il ?
>
> La plupart partent d'annonces. Une annonce est un prix demandé : elle ne dit
> pas si le bien s'est vendu, ni à combien.
>
> Les Demandes de Valeurs Foncières, elles, sont les actes notariés publiés par
> la DGFiP. Un prix payé, une date, une surface, une adresse.
>
> C'est le corpus sur lequel nous travaillons : un million de ventes de
> logement depuis 2021. Tout est consultable, gratuitement, sur corpus.immo

**Post 2 — le loyer que personne ne corrige**

> Les loyers publiés par la carte des loyers sont des loyers d'annonce,
> charges comprises. Ce qu'un bailleur encaisse est un bail signé, hors
> charges.
>
> Nous avons mesuré l'écart plutôt que de le déplorer : 117 zones
> d'observatoire local, 2 527 communes appariées. L'annonce dépasse le bail de
> 16 % en médiane, et l'écart se creuse sur les marchés tendus.
>
> Nos loyers affichés sont corrigés de cet écart, et le calcul est vérifiable
> sur une source qui n'a pas servi à le construire.

**Post 3 — la dispersion**

> Une médiane communale dit qu'une vente sur deux est passée au-dessus. Elle ne
> dit rien de l'écart entre les deux moitiés.
>
> À Nantes, la moitié centrale des ventes d'appartements va de 3 000 à
> 4 360 €/m². Deux biens de même surface peuvent légitimement se vendre à un
> tiers d'écart.
>
> C'est pour ça qu'une estimation qui part du centre de la commune ne vaut pas
> grand-chose, et qu'il faut l'adresse exacte.
