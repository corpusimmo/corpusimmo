# Sources de données — état des lieux et feuille de route

Ce document recense les sources exploitables pour enrichir la plateforme. Il
sépare ce qui est **branché aujourd'hui** de ce qui est **candidat**, avec pour
chaque source la licence, le coût et le point de vigilance.

## 1. Branché dans le MVP

| Source | Usage | Endpoint | Clé | Coût |
|---|---|---|---|---|
| **Géocodage BAN — Géoplateforme IGN** | autocomplétion d'adresse, lat/lng, code INSEE | `data.geopf.fr/geocodage/search` | non | gratuit |
| **DVF géolocalisées (Etalab)** | transactions réelles, observatoire, comparables | `files.data.gouv.fr/geo-dvf/latest/csv/…` | non | gratuit |
| **DVF+ open data (Cerema)** | provider alternatif | `apidf-preprod.cerema.fr/dvf_opendata/geomutations/` | non | gratuit |
| **Découpage communal** | résolution INSEE d'une emprise | `geo.api.gouv.fr/communes` | non | gratuit |
| **Tuiles vectorielles PLAN IGN** | fond de carte | `data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/*.json` | non | gratuit |

> ⚠️ L'ancien domaine `api-adresse.data.gouv.fr` n'est plus qu'une redirection
> maintenue jusqu'en janvier 2026. Tout nouveau développement doit viser
> `data.geopf.fr`. C'est fait.

## 2. Candidats à fort effet de levier

Classés par rapport valeur / effort.

### 2.1 Court terme

| Source | Ce qu'elle apporte | Endpoint | Licence / coût | Vigilance |
|---|---|---|---|---|
| **Cadastre (API Carto IGN)** | parcelle exacte sous une adresse, surface de parcelle, contour | `apicarto.ign.fr/api/cadastre/parcelle` | ouverte, sans clé | jointure adresse→parcelle imparfaite en zone rurale |
| **Géorisques** | inondation, retrait-gonflement des argiles, radon, sols pollués, installations classées | `georisques.gouv.fr/api/v1/…` | ouverte (v1 sans token) | argument fort côté particulier ET pro |
| **RNB / BD TOPO** | identifiant bâtiment stable, emprise, hauteur | `rnb-api.beta.gouv.fr`, WFS `data.geopf.fr/wfs` | ouverte | la hauteur bâtiment débloquerait une vraie 3D sur la carte |
| **DPE (ADEME)** | performance énergétique déclarée | `data.ademe.fr` | ouverte, sans clé | base incomplète et appariement d'adresse approximatif — à afficher comme « DPE déclaré à proximité », jamais comme le DPE du bien |
| **Transports (GTFS)** | desserte, proximité des arrêts | `transport.data.gouv.fr` | ouverte | bon proxy de qualité d'emplacement |

### 2.2 Moyen terme

| Source | Ce qu'elle apporte | Licence / coût | Vigilance |
|---|---|---|---|
| **Sirene / Recherche d'entreprises** | occupants d'une adresse, tissu économique local | ouverte ; `recherche-entreprises.api.gouv.fr/near_point` sans clé | données nominatives en B2B = RGPD applicable |
| **SITADEL (permis de construire)** | pipeline d'offre future par destination | ouverte, CSV mensuel | très peu exploité par les observatoires existants — vraie différenciation |
| **INSEE (BPE, Filosofi, population)** | équipements, revenus, démographie | ouverte | secret statistique sur les mailles fines |
| **Urbanisme / GPU** | zonage PLU, constructibilité | ouverte | couverture nationale incomplète, ne pas promettre l'exhaustivité |
| **BODACC** | cessions de fonds de commerce, procédures | ouverte, quotidienne | données nominatives, prudence RGPD |

### 2.3 Payant ou sous convention

À n'envisager qu'avec un modèle économique en face : **Fichiers Fonciers / DV3F
(Cerema)** — sous convention, réservé aux acteurs publics ; **ImmoStat**,
**PriceHubble**, **Pappers Immobilier**, **Codata**, **Data-B**, **MyTraffic**
(flux piétons), **IEIF**. Aucune n'est nécessaire au MVP.

## 3. Le trou dans la raquette : les loyers

**Aucune source publique française ne couvre les loyers ni les transactions
locatives.** C'est la limite structurante du produit, et elle explique une
décision d'architecture : les modules **Rendement** et **DCF** ne peuvent pas
être alimentés par de l'open data. Ils resteront en préparation tant que la
donnée d'entrée viendra de la saisie de l'utilisateur ou d'un partenariat.

Ne jamais présenter un loyer dérivé de DVF : DVF ne contient que des ventes.

## 4. Contraintes juridiques à ne pas franchir

- **Scraping des portails d'annonces : interdit.** La jurisprudence est établie
  (CA Paris, 2 février 2021, confirmée en cassation) : une sous-base immobilière
  est protégeable au titre du droit *sui generis* du producteur de base de
  données, et l'extraction substantielle a été sanctionnée. Les CGU des portails
  professionnels l'interdisent par ailleurs explicitement.
- **ODbL (OpenStreetMap, BANCO) : contamination *share-alike*.** Intégrer ces
  données dans la base propriétaire obligerait à repartager l'ensemble. Usage en
  **affichage seulement**, ou préférer les fonds IGN sous Licence Ouverte — c'est
  le choix retenu pour le fond de carte.
- **Rapports de conseils (CBRE, JLL…)** : un fait brut cité et sourcé est
  licite ; la ré-agrégation systématique tombe sous le droit *sui generis*.
- **API Entreprise (DINUM)** : réservée aux administrations, non éligible pour
  un SaaS privé. Utiliser Sirene ou Recherche d'entreprises à la place.
- **RGPD** : les contacts professionnels sont des données personnelles, y compris
  en B2B. Consentements horodatés, droit à l'effacement, DPA avec l'hébergeur.
- **Estimation ≠ expertise** : disclaimer obligatoire sur toute valeur affichée.

## 5. Ce que le modèle de données doit prévoir

Enseignements à intégrer au schéma au fur et à mesure, plutôt que de les
découvrir tard :

- un **registre de sources** (nom, licence, URL, fréquence, statut) : la licence
  et la fraîcheur sont des attributs de première classe, pas des commentaires ;
- un **journal d'ingestion** rejouable et auditable (début, fin, lignes, erreur) ;
- une **traçabilité par indicateur** : chaque chiffre affiché porte sa source et
  sa date ;
- un **score de fiabilité** tenant compte de la provenance, de la taille
  d'échantillon et de la méthode d'agrégation ;
- une **séparation en trois couches** — brut (non exposable) / normalisé /
  agrégé (public) — avec le niveau d'exposition modélisé ;
- le **garde-fou d'effectif** porté par le modèle lui-même, pas seulement par le
  code applicatif ;
- des **indicateurs en série temporelle** (portée, période, unité, type d'actif)
  plutôt que des colonnes figées ;
- le **cache de géocodage** comme entité à part entière ;
- l'**occupant** d'un actif comme concept distinct du propriétaire et du bien.
