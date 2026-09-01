---
title: Ce que les données DVF disent, et ce qu'elles ne disent pas
excerpt: DVF recense des prix réellement payés, ce qui en fait la base la plus solide dont dispose le public. Encore faut-il savoir ce que le fichier ne contient pas, sous peine de lui faire dire l'inverse de ce qu'il montre.
status: draft
category: donnees
publishedAt: 2026-09-15
author: Rédaction CorpusImmo
tags: [dvf, open data, méthode]
related:
  - prix-au-m2-de-quartier
---

Les Demandes de Valeurs Foncières sont un fichier public. La DGFiP y consigne les mutations à titre onéreux enregistrées par les services de la publicité foncière, puis les diffuse en open data sur data.gouv.fr. Une ligne, une vente. Le prix inscrit dans l'acte, la date, l'adresse, la parcelle, le type de local, la surface déclarée.

C'est peu de colonnes, et c'est beaucoup plus que ce dont disposait le public il y a dix ans. Nous construisons dessus. Raison de plus pour dire précisément ce que ce fichier prouve, et ce qu'il ne prouve pas.

## Ce que DVF établit

**Un prix payé, pas un prix demandé.** C'est la différence de nature avec les portails d'annonces. Une annonce enregistre une intention de vendeur ; DVF enregistre un accord constaté devant notaire. L'écart entre les deux se mesure : sur un marché qui se retourne, il atteint couramment 5 à 10 % du prix affiché, et davantage sur les biens restés longtemps en ligne.

**Une couverture quasi nationale.** Toute la France sauf trois départements et un territoire : le Bas-Rhin, le Haut-Rhin, la Moselle, où le livre foncier tient lieu de régime de publicité, et Mayotte. Sur le reste, le fichier ne sélectionne pas : il ne s'agit pas d'un échantillon, mais de l'ensemble des mutations enregistrées.

**Une profondeur de cinq ans, actualisée deux fois par an.** Le fichier est republié au printemps et à l'automne. Une vente signée en juin apparaît donc à l'automne au plus tôt. Ce décalage est structurel, il n'est pas un défaut de traitement, et il a une conséquence directe : DVF décrit un marché avec quelques mois de retard. Sur une période de retournement rapide, c'est exactement le moment où l'écart compte le plus.

## Ce que le fichier ne contient pas

La liste est longue, et c'est elle qui décide de la qualité d'une estimation.

- **L'état intérieur.** Rien ne distingue un appartement refait à neuf d'un appartement à rénover entièrement. Sur un même palier, l'écart de prix atteint 20 à 30 %.
- **Le diagnostic de performance énergétique.** Il ne figure pas dans DVF. Or la décote observée sur les logements classés F et G est mesurable depuis 2021, et les restrictions de mise en location l'ont installée durablement.
- **L'étage, l'ascenseur, l'exposition, le vis-à-vis, le bruit.** Quatre variables qui séparent, dans le même immeuble, deux appartements de surface identique.
- **Les charges de copropriété et les travaux votés.** Un ravalement de façade appelé sur trois ans se négocie dans le prix. Le fichier n'en sait rien.
- **Le contexte de la vente.** Succession à liquider vite, vente entre proches, divorce, départ contraint : le prix inscrit peut être décorrélé du marché sans qu'aucune colonne ne le signale.

## Trois pièges de lecture, et comment ils se traitent

### La mutation multi-lots

Une même vente peut porter sur plusieurs biens : un appartement et sa cave, un appartement et deux places de stationnement, parfois un immeuble entier découpé en lots. Le fichier répète alors la même valeur foncière sur chaque ligne de la mutation.

Diviser cette valeur par la surface d'un seul lot produit un prix au m² absurde, deux à cinq fois trop élevé. C'est la première cause de valeurs aberrantes dans les usages naïfs de DVF. Le traitement consiste à recomposer la mutation avant tout calcul, à additionner les surfaces qui doivent l'être, et à écarter ce qui ne se recompose pas proprement.

### La surface qui n'est pas celle que vous croyez

DVF publie la surface réelle bâtie issue des déclarations foncières, pas la surface Carrez mesurée pour la vente. Les deux coïncident souvent. Elles divergent dès qu'il y a combles, mezzanine, sous-pente ou véranda. Le nombre de pièces principales, lui, est parfois simplement absent.

### Ce qui ressemble à une vente sans en être une

Le fichier contient des ventes en l'état futur d'achèvement, des adjudications, des ventes de terrains à bâtir, des cessions de nue-propriété. Une nue-propriété se vend 50 à 70 % de la valeur en pleine propriété, selon l'âge de l'usufruitier. Rangée sans distinction parmi les comparables d'un quartier, elle tire mécaniquement la référence vers le bas.

> Un fichier exhaustif n'est pas un fichier homogène. Le travail ne consiste pas à collecter la donnée, il consiste à écarter ce qui ne se compare pas.

## Ce que nous en faisons

Notre position est simple à énoncer : DVF est la meilleure base publique disponible pour situer un bien, et elle ne suffit pas pour le valoriser seule.

Elle sert à établir un niveau de prix, une dispersion, une tendance sur un secteur, et à retenir des comparables défendables. Elle ne dit rien de l'état, de l'exposition, ni de ce qu'un acquéreur acceptera de payer pour un balcon. C'est pourquoi une estimation issue de DVF est rendue sous forme de fourchette, accompagnée du nombre de ventes retenues et du rayon utilisé : ce sont ces trois informations, prises ensemble, qui permettent de juger si le résultat mérite d'être suivi.

Une estimation statistique n'est pas une expertise. Elle situe, elle documente, elle prépare la discussion. Elle ne remplace pas un professionnel qui a ouvert la porte du logement.
