# Stratégie commerciale — CorpusImmo

> **Ce que ce document est.** L'application de la méthode *Sell Like Crazy* (Sabri
> Suby) au projet CorpusImmo, du client cible au script d'appel. Il sert de
> source unique pour toute décision de positionnement, de message, d'offre et de
> prix — et il est fait pour être contredit par les faits, pas pour être admiré.
>
> **Comment il a été produit.** Deux passes indépendantes sur le kit
> d'appropriation du livre (`mathgui49/sell-like-crazy`) et sur le code réel du
> projet : l'une sur le client et les aimants, l'autre sur l'offre, le tunnel,
> les e-mails et les métriques. Les deux ont eu pour consigne de ne rien
> attribuer au produit qui ne soit dans le code, et de marquer explicitement
> « à construire » tout le reste.
>
> **Ce qu'il n'est pas.** Un plan qu'on exécute sans réfléchir. Les montants, les
> cibles de coût par acquisition et les scores d'audit sont des hypothèses
> argumentées, à réviser dès les premiers chiffres réels.

---

## Sommaire

| § | Sujet |
|---|---|
| 1 | Le client de rêve |
| 2 | Le marché et son stade de conscience |
| 3 | L'aimant principal (HVCO) |
| 4 | Les aimants secondaires |
| 5 | Les services proposés |
| 6 | L'offre du Parrain |
| 7 | La grille tarifaire |
| 8 | Le tunnel |
| 9 | La séquence e-mail « lanterne magique » |
| 10 | Le script d'appel |
| 11 | Les métriques et le budget |
| 12 | Audit express |

---

## Les trois contraintes de droit français, tenues partout dans ce document

Le livre est australien et américain dans ses exemples. Trois points sont
adaptés systématiquement, et aucune section n'y déroge :

1. **Garantie commerciale.** Elle s'*ajoute* aux garanties légales, elle ne les
   remplace pas. Toute garantie annoncée ici porte un périmètre, une durée, une
   procédure et la part qui incombe au client.
2. **Allégations.** Aucune promesse de résultat invérifiable. Ce qui dépend du
   client est conditionné en toutes lettres.
3. **RGPD.** Consentement explicite, finalité annoncée, durée de conservation,
   désinscription en un clic dans chaque envoi. Le point le plus sensible du
   modèle — la transmission d'un contact vendeur à une agence — est traité au
   §5.1 comme un chantier, pas comme une case cochée.

---

## 1. Le client de rêve

### 1.1 Pourquoi on ne part pas d'un historique

La méthode veut qu'on trie les clients existants par marge réelle et qu'on isole
les 4 % du haut. CorpusImmo n'a pas encore facturé un euro : il n'y a pas de
tableau à trier. On applique donc la porte de sortie prévue par la méthode —
partir du problème qu'on sait résoudre mieux que quiconque, et remonter à qui le
vit le plus fort.

Ce qu'on sait résoudre mieux que quiconque, et qui est vérifiable ligne à ligne
dans le code : **produire une valeur défendable à partir d'actes enregistrés, et
refuser de conclure quand la donnée ne le permet pas.** Moteur d'estimation par
comparaison documenté publiquement, 131 tests, plancher de 5 mutations, plafond
de dominance à 40 %, ajustements bornés à ±12 %, échec explicite en
Alsace-Moselle et à Mayotte.

Question suivante : **qui perd de l'argent, chaque semaine, faute de pouvoir
défendre un prix ?**

### 1.2 Le segment Power 4 %

**Le directeur-propriétaire d'une agence immobilière indépendante ou
mono-franchise, 3 à 8 négociateurs, sur un secteur de 3 à 6 communes en couronne
périurbaine ou en ville moyenne, 60 à 140 ventes par an, portefeuille
majoritairement en mandat simple, et qui signe lui-même le bon de commande.**

Une seule tranche. Pas « les professionnels de l'immobilier ».

Pourquoi lui et pas les trois autres :

| Segment | Achète le plus ? | Achète le plus vite ? | Achète le plus cher ? | Verdict |
|---|---|---|---|---|
| **Directeur d'agence, 3-8 négociateurs** | Oui : c'est le seul qui peut acheter les **trois** lignes de revenus — leads vendeurs au mois, automatisation, formation de son équipe (obligation ALUR : 14 h par an et par collaborateur) | Oui : pas de comité, pas d'appel d'offres, pas de DSI. Il décide dans le rendez-vous, il signe dans la semaine | Oui : la ligne « acquisition de mandats » est déjà à quatre chiffres par mois chez lui, elle est simplement mal dépensée | **Power 4 %** |
| Mandataire indépendant en réseau | Non. Ticket plafonné à 50-150 €/mois, payé sur sa propre commission après partage. Volume énorme, marge unitaire nulle | Oui, mais il désabonne aussi vite | Non | Audience, pas client. Il alimente la liste et le bouche-à-oreille |
| Marchand de biens | Non : achat ponctuel, au coup par coup. Il n'a pas besoin de leads vendeurs, il a besoin de gisement off-market | Oui, très vite | Moyen | Client secondaire, servi par les matrices |
| Promoteur | Ticket le plus élevé, mais cycle de 6 à 12 mois, achats groupés, référencement fournisseur | Non | Oui, une fois tous les trois ans | Hors cible au lancement |

**Le déclencheur d'achat**, à guetter, parce que c'est lui qui fait passer du
« intéressant » au « on signe » : l'échéance annuelle de son contrat portail ou
de son fournisseur de leads, la perte d'un négociateur qui part avec son secteur,
ou un trimestre où le stock de mandats est descendu sous 12 biens.

**Le point commun des clones à chercher** : il paie déjà pour acquérir des
mandats, il en est mécontent, et il ne sait pas dire pourquoi ça ne marche pas.

### 1.3 Le portrait

> **Karim Vasseur, 44 ans**, gérant de son agence à Vertou, en Loire-Atlantique.
> Secteur : Vertou, Saint-Sébastien-sur-Loire, Basse-Goulaine, Haute-Goulaine,
> Les Sorinières. Il a été négociateur onze ans avant de reprendre l'agence en
> 2016. Cinq négociateurs, une assistante, 96 ventes l'an dernier, un honoraire
> moyen autour de 9 800 €. Il connaît son secteur rue par rue et il en est fier ;
> c'est aussi ce qui l'inquiète, parce que cette connaissance ne s'écrit nulle
> part et ne se transmet pas. Il paie chaque mois autour de 2 400 € de portails
> et 690 € de logiciel de transaction, et il en tire des acquéreurs, jamais des
> vendeurs. Il a testé un fournisseur de leads en 2024 : quatorze contacts, un
> mandat, et le vendeur était déjà chez un confrère. Ce qui l'use n'est pas la
> charge de travail — il aime ce métier — c'est de repartir d'un rendez-vous
> d'estimation en ayant eu raison sans avoir pu le prouver.

### 1.4 Les 9 questions

**1. Où se rassemble-t-il ?**
À la chambre FNAIM de Loire-Atlantique, pour les réunions de secteur et surtout
pour la formation continue obligatoire qu'il doit caser chaque année. Dans son
association AMEPI locale, où il partage ses exclusifs avec les confrères qui
jouent le jeu. Au club d'affaires du mardi matin, 7 h, où il croise le notaire,
le courtier et l'artisan qui lui envoient des vendeurs. Dans les groupes Facebook
de la profession — celui des négociateurs de Loire-Atlantique, ceux des réseaux
de mandataires — où l'on poste une capture d'écran d'estimation avec « vous en
pensez quoi ? ». Sur le groupe WhatsApp inter-agences de son secteur, pour les
inter-cabinets. Et une fois par an au salon RENT, à Paris, en novembre.

**2. Où s'informe-t-il ?**
Le Journal de l'Agence et Immo2 le matin sur son téléphone. Les notes de
conjoncture des Notaires de France quand un vendeur lui parle de « la baisse ».
Un podcast métier dans la voiture entre deux visites. Et, tous les jours, les
sites de prix grand public — c'est son réflexe pour se caler, et c'est
précisément le problème : il se réfère à la même source que le vendeur qu'il doit
convaincre.

**3. Ses trois plus grandes frustrations**
1. « Je prépare deux heures une estimation, le vendeur me sort un chiffre trouvé
   en trente secondes sur un site, et je repars sans mandat. »
2. « Je paie 2 400 € par mois pour des acquéreurs. Des vendeurs, je n'en achète
   pas, j'en mendie. »
3. « J'ai six biens qui sèchent parce que je les ai rentrés au prix du vendeur.
   Dans quatre mois je vais devoir aller lui demander de baisser, et il va me
   dire que c'est moi qui ne sais pas vendre. »

**4. Ses espoirs et ses rêves**
Passer de 20 % à 60 % de mandats exclusifs, et arrêter de courir après le stock.
Une équipe qui sort la même méthode que lui sans lui, pour qu'un départ ne coûte
pas un secteur. Une deuxième agence à trois ans, ou un fonds qui vaudra quelque
chose quand il le vendra. Et, très concrètement, ne plus travailler le samedi
après-midi.

**5. Ses peurs profondes** — ce qu'il ne dit à personne
Qu'il ne sait pas vraiment justifier ses prix. Il a le nez, il a le secteur dans
la tête, mais s'il devait le prouver ligne à ligne devant un vendeur difficile ou
un confrère, il ne pourrait pas — et il sait qu'un jour quelqu'un le mettra
devant. Que sa valeur soit son carnet et non sa méthode. Que dans cinq ans une
machine fasse l'avis de valeur mieux que lui et que ses honoraires deviennent
indéfendables. Qu'il soit en train de transmettre à ses enfants l'idée que
travailler le samedi est normal.

**6. Son canal de communication préféré**
Le téléphone portable pour tout ce qui est chaud : appel, puis WhatsApp. Il ne
remplit pas de formulaire de contact, il rappelle. L'e-mail lui sert à ce qui se
lit, et il le lit à deux moments : entre 6 h 45 et 7 h 15, et entre 21 h et 22 h.
LinkedIn en lecture seule, jamais en conversation.

**7. Son vocabulaire exact**
R1, R2 · rentrer du mandat · la pige · mandat simple, semi-exclu, exclusif · le
prix de présentation · l'avis de valeur · le net vendeur · un bien qui sèche ·
surcoté · le stock · le portefeuille · le taux de transformation · l'AMEPI · la
purge du SRU · sous compromis · une passoire (DPE F ou G) · « il est mandaté
ailleurs » · « il veut tester le marché » · « le vendeur est à 380, le marché est
à 345 » · « j'ai un acquéreur sur ce profil ».

**8. Sa journée type**

| Heure | Ce qu'il fait |
|---|---|
| 6 h 50 | Café, téléphone. Alertes de pige, puis e-mails. **Première fenêtre de lecture.** |
| 7 h 40 | Dépose les enfants |
| 8 h 15 | Agence, point avec l'assistante, compromis et relances |
| 8 h 45 | Lundi : réunion d'équipe. Tableau des mandats, baisses de prix à obtenir |
| 9 h 30 – 12 h 30 | Pige téléphonique, relances vendeurs, un R1 |
| 12 h 30 | Déjeuner au bureau. Groupes Facebook et LinkedIn sur le téléphone |
| 14 h – 18 h | Visites et R2. Il fait lui-même les estimations au-dessus de 400 000 € |
| 18 h – 19 h 30 | Retour agence, signatures, relances |
| 21 h – 22 h | Deuxième session. C'est là qu'il ouvre un PDF. **Deuxième fenêtre de lecture.** |
| Samedi 9 h – 13 h | Visites. Sa meilleure demi-journée de rentrée de mandat |

Conséquence opérationnelle : **envoi mardi ou jeudi à 6 h 30, relance dimanche à
20 h.** Jamais un mercredi 15 h : il est en visite, l'e-mail meurt dans la pile.

**9. Ce qui le rend heureux** — où glisser une surprise
Qu'un vendeur signe un exclusif après avoir vu trois confrères. Un tableau du
lundi avec trois compromis. Recevoir quelque chose d'utile qui ne cherche pas à
lui vendre quelque chose dans la même page. La surprise à glisser : au deuxième
e-mail, lui envoyer sans le prévenir le décompte des ventes réellement
enregistrées sur ses communes, sur cinq ans, avec le nombre de mutations
disponibles par typologie. C'est calculable depuis DVF, ça ne demande aucune
saisie de sa part, et personne ne le lui a jamais envoyé.

### 1.5 Les verbatims

Douze phrases telles qu'il les dit. Elles servent de banque de mots pour tout le
copy : on recopie, on ne reformule pas.

1. « Le vendeur, il a son chiffre en tête avant que j'arrive. Moi j'ai deux
   heures de préparation, lui il a un site gratuit. Devinez qui gagne. »
2. « Je suis passé après deux confrères. Le premier lui a dit 395, le deuxième
   410. Moi je suis à 355 et c'est moi qui passe pour le rigolo. »
3. « J'ai six biens qui sèchent. Six. Rentrés au prix du vendeur, parce que
   sinon je ne les avais pas. »
4. « On met 2 400 balles par mois dans les portails et on n'a que des
   acquéreurs. Des vendeurs, zéro. »
5. « Les leads que j'ai achetés l'an dernier ? Quatorze contacts, un mandat. Et
   encore, le type était déjà chez un confrère. »
6. « Ce que je veux c'est de l'exclu. Le reste, c'est du travail gratuit pour le
   voisin. »
7. « Mon secteur je l'ai dans la tête. Mais si demain il faut que je le prouve
   sur un papier, je fais quoi ? »
8. « Quand je dis "d'après mon expérience", je vois dans ses yeux que ça ne pèse
   rien. »
9. « Il me sort son estimation en ligne. Je ne peux pas lui dire que c'est faux,
   je n'ai rien pour montrer que c'est faux. »
10. « Une estimation c'est deux heures. Deux heures pour un truc qui ne me
    rapporte rien si je ne signe pas. »
11. « Mes négociateurs, chacun estime à sa sauce. Je ne peux pas leur reprocher,
    je ne leur ai jamais donné de méthode. »
12. « Je ne veux pas d'un outil de plus. J'ai déjà six logiciels et j'en utilise
    deux. »

**Le mur contre lequel tout le monde se cogne** — verbatim 9 : il a raison et il
n'a pas de quoi le montrer.

**Le manque que personne ne comble** : les outils du marché servent le vendeur
(estimation grand public) ou l'agence (logiciel de transaction). Personne ne
fabrique **la pièce que l'agent pose sur la table**, sourcée, datée, opposable.

**La promesse que le marché attend et que personne ne fait** : *vous n'aurez plus
à défendre votre chiffre — vous poserez les ventes qui l'ont produit.*

### 1.6 Douleur → conséquence → ce que CorpusImmo y oppose

Chaque contre-mesure porte son statut. Ce qui est marqué **à construire** n'existe
pas aujourd'hui dans le code.

| Douleur (ses mots) | Conséquence pour lui | Ce que CorpusImmo y oppose | Statut |
|---|---|---|---|
| « Il me sort son estimation en ligne, je n'ai rien pour montrer que c'est faux » | Mandat perdu, ou rentré 8 à 12 % trop haut | La carte DVF plein écran, gratuite, sans compte : on sort le téléphone en rendez-vous et on montre les ventes réellement enregistrées de sa rue, datées, à la parcelle | **Existe** — MapLibre, tuiles PLAN IGN, DVF géolocalisées Etalab, millésimes 2021→2025 |
| « Si demain il faut que je le prouve sur un papier, je fais quoi ? » | Il perd face au confrère qui a une plaquette | Un moteur d'estimation dont la méthode est publiée : escalade de rayon 500 m → 1 km → 2 km → 5 km, quatre sous-scores combinés en moyenne géométrique pondérée, journal de tout ce qui a été écarté et pourquoi | **Existe** — `docs/valuation-engine.md`, 131 tests |
| « Les sites sortent un chiffre même là où il n'y a rien à comparer » | Il sait le chiffre faux, donc il ne peut pas s'en servir | Refus de conclure sous **5 mutations retenues**, vérifié deux fois, appliqué même à une sélection manuelle de professionnel. Motif d'échec rédigé pour un humain | **Existe** |
| « Une fourchette à plus ou moins 8 %, ça ne vaut rien » | Aucun argument en rendez-vous | Demi-largeur calculée à partir de la dispersion, de la rareté et de l'ancienneté des comparables, bornée entre ±5 % et ±22 %. Une donnée pauvre produit une fourchette large, et ça se voit | **Existe** |
| « Une valeur de marché ne peut pas être le prix d'une seule vente » | Il se fait démonter sur un comparable atypique | Plafond de dominance à 40 % par comparable, excédent redistribué — y compris par-dessus une pondération manuelle maximale d'un professionnel | **Existe** |
| « On paie pour des acquéreurs, jamais pour des vendeurs » | Le stock ne se remplit pas | Parcours d'estimation propriétaire avec trois consentements distincts, jamais pré-cochés, dont « être mis en relation avec un professionnel ». Consentement stocké comme **événement daté** (canal, date, empreinte, version de politique, révocation), pas comme booléen. Score de lead en cinq bandes, affiché avec son détail | Scoring et schéma de base **existent** ; la place de marché, les contrats d'exclusivité par commune et la facturation sont **à construire** |
| « Je refais les mêmes calculs dans dix tableurs, chacun avec ses barèmes périmés » | Erreurs, et du temps perdu chaque semaine | 13 matrices Excel sans macro et 10 outils de calcul en ligne. Les taux réglementaires vivent dans un onglet « Paramètres » daté 2026, jamais enfouis dans une formule | **Existe** |
| « Mes négociateurs estiment chacun à sa sauce » | Un départ emporte un secteur | Une méthode écrite et auditable, adossée à la matrice « Avis de valeur par comparaison » (8 comparables, ajustements automatiques, trois verrous statistiques) | Matrice et outil **existent** ; le programme de formation, la certification Qualiopi et la prise en charge OPCO sont **à construire** |

---

## 2. Le marché et son stade de conscience

### 2.1 Où en est le prospect

Sur les quatre étages de conscience, le directeur d'agence n'est **jamais** dans
les 60 % qui ignorent avoir un problème. Il vit la douleur toutes les semaines,
elle a un nom et un montant.

| Étage | Sa situation | Part du segment |
|---|---|---|
| Achète maintenant | Son contrat portail ou son fournisseur de leads arrive à échéance ce trimestre, ou il vient de perdre un négociateur | ~3 % |
| Collecte de l'information | Rentrée de septembre, budget de janvier, retour du salon RENT : il compare | ~17 % |
| Conscient du problème, pas en recherche | La majorité. Il a un fournisseur, ça marche à moitié, il ne cherche pas | ~20 % |
| Inconscient du problème | Presque personne, sur ce segment | ~60 % → quasi nul |

Mais la conscience du **problème** n'est pas la conscience de la **solution**, et
c'est là que tout se joue. Il est :

- **conscient du problème** — « je perds des mandats parce que je n'ai pas de
  quoi prouver mon prix » ;
- **inconscient de la solution** — il ne sait pas qu'une catégorie d'outil fondée
  sur les actes existe ;
- **totalement inconscient du mécanisme** — il ignore que les Demandes de Valeurs
  Foncières sont publiées en open data par la DGFiP, gratuitement, exploitables,
  et que la donnée qui l'intéresse est publique depuis des années. Il croit que
  « les prix », c'est un produit qu'on achète.

C'est une position rare et très favorable : la douleur n'est plus à créer, seul
le mécanisme est à révéler. Un marché dont le problème est mûr et dont la
solution est inconnue est le meilleur terrain qui soit pour un contenu à haute
valeur.

### 2.2 Ce que ça impose au message d'entrée

Sept conséquences, à opposer à toute tentation de raccourci.

1. **Le point d'entrée ne peut pas être l'offre.** Ni « nos leads vendeurs », ni
   « notre abonnement data » : ce sont des messages chauds servis à un trafic
   tiède. On perd le prospect et le budget.
2. **On entre par la scène, pas par la technologie.** Le premier mot doit être le
   rendez-vous perdu et le bien qui sèche, pas la qualité de la donnée. La donnée
   est notre sujet ; son sujet, c'est son stock de mandats.
3. **On apporte le mécanisme comme une nouvelle.** Le pivot tient en une phrase :
   *une annonce est une demande, un acte est un fait — et les actes sont
   publiés.* C'est ça, l'information qu'il n'a pas.
4. **On donne un résultat le jour même.** Pas une promesse : un dossier de huit
   ventes prêt à sortir au prochain rendez-vous.
5. **L'appel à l'action d'entrée est un téléchargement.** Jamais une prise de
   rendez-vous. Un appel de vente à ce stade, c'est la demande en mariage au
   premier regard.
6. **La preuve précède la capture.** La carte et l'observatoire se consultent
   librement, sans compte : il vérifie que l'outil existe avant qu'on lui demande
   quoi que ce soit. C'est la doctrine du site — on ne paie jamais pour
   consulter, on s'identifie pour emporter.
7. **Le contenu vit dans la bibliothèque, pas sur la page de vente.** Le routage
   arrêté dans l'architecture est explicite : professionnel froid → `/ressources` ;
   tiède attiré par un aimant précis → `/ressources/[la-fiche]` ; chaud, en
   discussion → `/solutions`. Les publicités pointent donc sur la fiche du
   rapport, jamais sur `/solutions/leads-vendeurs`.

### 2.3 Les trois mensonges du marché

Trois croyances que CorpusImmo peut attaquer de face. Règle de rédaction, non
négociable : **on décrit deux natures de données ou sa propre méthode ; on ne
qualifie jamais la méthode d'un concurrent nommé.** Le dénigrement d'un
concurrent identifiable engage la responsabilité civile, et la comparaison
publicitaire est encadrée. On attaque une pratique de marché, jamais une
enseigne.

---

**Mensonge n° 1 — « Le prix du marché, c'est ce qu'on lit dans les annonces. »**

*Ce que le marché laisse croire.* Qu'un indice construit à partir de biens **en
vente** dit ce que le marché **paie**.

*Ce qui est vrai.* Une annonce est une demande : c'est l'hypothèse d'un vendeur,
révisable, parfois jamais réalisée. Un acte est un fait : il est enregistré au
service de la publicité foncière, il porte une date, un prix, une parcelle. Ce ne
sont pas deux mesures inégales du même objet, ce sont deux objets différents.

*Ce que CorpusImmo oppose, et peut prouver.* Tout ce qui est affiché vient des
Demandes de Valeurs Foncières publiées en open data par la DGFiP, millésimes 2021
à 2025, géolocalisées à la parcelle. Chaque mutation affichée est cliquable,
datée, adressée. La source est nommée sur chaque écran.

*Ce qu'on n'a pas le droit de dire, et qu'on ne dira pas.* Aucun chiffrage d'un
écart entre prix demandés et prix payés. CorpusImmo ne détient aucune donnée
d'annonces et n'en collectera pas : l'extraction substantielle d'une base
immobilière est sanctionnée au titre du droit *sui generis* du producteur de base
de données, et les conditions d'utilisation des portails l'interdisent. On ne
peut donc pas mesurer cet écart — alors on ne l'invente pas.

---

**Mensonge n° 2 — « L'algorithme connaît la valeur de votre bien. »**

*Ce que le marché laisse croire.* Qu'un chiffre unique, affiché à l'euro près,
sans effectif ni marge, constitue une valeur.

*Ce qui est vrai.* Il existe des endroits et des typologies où la donnée ne
permet pas de conclure. Un secteur avec deux ventes d'appartements en cinq ans
n'a pas de prix au m² : il a deux anecdotes. Publier une moyenne sur un effectif
trop faible, ou dominée par une observation unique, heurte le secret statistique.

*Ce que CorpusImmo oppose, et peut prouver ligne à ligne.*

- plancher de **5 mutations retenues**, sinon échec explicite — jamais un chiffre ;
- **plafond de dominance à 40 %** : une valeur publiée ne peut jamais être, en
  pratique, le prix d'une seule vente ;
- **fourchette calculée**, pas décorative : `0,03 + 0,50 × dispersion + 0,09 ×
  rareté + 0,04 × ancienneté`, bornée entre ±5 % et ±22 % ;
- **plafonds de confiance durs** : 55 sous six comparables, 55 si la dispersion
  dépasse 0,35, 65 au-delà de 42 mois d'ancienneté moyenne, 60 sur de
  l'immobilier d'entreprise ;
- **échec assumé** là où DVF ne publie pas : Bas-Rhin, Haut-Rhin, Moselle et
  Mayotte relèvent du livre foncier, le moteur répond une erreur, jamais une
  valeur ;
- **jamais de repli silencieux** : si la source est injoignable, l'écran le dit et
  propose de réessayer. Un jeu de démonstration existe, il est neutralisé en
  production par construction ;
- et le mot **estimation**, jamais le mot **expertise** — l'un est une statistique
  indicative, l'autre est un acte que seul un professionnel ayant visité le bien
  peut poser. Le disclaimer accompagne chaque valeur affichée.

*Formulation défendable.* On énonce une doctrine sur son propre produit. Aucune
affirmation sur celui d'un tiers.

---

**Mensonge n° 3 — « Un lead, c'est un contact. »**

*Ce que le marché laisse croire.* Qu'une adresse dans un fichier vaut un vendeur,
et qu'un contact acheté est un contact utilisable.

*Ce qui est vrai.* Transmettre les coordonnées d'un particulier à un
professionnel tiers suppose son consentement — libre, spécifique, éclairé,
univoque, et démontrable. Sans preuve de consentement, le contact n'est pas
« moins bon » : il est incommercialisable. Ce n'est pas une opinion commerciale,
c'est le régime applicable depuis mai 2018.

*Ce que CorpusImmo oppose, et peut prouver.*

- la case « être mis en relation avec un professionnel de mon secteur » est
  **distincte** des deux autres, **facultative**, **jamais pré-cochée** ; sans
  elle, la demande n'est jamais transmise ;
- le consentement est stocké comme un **événement daté**, une ligne par décision :
  canal, accordé ou refusé, horodatage, empreinte salée de l'adresse IP, agent
  utilisateur, version de la politique, date de révocation. Pas un booléen qu'on
  écrase ;
- le score est **additif, plafonné à 100 et détaillé** en cinq bandes — intention
  de projet, consentement, complétude, valeur estimée, fraîcheur — et le détail
  est montré au professionnel, pas seulement la note ;
- le vendeur sait **combien** de professionnels reçoivent sa demande : un seul en
  exclusif, trois au maximum en mutualisé, annoncé ;
- aucune base achetée ailleurs n'est revendue ; une demande manifestement erronée
  ou injoignable est recréditée ; le vendeur peut se retirer, et la diffusion
  cesse le jour même.

*Statut.* Le schéma, le scoring et les consentements existent dans le code. La
distribution commerciale, les contrats d'exclusivité par commune et la
facturation sont **à construire**.

---

## 3. L'aimant principal (HVCO)

### 3.1 Vingt titres, classés

Écrits contre les quatre formules mères et les moules à intrigue du swipe file.
Classés du plus fort au plus faible. Cible : le directeur d'agence.

| # | Titre | Formule | Moteur |
|---|---|---|---|
| 1 | **Les 8 ventes qui décident du prix : le dossier d'actes à poser sur la table en R1, même quand trois confrères sont passés avant vous** | `[Résultat] même si [handicap]` | Intérêt personnel + peur |
| 2 | Ce que la DGFiP enregistre et qu'aucun site de prix ne peut voir : l'estimation par les actes, commune par commune | `Ce que [X] ne vous dira jamais` | Curiosité + exclusivité |
| 3 | Le prix au m² de votre commune est un mensonge statistique. Voici comment le prouver, et par quoi le remplacer | `La vérité sur [Y]` | Choc |
| 4 | 6 raisons pour lesquelles votre vendeur ne vous croit pas — et la seule pièce qui le fait changer d'avis en 20 minutes | `X choses… (la n°Y…)` | Peur + bénéfice |
| 5 | Comment rentrer un mandat au prix du marché sans négocier avec le vendeur, en un seul rendez-vous | `Comment éliminer [problème] sans [renoncement] en [délai]` | Bénéfice direct |
| 6 | 5 ventes : le chiffre en dessous duquel un prix au m² n'existe pas — et ce que ça change dans la moitié des quartiers de votre secteur | `X vérités sur [sujet]` | Choc + spécificité |
| 7 | Le piège qui rend faux un fichier DVF sur deux : pourquoi votre confrère qui télécharge le CSV se trompe d'un facteur 2 | `X erreurs qu'aucun [métier] n'osera avouer` | Curiosité + vanité |
| 8 | Comment ne plus jamais entendre « l'autre agence m'a dit 400 000 » sans avoir de quoi répondre | `Comment éliminer [problème]` | Peur |
| 9 | Arrêtez de défendre un prix. Faites défendre une méthode — et le vendeur cesse de discuter | `X façons d'obtenir [désiré] sans [détesté]` | Bénéfice implicite |
| 10 | Prix demandé, prix enregistré : deux chiffres, deux natures — et pourquoi les confondre fait sécher vos mandats | `La vérité sur [Y]` | Choc |
| 11 | Estimez comme un notaire, sans base notariale : la méthode par comparaison expliquée ligne à ligne | `Obtenir [résultat] comme [expert] sans [prérequis]` | Vanité |
| 12 | Le dossier de R1 en 20 minutes : la préparation qui remplace deux heures de tableur | `[Résultat] en [délai]` | Intérêt personnel |
| 13 | Attention : ne présentez plus un avis de valeur avant d'avoir vérifié ces 6 points | `Attention : ne signez rien avant…` | Peur |
| 14 | Les 6 motifs qui doivent écarter une vente de votre dossier de comparables — dont trois qu'aucun tableur ne détecte | `Ce qu'il ne faut jamais…` | Curiosité |
| 15 | Ce que DVF ne dit pas — et pourquoi c'est la partie la plus utile du fichier | `Et si vous faisiez [X] à l'envers ?` | Curiosité |
| 16 | Les mandats qui sèchent : 4 causes, une seule qui dépend de vous | `X façons de [Y]` | Peur + culpabilité |
| 17 | Combien de ventes faut-il pour parler d'un prix ? La réponse tient en un chiffre, et il n'est pas rassurant | Moule à intrigue | Curiosité |
| 18 | 12 vérités sur les prix de votre secteur, publiées gratuitement par l'État, et que presque personne n'ouvre | `X vérités sur [sujet]` | Curiosité |
| 19 | Le guide de la donnée DVF pour les professionnels de la transaction | — | Faible : décrit, ne promet rien |
| 20 | Estimation immobilière : tout savoir sur les données publiques | — | Mort. Sert de repère : c'est ce qu'écrirait n'importe qui |

### 3.2 Le titre retenu

> ### Les 8 ventes qui décident du prix
> #### Le dossier d'actes à poser sur la table en R1, même quand trois confrères sont passés avant vous

**Pourquoi celui-là.** C'est le seul de la liste qui fasse tenir dans une ligne la
scène exacte qu'il redoute (le rendez-vous où il arrive en troisième), l'objet
qu'il reçoit (un dossier de huit ventes, pas des connaissances) et la source que
son vendeur ne peut pas contester (les actes) — et il passe le test des trois
secondes lu sur un téléphone à 6 h 50, entre deux alertes de pige. Aucun
concurrent ne peut l'écrire à l'identique : il faut travailler sur des actes et
assumer une méthode publiée pour oser promettre « à poser sur la table ».

### 3.3 Le plan du contenu

**Format : PDF, 16 pages, 7 chapitres.** On tient volontairement sous vingt pages
parce qu'il le lit à 21 h après une journée de visites. Chaque intertitre est
écrit pour fonctionner seul, pour celui qui survole.

Tout ce qui suit est produisible à partir des seules DVF et du moteur existant.
**Le rapport lui-même n'existe pas encore : il est à construire.** Ce qui existe,
c'est la donnée, le pipeline d'agrégation, les garde-fous statistiques, les
composants de distribution et la méthode documentée.

| # | Intertitre | Ce qu'il contient | Le résultat concret qu'il en tire |
|---|---|---|---|
| **0** | **« Pourquoi une plateforme d'estimation publie ce qu'elle pourrait vendre »** *(1 p.)* | Le scepticisme traité avant qu'il ne soit formulé : notre métier n'est pas de vendre ce rapport, c'est de transmettre des demandes de vendeurs consenties et d'automatiser du travail d'agence. Un agent qui sait défendre un prix est un meilleur destinataire qu'un agent qui ne sait pas. Dit franchement, en cinq lignes | Il sait pourquoi il lit, et il arrête de chercher le piège |
| **1** | **« Une annonce n'est pas une vente : ce que l'État enregistre, et que personne d'autre ne peut enregistrer »** *(2 p.)* | Ce que sont les mutations à titre onéreux enregistrées au service de la publicité foncière. Ce que DVF contient : date, nature, valeur foncière, type de local, surface réelle bâtie, pièces, terrain, adresse, parcelle. Ce qu'elle ne contient pas : état intérieur, DPE, prestations, exposition, contexte de la vente — c'est-à-dire exactement ce que l'agent, lui, apporte | Une phrase à dire au vendeur pour expliquer d'où vient le chiffre |
| **2** | **« Le piège qui rend faux un fichier DVF sur deux : une mutation n'est pas une ligne »** *(2 p.)* | La valeur foncière est le prix **total** de la mutation, répété à l'identique sur chaque ligne — une par local et par parcelle. Sommer naïvement multiplie le volume par deux ou trois ; diviser le prix d'une ligne par la surface de cette ligne donne des €/m² faux du simple au triple. Il faut regrouper par identifiant de mutation, additionner les surfaces d'habitation, et écarter les multi-lots | Une question à poser à quiconque lui présente une statistique : « vous avez regroupé par mutation ? » |
| **3** | **« 5 ventes : le chiffre en dessous duquel un prix au m² n'existe pas »** *(2 p.)* | Le secret statistique, le plancher d'effectif et la règle de dominance, expliqués sans jargon. Puis le test à faire soi-même : compter les ventes de la typologie visée sur cinq ans dans un rayon de 500 m. **À produire à la génération du rapport** : le décompte, commune par commune, des ventes d'appartements et de maisons 2021-2025, et la liste des communes de son département qui passent sous le plancher. Le calcul existe (`computeMarketStats`, plancher à 5) ; le tableau est à générer | Il sait, pour ses six communes, là où un prix au m² a un sens et là où il n'en a pas |
| **4** | **« La médiane ne suffit pas : pourquoi deux biens de la même rue ne valent pas le même prix »** *(2 p.)* | La dispersion des €/m² à l'intérieur d'une même commune, et l'écart entre premier et dernier quartile. C'est l'argument exact contre le vendeur qui cite une moyenne communale. **À produire** : la distribution des €/m² de chacune de ses communes. Le composant graphique et l'agrégation existent | Un graphique à montrer, qui rend la moyenne communale inutilisable en trois secondes |
| **5** | **« Comment choisir 8 ventes qu'un vendeur ne peut pas écarter »** *(3 p.)* | La grille complète : typologie identique ; ventes uniquement, on écarte échanges, expropriations et adjudications ; mono-lot ; surface à ±30 %, élargie à ±50 % si la matière manque ; moins de 60 mois ; €/m² dans les bornes de Tukey. Puis la pondération — distance 0,35, récence 0,25, similarité de surface 0,25, typologie 0,15 — et pourquoi une moyenne **géométrique** et non arithmétique : une vente à 4 km, mais très récente, ne doit pas remonter au classement. Enfin le plafond de dominance à 40 % | La grille de sélection, refaisable à la main sur n'importe quel secteur |
| **6** | **« Ce que vous ajoutez et que la donnée n'a pas : les 4 ajustements, bornés à ±12 % »** *(2 p.)* | État déclaré, étage et ascenseur, extérieur, stationnement. Pourquoi le plafond : ce sont des ordres de grandeur de marché, pas des coefficients calibrés statistiquement — les afficher et les borner vaut mieux que les cacher. Et le corollaire qui le concerne directement : la part non bornée du métier, c'est la visite. Aucune machine ne la fait | La liste des quatre ajustements et leur amplitude admissible |
| **7** | **« La phrase à dire en R1 quand le vendeur sort un chiffre d'un site »** *(2 p.)* | Le script, en cinq temps : accuser réception du chiffre sans le contredire ; demander sur combien de ventes il repose ; poser le dossier ; montrer la dispersion de la rue ; annoncer une fourchette **en expliquant sa largeur**. Ce qu'on ne dit jamais : « votre bien vaut ». Ce qu'on dit : « les actes de votre rue disent » | Un script qu'il peut utiliser au rendez-vous de demain |
| **8** | **« Et maintenant : refaire ce dossier pour votre secteur en 20 minutes »** *(1 p.)* | La carte et l'observatoire sont libres et sans compte : il refait l'exercice tout de suite. La matrice « Avis de valeur par comparaison » — 8 comparables, ajustements automatiques, trois verrous statistiques — est dans la bibliothèque. Et **une** phrase, une seule, sur les demandes de vendeurs consenties. 80 % de valeur, 20 % d'invitation | Il agit avant d'avoir fini de lire |

### 3.4 La page de capture

Emplacement : `/ressources/dossier-des-8-ventes` — même gabarit que les treize
fiches existantes, landing publique indexable + accès contre e-mail. **À
construire.** Sur cette page : pas de menu, pas de lien vers le blog, pas de
second appel à l'action, pas de champ téléphone.

---

**Titre**

> ## Les 8 ventes qui décident du prix
> ### Le dossier d'actes à poser sur la table en R1 — même quand trois confrères sont passés avant vous

**Sous-titre**

> Rapport de 16 pages, 7 chapitres, envoyé immédiatement par e-mail. La méthode
> complète pour bâtir un dossier de comparables à partir des actes enregistrés
> par la DGFiP : les 6 filtres de sélection, les 4 pondérations, le piège qui
> fausse un fichier DVF sur deux, et le script du rendez-vous.

**Vous découvrirez**

- Pourquoi diviser un prix DVF par une surface donne un €/m² faux du simple au
  triple — et la seule opération qui le corrige.
- Les 6 motifs qui doivent écarter une vente de votre dossier, dont trois
  qu'aucun tableur ne détecte tout seul.
- Le chiffre en dessous duquel un prix au m² n'est pas une statistique mais une
  anecdote — et comment vérifier en deux minutes si vos communes sont au-dessus.
- Vous croyez que la médiane de votre commune suffit ? Ce que la dispersion des
  €/m² d'une même rue dit à un vendeur, et qu'aucune moyenne ne dira jamais.
- La phrase exacte à dire quand un vendeur pose son estimation en ligne sur la
  table — et les deux questions à lui poser avant de sortir la vôtre.

**Formulaire** — deux champs, prénom et e-mail. Rien d'autre.

**Bouton**

> **Recevez le dossier**

Sous le bouton, en petit : *PDF de 16 pages. Envoi immédiat. Pas de démarchage
téléphonique.*

**Réassurance RGPD**

Case à cocher unique, obligatoire, jamais pré-cochée :

> ☐ J'accepte de recevoir ce dossier à cette adresse. CorpusImmo l'utilise pour
> vous l'envoyer, puis pour vous adresser ses publications sur les données de
> transaction. Vous vous désinscrivez en un clic dans chaque message.

Bloc sous le formulaire :

> **Ce que devient votre adresse.** Responsable de traitement : CorpusImmo.
> Finalité : vous envoyer le dossier demandé, puis nos publications sur les
> données de transaction. Base légale : votre consentement, que vous pouvez
> retirer à tout moment. Destinataires : notre équipe et notre prestataire
> d'envoi, tous deux situés dans l'Union européenne. Aucune revente, aucun
> partage à un tiers, aucun transfert hors Union européenne. Conservation :
> 3 ans à compter de votre dernier contact avec nous. Vous disposez d'un droit
> d'accès, de rectification, d'effacement, d'opposition, de limitation et de
> portabilité, que vous exercez en répondant à n'importe lequel de nos messages,
> et d'un droit de réclamation auprès de la CNIL. → Politique de confidentialité.

Trois notes de construction, pour ne pas publier une promesse fausse :

1. La raison sociale complète, le SIREN et l'adresse du siège doivent figurer
   dans ce bloc. C'est **la seule ligne qui dépend d'un élément non encore
   existant** : elle se renseigne à l'immatriculation.
2. Aujourd'hui, le formulaire des ressources **n'enregistre aucune adresse** :
   il ouvre l'accès au fichier, et il le dit au visiteur mot pour mot. La liste
   de diffusion, la table de consentement des ressources — sur le modèle des
   consentements de leads, un événement daté par décision — et le lien de
   désinscription sont **à construire**. Tant qu'ils n'existent pas, le texte
   ci-dessus ne peut pas être affiché : c'est le code qui doit rattraper la
   promesse, jamais l'inverse.
3. Aucune garantie commerciale n'est attachée à un contenu gratuit, et aucune
   promesse de résultat n'est faite sur ce que le lecteur obtiendra en
   rendez-vous. La garantie porte sur les prestations payantes, s'ajoute aux
   garanties légales sans les remplacer, et se formule ailleurs — avec son
   périmètre, sa durée et sa procédure.

---

## 4. Les aimants secondaires

### 4.1 Le principe des deux faces

Il est déjà arrêté dans l'architecture du site et déjà écrit dans le code :
**chaque ressource a une landing publique, indexable, qui décrit et démontre — et
un accès conditionné à un e-mail ou à un compte.** Une seule règle gouverne le
verrou : *on ne paie jamais pour consulter, on s'identifie pour emporter.*

Ce qui transforme un outil en aimant autonome, et non en page de catalogue, tient
en quatre conditions. Elles sont à vérifier une par une sur chacune des treize
fiches.

1. **La landing répond seule à une question que le marché tape.** Son titre est
   une promesse, jamais un nom de fichier. « Calculateur de rentabilité locative »
   décrit ; « le rendement affiché sur l'annonce est faux de 3 points » promet.
2. **Le résultat arrive avant la capture.** L'outil en ligne calcule et affiche le
   chiffre sans rien demander. Ce qui coûte une adresse, c'est ce qui **sort du
   site** : le classeur, l'export. Un outil qui exige l'e-mail avant le premier
   calcul n'est pas un aimant, c'est un péage.
3. **Une seule porte pour les deux sorties.** Le fichier et l'outil passent par le
   même verrou : le visiteur ne donne son adresse qu'une fois, et il comprend
   pourquoi.
4. **L'invitation qui suit est corrélée au contenu**, jamais générique. Une
   matrice de valorisation renvoie à la formation ; un rent roll renvoie à
   l'automatisation ; l'avis de valeur et le net vendeur renvoient aux demandes de
   vendeurs. C'est déjà la mécanique en place.

**État réel du parc.** 13 matrices Excel, dont 10 disposent d'un outil de calcul
en ligne. Dix ressources s'ouvrent contre un e-mail, trois contre un compte
gratuit — DCF, bilan promoteur, rent roll — parce que ce sont les trois qui
qualifient le mieux d'eux-mêmes. Les trois matrices sans outil en ligne — bilan
de marchand de biens, répartition des profits entre associés, développement
tertiaire — sont aujourd'hui des aimants **à une face et demie** : landing et
fichier, sans démonstration interactive. Leurs outils sont **à construire**, et
c'est le meilleur arbitrage disponible dans la bibliothèque, puisqu'ils parlent
aux segments à plus fort ticket.

### 4.2 Le tableau : outil → segment → titre d'accroche

Les treize, avec leur porte, leur outil en ligne quand il existe, et l'offre vers
laquelle ils renvoient.

| # | Ressource | Outil en ligne | Porte | À quel segment elle parle | Titre d'accroche de sa landing | Renvoie vers |
|---|---|---|---|---|---|---|
| 1 | Calculateur de rentabilité locative | ✅ | e-mail | Investisseur locatif en direct ; le négociateur qui vend de l'investissement | **« Le rendement affiché sur l'annonce est faux de 3 points. Voici les trois vrais — et celui qui décide de votre trésorerie. »** | Formation |
| 2 | Tableau d'amortissement et comparateur de 3 prêts | ✅ | e-mail | Primo-accédant ; courtier ; négociateur qui sécurise un financement | **« Entre deux offres de prêt, celle au taux le plus bas peut vous coûter 4 200 € de plus. Le comparateur qui le prouve en trois lignes. »** | Formation |
| 3 | Nu, LMNP ou SCI à l'IS | ✅ | e-mail | Bailleur ; conseiller en gestion de patrimoine | **« Cinq régimes fiscaux, le même bien, plus de 2 000 € d'écart par an. Lequel vous laisse le plus, et de combien. »** | Formation |
| 4 | Chiffrage de travaux par lot | ✅ | e-mail | Marchand de biens ; investisseur rénovateur ; agent qui vend de l'ancien à rafraîchir | **« Chiffrez une rénovation à 15 % près avant la visite, sans attendre trois semaines de devis. »** | Formation |
| 5 | Capacité d'emprunt et bilan patrimonial | ✅ | e-mail | **Négociateur en agence** (qualification acquéreur) ; primo-accédant | **« Le prix maximal que la banque acceptera vraiment — calculé comme le fait un analyste crédit, pas comme un simulateur de portail. »** | Formation |
| 6 | DCF immobilier sur 10 ans | ✅ | compte | Investisseur professionnel, family office, asset manager | **« 75 % de la valeur de votre DCF tient dans une seule hypothèse. La matrice de sensibilité qui vous dit laquelle. »** | Formation |
| 7 | Bilan promoteur et charge foncière admissible | ✅ | compte | Promoteur ; marchand de biens ; agent foncier | **« "Combien vaut ce terrain ?" est la mauvaise question. Voici combien vous pouvez le payer sans perdre votre marge. »** | Formation |
| 8 | Rent roll, WAULT et échéancier des baux | ✅ | compte | Asset manager ; investisseur en immobilier d'entreprise ; property manager | **« Votre WAULT affiche 6 ans. Votre risque réel porte sur 3. Le modèle qui sépare les deux. »** | Automatisation |
| 9 | **Avis de valeur par comparaison** | ✅ | e-mail | **Le client de rêve** : directeur d'agence et ses négociateurs | **« Arrêtez de défendre un prix. Faites défendre une méthode — et le vendeur cesse de discuter. »** | Leads vendeurs |
| 10 | **Net vendeur, honoraires et qualification du mandat** | ✅ | e-mail | **Le client de rêve** : l'agent en rendez-vous vendeur | **« "Il me reste combien ?" — la question que tout vendeur pose, et à laquelle presque aucun agent ne répond avec un chiffre. »** | Leads vendeurs |
| 11 | Bilan de marchand de biens et TVA immobilière | ❌ *à construire* | e-mail | Marchand de biens ; opérateur | **« TVA sur marge ou TVA sur prix total : les deux régimes côte à côte, et ce que l'erreur coûte à la revente. »** | Formation |
| 12 | Répartition des profits entre associés | ❌ *à construire* | e-mail | Club deal ; opérateur qui lève auprès de proches | **« Qui touche quoi, et dans quel ordre : la cascade à écrire avant de signer, pas après. »** | Formation |
| 13 | Développement tertiaire — bureaux et activité | ❌ *à construire* | e-mail | Promoteur tertiaire ; investisseur en développement | **« 48 mois de flux mensuels : ce qui reste de votre marge quand le calendrier glisse d'un trimestre. »** | Formation |

### 4.3 Le déséquilibre à corriger

Le constat saute aux yeux une fois le tableau posé : **deux ressources sur treize
parlent au client de rêve.** La bibliothèque, aujourd'hui, s'adresse
majoritairement à l'investisseur et à l'opérateur — des segments réels, mais qui
ne sont ni les plus rapides, ni les plus récurrents, ni les acheteurs des trois
lignes de revenus.

Ce n'est pas un défaut de la bibliothèque : c'est le rôle que doit tenir l'aimant
principal. Le rapport de la section 3 vise le directeur d'agence de face, et il
est le seul point d'entrée du dispositif qui le fasse.

Trois aimants secondaires supplémentaires, tous **à construire**, tous
alimentables par la donnée déjà branchée, rééquilibreraient la bibliothèque vers
le client de rêve :

1. **Le compteur de ventes par commune sur 5 ans.** « Combien de maisons se sont
   réellement vendues dans votre commune depuis 2021 ? » Landing publique,
   résultat affiché sans capture, export réservé au compte. C'est le meilleur
   candidat au référencement de tout le dispositif, et l'agrégation existe déjà.
2. **Les pages `/prix-immobilier/[ville]`**, prévues par l'architecture, non
   construites. Cinquante à cent pages, une par commune, adossées aux mêmes
   garde-fous : là où l'effectif est insuffisant, la page le dit au lieu
   d'afficher un chiffre. C'est un argument de crédibilité autant qu'un actif de
   référencement.
3. **Le comparateur simple / semi-exclusif / exclusif**, avec ce que chaque
   formule change en délai de vente et en écart au prix de présentation. Il vise
   la douleur n° 1 du client de rêve — mais il exige une donnée de délai de vente
   que DVF ne contient pas. À bâtir sur les données de ses propres mandats, ou
   pas du tout. À ne surtout pas simuler.

---

## 5. Les services proposés

Trois sources de revenus, trois clients différents, trois maturités très
différentes. Le tableau ci-dessous dit d'abord où l'on en est réellement, parce
que rien de ce qui suit ne vaut si l'on se ment sur ce point.

| Source | Ce qui existe dans le code | Ce qui reste à construire |
|---|---|---|
| Leads vendeurs | le parcours d'estimation, les trois consentements séparés, l'horodatage serveur, le score 0-100 avec son détail | la livraison au professionnel, la facturation, le plafonnement par secteur, le recrédit |
| Solutions IA | les pages `/solutions/*`, les quatre cas d'usage écrits, la preuve par les outils publics | le moteur de prestation lui-même — les trois pages portent le badge « Bientôt disponible » |
| Abonnement data / API | les routes internes `/api/dvf/transactions`, `/api/estimation`, `/api/geocode`, le moteur de valorisation documenté | l'authentification par clé, les quotas, le contrat, la facturation, la documentation publique |

### 5.1 Leads vendeurs

**Ce qu'on vend.** La mise en relation avec un propriétaire qui a mené un
parcours d'estimation jusqu'au bout sur le site et qui a coché, de sa main, une
case distincte : « J'accepte qu'un professionnel de l'immobilier me contacte au
sujet de ce bien. » On ne vend pas un mandat, on ne vend pas une intention de
vente certaine, on vend un contact consenti et daté.

**À qui.** Directeur ou dirigeant d'agence indépendante, responsable de secteur
d'un réseau de mandataires, agence de 2 à 15 collaborateurs, sur un périmètre
défini à la commune ou par groupe de communes.

**Ce qui est livré, champ par champ** (ce sont exactement les données que
`/api/leads` enregistre aujourd'hui) :

- prénom, nom si le propriétaire l'a donné, adresse e-mail ;
- téléphone **si** il l'a saisi — le champ est facultatif et le reste ;
- type de bien parmi neuf (appartement, maison, terrain, immeuble, parking,
  commerce, bureau, local d'activité, autre) ;
- commune, code INSEE, code postal ;
- surface habitable déclarée ;
- horizon de projet déclaré, sur une échelle de huit valeurs allant de
  « curiosité » à « vendre sous 3 mois » ;
- la fourchette d'estimation basse et haute produite par le moteur ;
- le score de maturité sur 100, **avec son détail poste par poste** : intention
  0 à 40, consentement professionnel 0 à 25, complétude du dossier 0 à 20,
  valeur estimée 0 à 10, fraîcheur 0 à 5 ;
- l'horodatage serveur du consentement, produit côté serveur et jamais accepté
  depuis le navigateur.

**Ce qui n'est pas livré, et il faut le dire avant la vente.**

- **L'adresse précise du bien.** Le lead porte la commune et le code postal, pas
  la rue ni le numéro. L'adresse se demande au propriétaire ; c'est lui qui la
  donne, à qui il veut.
- Aucun DPE, aucune photo, aucun diagnostic, aucune visite.
- Aucun engagement de signature, aucune exclusivité de mandat, aucune promesse
  de joignabilité au premier appel.
- Aucun contact issu d'une base achetée ailleurs. Un lead sans consentement
  explicite n'existe pas dans ce système : le serveur rejette la requête si le
  consentement de livraison manque, et il ne déduit jamais un accord d'un autre.

**Le consentement — c'est le cœur du modèle, pas une formalité.**

Ce qui est déjà juste dans le code :

1. trois cases séparées (recevoir l'estimation / être contacté par un
   professionnel / recevoir les actualités), aucune pré-cochée ;
2. le refus est le défaut : un champ absent vaut refus, jamais accord ;
3. l'estimation est délivrée **même si** la case « professionnel » reste
   décochée — il n'y a pas de mur de consentement, donc le consentement reste
   libre au sens du RGPD ;
4. l'horodatage est serveur, donc opposable ;
5. l'adresse e-mail n'apparaît jamais en clair dans un journal applicatif.

Ce qui manque et doit être ajouté **avant** la première revente :

- **Les destinataires.** L'article 13 du RGPD impose d'indiquer les
  destinataires ou leurs catégories. Le libellé actuel dit « un professionnel de
  l'immobilier » sans plus. À réécrire : « agences immobilières et réseaux de
  mandataires titulaires de la carte professionnelle T, exerçant sur la commune
  de votre bien », avec un lien vers la liste des partenaires en vigueur.
- **La durée de conservation.** À annoncer et à appliquer : 24 mois après le
  dernier contact utile, puis suppression. La doctrine CNIL sur la prospection
  retient 3 ans après le dernier contact ; on se tient en deçà.
- **La preuve du libellé.** Horodater le consentement ne suffit pas : il faut
  conserver la **version exacte du texte affiché** au moment où la case a été
  cochée. Un libellé versionné, référencé dans l'enregistrement du lead.
- **Le retrait.** Un lien de retrait dans l'e-mail d'estimation, et l'arrêt de
  diffusion le jour même — c'est déjà promis sur `/solutions/leads-vendeurs`, ce
  n'est pas encore branché.
- **Le contrat avec le professionnel destinataire.** Il devient responsable de
  traitement autonome. Le contrat doit poser par écrit : qu'il informe la
  personne de la source des données dans le mois (article 14 du RGPD) ; qu'il
  n'utilise le contact que pour l'objet annoncé ; qu'il ne le recède pas ; qu'il
  reste seul responsable de ses propres obligations de démarchage — notamment
  les horaires légaux du démarchage téléphonique et sa situation au regard de
  Bloctel, que le consentement recueilli ici ne suffit pas à couvrir.

### 5.2 Solutions IA aux professionnels

Deux prestations distinctes, vendues séparément.

**A. L'automatisation sur mesure.**

Ce qu'on vend : la construction, la mise en service et la passation d'un
automatisme métier, sur les quatre cas d'usage déjà cadrés sur
`/solutions/automatisation`.

| Cas | Entrée | Sortie |
|---|---|---|
| Qualification des demandes vendeurs | formulaire du site, boîte e-mail, portails, appels transcrits | fiche CRM complète et notification à l'agent du secteur |
| Relance des estimations sans suite | estimations restées sans suite au-delà de 45 jours | séquence à trois temps, sortie automatique à la première réponse |
| Estimation augmentée | une adresse et quelques caractéristiques | un pré-avis de valeur documenté que le professionnel corrige au lieu de le construire |
| Reporting de portefeuille | comptabilité, gestion locative, tableurs | document assemblé et diffusé à date fixe, écarts en tête |

Ce qui est livré : l'automatisme installé et connecté aux outils existants, son
jeu d'essai, sa documentation, les identifiants, et deux heures de prise en main.
Le client garde le tout, y compris s'il arrête là.

Ce qui n'est pas livré, et c'est écrit sur la page :

- on ne remplace pas le CRM du client — on s'y branche ou on le laisse ;
- on n'automatise **aucune décision commerciale** : un score se lit, il ne signe
  pas de mandat ;
- on ne se branche pas sur un logiciel dont l'éditeur ne donne aucun accès — on
  le dit au cadrage, pas après ;
- on ne facture pas d'abonnement pour maintenir un automatisme que le client
  peut tenir seul.

**À construire :** la totalité de la prestation. Aujourd'hui la page est écrite,
le moteur n'existe pas.

**B. La formation.**

Ce qu'on vend : quatre modules d'une demi-journée, six participants au maximum,
en intra ou à distance, animés sur les matrices de la bibliothèque et sur des
mutations DVF réelles.

1. Ce qui se délègue, ce qui ne se délègue pas.
2. Valoriser avec méthode — comparaison, revenu, et l'écart entre les deux.
3. Faire produire, puis contrôler.
4. Tenir le chiffre devant un client.

Ce qui est livré : la session, les fichiers de travail (les mêmes que ceux de la
bibliothèque publique), le protocole de relecture en six points, et l'attestation
de présence.

Ce qui n'est pas livré : aucune certification, aucun titre inscrit à un
répertoire national, donc **aucun financement OPCO annoncé** tant que la
certification n'existe pas. Le dire avant, pas après la facture.

**À construire :** les supports. Le programme est écrit, rien n'est produit.

### 5.3 Abonnement data et API

Ce qu'on vend : l'accès programmatique à ce que le site expose déjà en interne —
les mutations DVF normalisées et géolocalisées, les indicateurs de commune, la
sélection de comparables, et le moteur d'estimation appelable.

À qui : éditeurs de logiciels immobiliers, réseaux disposant d'une équipe
technique, foncières, courtiers, marchands de biens.

Ce qu'on ne vend surtout pas : « la donnée DVF », qui est ouverte et que
n'importe qui peut télécharger. Ce qui se facture, c'est le travail qu'on a fait
dessus : le nettoyage, l'exclusion des mutations non exploitables (échanges,
expropriations, adjudications, ventes multi-lots), le géocodage, le plancher
statistique de 5 mutations, la pondération documentée et le journal de calcul qui
dit ce qui a été écarté et pourquoi.

Ce qui existe : les routes `/api/dvf/transactions`, `/api/estimation` avec sa
génération de PDF, `/api/geocode`, et un moteur documenté ligne à ligne dans
`docs/valuation-engine.md`.

**À construire :** authentification par clé, quotas, journal d'usage,
documentation publique, contrat, facturation. C'est le chantier le plus lointain
des trois, et il ne s'ouvre qu'après les deux autres.

---

## 6. L'offre du Parrain

### 6.1 L'offre principale — les solutions IA aux professionnels

#### La promesse

> **La tâche qui vous coûte le plus de temps chaque semaine, divisée par deux en
> 90 jours. Mesurée au chronomètre avant, remesurée au chronomètre après.**

Elle est spécifique, elle est datée, et surtout elle est **mesurable** — donc
garantissable. Elle ne promet pas « plus de mandats », qui ne dépend pas de nous
et serait une allégation invérifiable.

#### Le mécanisme unique, nommé

**La méthode Sur Pièces**, en trois temps :

1. **Le Chronomètre.** Une demi-journée sur site, chronomètre en main, à regarder
   ce que l'équipe fait vraiment. On en sort avec deux ou trois tâches candidates
   et le temps qu'elles coûtent, en heures et en euros. Rien n'est estimé au
   doigt mouillé : on mesure.
2. **La Doublure.** L'automatisme construit ne remplace personne le premier jour.
   Il tourne **en parallèle** du processus actuel pendant 30 jours, et chaque
   semaine on relève les écarts entre ce qu'il produit et ce que l'équipe
   produit. Il ne prend la main que le jour où les deux disent la même chose.
3. **La Passation.** Le client récupère l'automatisme, sa documentation et les
   accès. Il peut nous garder pour la maintenance ; il n'y est pas contraint.

C'est la Doublure qui fait la différence. Tout le monde vend « une IA qui fait le
travail » ; personne ne la fait travailler à côté de l'équipe jusqu'à ce qu'elle
donne le même résultat, en le prouvant chaque semaine. Et c'est cohérent avec la
maison : le moteur d'estimation, déjà, préfère ne rien répondre plutôt que
répondre un chiffre que la donnée ne soutient pas.

#### L'empilement de valeur

| Élément | Base de calcul | Valeur |
|---|---|---|
| Le Chronomètre — demi-journée sur site + note de 8 pages | 1 jour de consultant à 1 400 € | 1 400 € |
| Construction de l'automatisme, connexion, jeux d'essai | 4 jours | 5 600 € |
| La Doublure — 30 jours d'exécution en parallèle, relevé d'écarts hebdomadaire, réglages | 2 jours étalés | 2 800 € |
| La Passation — documentation, accès, 2 h de prise en main | 1 jour | 1 400 € |
| **Prime 1 — Le classeur de l'agence** : les 13 matrices et les 10 outils en ligne, sans quota, pour toute l'équipe, 12 mois | 23 ressources à 55 €, prix courant d'un modèle financier métier chez un éditeur | 1 300 € |
| **Prime 2 — La demi-journée Contrôle** : le module 03 « faire produire, puis contrôler », 6 personnes | demi-journée d'animation | 1 400 € |
| **Prime 3 — Le registre des consignes** : les consignes vérifiées de votre automatisme et le protocole de relecture en 6 points | document produit pendant la construction | 700 € |
| **Total** | | **14 600 €** |

Prix de l'Atelier : **7 900 € HT**, payable en une fois ou en trois échéances de
2 800 € (8 400 €, soit 6,3 % de plus — c'est dit, ce n'est pas caché).

Ramené au ridicule : 7 900 € sur une première année, c'est **30 € par jour
ouvré** — moins qu'une heure de négociateur chargée.

#### Les primes

Elles sont désirables sans être indispensables au résultat, et elles coûtent peu
à produire :

- **Le classeur de l'agence.** La bibliothèque publique est plafonnée à deux
  ressources par semaine glissante. Le client de l'Atelier n'a plus de plafond,
  pour toute son équipe, pendant douze mois. *Le déplafonnement par organisation
  est à construire.*
- **La demi-journée Contrôle.** Elle sert directement l'objection n°1 du métier
  (« l'IA raconte n'importe quoi ») et elle se donne une fois pour six
  personnes. *Les supports sont à produire.*
- **Le registre des consignes.** Il sort de la construction ; il ne coûte que sa
  mise en forme, et sa valeur perçue est forte parce que c'est exactement ce que
  les prestataires refusent habituellement de donner.

#### L'inversion du risque — la garantie Chronomètre

> **Nous mesurons au premier jour, chronomètre en main, le temps que cette tâche
> coûte à votre équipe, et nous l'écrivons dans le compte rendu de cadrage.
> 90 jours après la mise en service, nous remesurons selon le même protocole. Si
> le temps passé sur cette tâche n'a pas baissé d'au moins 50 %, nous continuons
> à travailler sans facturer jusqu'à ce qu'il le soit. Si à 180 jours ce n'est
> toujours pas le cas, nous vous remboursons intégralement l'Atelier.**

Rédaction juridique, à porter au contrat et sur la page :

- **Nature.** Il s'agit d'une garantie commerciale. Elle **s'ajoute** aux
  garanties légales et ne s'y substitue pas.
- **Périmètre.** Elle porte sur la seule tâche mesurée au cadrage et nommée dans
  le compte rendu, selon le protocole de mesure signé par les deux parties.
- **Durée.** 180 jours à compter de la date de mise en service inscrite au
  procès-verbal.
- **Conditions à la charge du client**, sans lesquelles la garantie ne joue pas,
  et c'est écrit noir sur blanc : accès aux outils concernés fournis sous
  5 jours ouvrés ; un interlocuteur désigné, joignable, avec pouvoir de décision ;
  les deux mesures réalisées aux dates convenues ; aucune modification du
  processus concerné pendant la période de doublure sans nous en informer.
- **Procédure.** Une demande écrite à l'adresse de contact, sous 15 jours après
  la seconde mesure. Remboursement sous 30 jours par virement.

Elle fait peur. C'est le test : si elle ne fait pas peur, elle est trop faible.
Et un chiffre garde la tête froide — une garantie forte est actionnée dans moins
de 5 % des cas, et pour chaque profiteur, plusieurs clients disent oui alors
qu'ils auraient renoncé.

#### La justification du prix

Trois arguments, dans cet ordre.

1. **La comparaison au coût du problème.** Une tâche de qualification qui occupe
   45 minutes par jour et par personne, sur trois personnes, à 38 € de l'heure
   chargée, coûte environ **19 000 € par an**. L'Atelier coûte 7 900 € une fois.
   Le calcul se refait avec les chiffres du client au cadrage — c'est justement
   l'objet du Chronomètre.
2. **La comparaison au marché.** Une agence de développement facture entre
   1 200 et 1 800 € la journée. Douze jours de travail à ce tarif, c'est 14 400 à
   21 600 €. On facture 7 900 € parce qu'on ne repart pas de zéro : le moteur
   d'estimation, la normalisation DVF et les matrices sont déjà construits et
   déjà payés.
3. **La raison de la générosité, énoncée franchement.** Nous ouvrons cette offre
   maintenant, et nous la construisons avec les dix premiers clients. Nous
   voulons dix études de cas mesurées, pas dix références vagues. Cela vaut bien
   un prix inférieur à ce qu'il sera dans six mois. Le dire est plus solide que
   d'inventer une « offre de lancement » sans motif.

#### La raison d'agir maintenant

Deux raretés, toutes les deux vraies. Aucune fausse urgence, aucun compte à
rebours qui se réinitialise.

- **La capacité.** La Doublure demande une présence hebdomadaire réelle pendant
  30 jours. Nous ne lançons que **deux Ateliers par mois**. Quand les deux
  créneaux du mois sont pris, la date proposée est celle du mois suivant, et on
  le dit.
- **Le prix des dix premiers.** Le tarif de 7 900 € est celui des dix premiers
  Ateliers. À partir du onzième, il passe à 9 900 €. Le compteur est affiché sur
  la page et il ne redescend jamais.

### 6.2 L'offre leads vendeurs — version courte

- **Promesse.** « Les cinq premières demandes de votre commune sont offertes.
  Vous ne payez qu'à partir de la sixième, et seulement celles que vous pouvez
  joindre. »
- **Mécanisme nommé — la Filière consentie.** Le propriétaire estime, il coche
  une case distincte et jamais pré-cochée, le serveur horodate, le score se
  calcule sur cinq critères et le détail vous est montré, pas seulement la note.
  Aucune base achetée n'entre dans ce circuit.
- **Valeur.** Une demande exclusive coûte 140 € HT. Pour la mettre en regard, un
  calcul à refaire avec les chiffres du client : sur un prix médian de 250 000 €
  et 5 % d'honoraires, la commission est de l'ordre de 10 400 € HT ; à 10 % de
  transformation demande → mandat et 65 % de mandat → vente, l'espérance est de
  676 € par demande exclusive. Ce sont des hypothèses de travail, pas une
  promesse : on les recalcule avec ses propres taux au cadrage.
- **Primes.** Le classeur de l'agence pendant l'engagement ; le modèle « net
  vendeur, honoraires et qualification du mandat », déjà en ligne, pour tenir la
  conversation d'honoraires dès le premier rendez-vous.
- **Garantie — « le lead ou le crédit ».** Toute demande injoignable après trois
  tentatives sur cinq jours ouvrés, ou hors du secteur souscrit, est recréditée
  sous 10 jours ouvrés, sans discussion et sans justificatif. Garantie
  commerciale, s'ajoutant aux garanties légales.
- **Rareté.** Elle est structurelle et honnête : le volume d'un secteur est ce
  qu'il est. L'exclusivité d'une commune se donne à un seul professionnel ; quand
  elle est prise, elle est prise. Nous ne gonflons jamais un volume annoncé.
- **Raison d'agir.** Le secteur exclusif est attribué au premier qui le prend, et
  l'antériorité compte : les cinq demandes offertes ne se donnent qu'une fois par
  agence.

---

## 7. La grille tarifaire

Trois niveaux, jamais présentés en même temps sur la page : le Chronomètre est
l'entrée visible, l'Atelier est ce qu'on recommande, la Doublure existe pour
faire paraître l'Atelier raisonnable.

### Niveau 1 — **Le Chronomètre** — 890 € HT

*Ce qui est inclus :* une demi-journée sur site, chronomètre en main ; une note
de 6 à 8 pages listant les deux ou trois tâches automatisables, le temps qu'elles
coûtent en heures et en euros, et la faisabilité technique outil par outil ; le
protocole de mesure, signé, qui servira de référence à la garantie.

*Pour qui :* le dirigeant qui veut savoir avant d'engager, et celui dont on n'est
pas sûr qu'on puisse l'aider.

*Son rôle :* **le produit d'appel**. Il est intégralement déduit de l'Atelier si
la décision tombe dans les 30 jours — donc il ne coûte rien à celui qui continue,
et il filtre celui qui ne continuera pas. Il fait aussi payer la qualification au
lieu de la subir, ce qui trie les curieux sans les vexer. Vendu à perte assumée :
890 € pour une journée de travail réelle.

### Niveau 2 — **L'Atelier** — 7 900 € HT

*Ce qui est inclus :* le Chronomètre, la construction d'un automatisme, la
Doublure de 30 jours, la Passation complète, et les trois primes (le classeur de
l'agence, la demi-journée Contrôle, le registre des consignes). Valeur empilée
14 600 €. Paiement en une fois, ou trois échéances de 2 800 €.

*Pour qui :* l'agence de 3 à 15 collaborateurs, mono-site ou deux points de
vente, qui a une tâche répétitive identifiable et un interlocuteur capable de
décider.

*Son rôle :* **c'est le niveau que tout le monde doit prendre.** Toute la page,
toute la séquence et tout l'appel convergent vers celui-ci. Les deux autres
existent pour lui.

### Niveau 3 — **La Doublure annuelle** — 2 400 € HT par mois, 12 mois

*Ce qui est inclus :* trois automatismes la première année, la maintenance et la
surveillance des trois, les quatre modules de formation pour l'équipe, et deux
jours de développement par trimestre à affecter librement. Valeur empilée à
45 300 € (trois Ateliers à 7 900 €, la maintenance à 4 800 €, la formation
complète à 5 600 €, huit jours de développement à 11 200 €) pour 28 800 €.

*Pour qui :* le réseau, le multi-agences au-delà de 15 collaborateurs, la
foncière, l'administrateur de biens.

*Son rôle :* **l'ancrage.** Face à 28 800 € par an, 7 900 € une fois cesse
d'être une dépense et devient un essai. C'est aussi le seul niveau qui absorbe un
client dont les besoins dépassent l'Atelier — et il vaut mieux avoir une case
pour lui que de gonfler l'Atelier jusqu'à le rendre irréalisable.

### Leads vendeurs — grille séparée

| Formule | Prix | Ce qui est inclus | Pour qui |
|---|---|---|---|
| Mutualisé | 45 € HT la demande | trois destinataires au maximum, annoncé au propriétaire ; même score, même détail, même consentement | tester un secteur avant de l'exclusiviser |
| Exclusif | 140 € HT la demande, plafond mensuel fixé au cadrage | seul destinataire sur le secteur, engagement au trimestre, sortie sans motif | l'agence qui tient déjà son secteur et veut le verrouiller |

Les cinq premières demandes sont offertes dans les deux formules, une seule fois
par agence.

### Une règle de façade

On n'affiche jamais les trois niveaux côte à côte sur la page de vente. Chaque
option supplémentaire visible coûte une décision. La page vend l'Atelier ; le
Chronomètre apparaît comme la porte d'entrée ; la Doublure ne se mentionne qu'à
l'appel, et seulement quand le diagnostic la justifie.

---

## 8. Le tunnel

### Vue d'ensemble

```
TRAFIC PAYANT + SEO   →   FICHE RESSOURCE   →   AIMANT LIVRÉ   →   SÉQUENCE
vend le clic              vend l'adresse        crée la dette      fait baisser
                                                                   le scepticisme
        →   PAGE /solutions   →   RENDEZ-VOUS   →   APPEL
            vend le rendez-vous    confirme          fait la vente
```

Chaque élément a **un seul job**. La publicité ne vend pas l'Atelier. La fiche
ressource ne vend pas le rendez-vous. La page `/solutions` ne vend pas
l'automatisme — elle vend le diagnostic.

### Étape 1 — Le trafic

| Canal | Température | Destination | Ce qu'on mesure |
|---|---|---|---|
| Google Ads — recherche métier (« automatiser agence immobilière », « leads vendeurs immobilier », « avis de valeur automatisé ») | tiède, il cherche | la fiche ressource correspondante | CPC, taux de clic, taux de capture par mot-clé |
| Meta — audience dirigeants d'agence, format article | froid | la fiche ressource | CPM, coût par clic sortant, taux de capture |
| SEO — les 13 fiches ressources indexables, déjà en ligne | froid à tiède | la fiche elle-même | positions, clics, taux de capture |
| Google Ads — recherche grand public (« estimation immobilière [ville] ») | chaud | `/estimer` | coût par estimation complétée, taux de coche « contact professionnel » |

Deux tunnels distincts partagent le même site : le tunnel professionnel part des
ressources, le tunnel propriétaire part de l'estimateur. Ils ne se mélangent
jamais dans une campagne.

**Ce qu'on n'envoie jamais** : du trafic payant vers `/carte` ou
`/observatoire`. Ce sont des preuves qu'on montre en chemin, pas des points
d'atterrissage — elles ne capturent rien, par décision d'architecture.

**Le job de l'annonce** : vendre le clic. Rien d'autre. Sur les huit annonces
concurrentes d'une requête métier, sept parlent de « solution digitale pour
professionnels de l'immobilier ». On dit autre chose : un chiffre, une réserve,
une intrigue.

### Étape 2 — La page de capture

Aujourd'hui, la capture se fait sur `/ressources/[slug]` : une landing publique
indexable, un formulaire à **un seul champ** — l'adresse e-mail — et une case de
consentement non pré-cochée. C'est déjà mieux que la règle (prénom + e-mail).

*Ce que voit le prospect* : le titre de la ressource, la description de ce
qu'elle fait, un aperçu visuel du fichier, et le compteur de quota affiché
**avant** le premier clic.

*Ce qu'on lui demande* : son adresse, et son accord.

*Ce qu'on mesure* : le taux de capture de la fiche, ressource par ressource.

**Deux corrections nécessaires.**

1. **Pour le trafic payant, il faut une page sans issue latérale.** La fiche
   ressource porte le menu, les filtres, les liens croisés et le bandeau d'offre :
   c'est un choix SEO assumé et il ne doit pas changer. Mais une page de capture
   qui a six sorties n'est plus une page de capture. À construire : une variante
   `/r/[slug]`, en `noindex`, sans menu, sans pied de page, réservée aux
   campagnes — même contenu, même formulaire, aucune sortie sauf le formulaire.
2. **L'adresse doit être enregistrée.** Aujourd'hui elle ne l'est nulle part :
   elle ne sert qu'à poser un cookie signé pendant la visite, et la page le dit
   honnêtement. Tant que ce n'est pas branché, **le tunnel fuit à 100 %** et rien
   de ce qui suit n'existe. C'est la correction n°1 du document.

### Étape 3 — Le contenu à haute valeur

L'aimant retenu est traité en §4. Ce qui relève de cette section, c'est sa
mécanique :

- il est livré **immédiatement**, dans la seconde qui suit l'accord, par e-mail
  et par un lien qui reste actif sur le navigateur ;
- il donne un résultat réel, pas un dépliant. Le réflexe visé est : « s'ils
  donnent ça gratuitement, à quoi ressemble ce qu'ils vendent ? » ;
- le premier e-mail annonce déjà le suivant.

*Ce qu'on mesure* : taux de livraison, taux d'ouverture du premier e-mail, taux
de téléchargement effectif.

### Étape 4 — La séquence

Détaillée en §9. Son job unique : faire baisser le scepticisme et faire monter la
confiance, en donnant quatre résultats réels avant toute vente. Proportion tenue
dans chaque message : 80 % de valeur, 20 % d'invitation, et l'invitation toujours
à la fin.

*Ce qu'on mesure* : ouverture et clic par e-mail, désabonnement par e-mail,
réponses reçues (une réponse est le meilleur signal de délivrabilité qui existe),
et le taux de prise de rendez-vous cumulé sur la séquence.

### Étape 5 — La page `/solutions`, en 17 étapes

C'est la page qui vend le rendez-vous. Voici son plan, ligne par ligne.

| # | Étape | Ce qui est écrit sur `/solutions` |
|---|---|---|
| 1 | Interpeller l'audience | « Dirigeants d'agence immobilière : » |
| 2 | La grande promesse | « La tâche qui vous coûte le plus de temps chaque semaine, divisée par deux en 90 jours. » |
| 3 | Étayer en sous-titre | « Mesurée au chronomètre le premier jour. Remesurée au chronomètre le 90e. Si elle n'a pas baissé de moitié, nous continuons sans facturer. » |
| 4 | L'intrigue — 6 bullets gardés sur 20 écrits | • Pourquoi l'automatisme que nous installons travaille 30 jours **à côté** de votre équipe avant de travailler à sa place • Le calcul en trois lignes qui dit ce qu'une tâche de saisie coûte réellement à votre agence sur une année • Les trois tâches qu'aucune agence ne devrait confier à une machine, quoi qu'on vous vende • Ce qu'il faut demander à un prestataire IA avant de signer, et la réponse qui doit vous faire raccrocher • Pourquoi nous refusons d'automatiser une décision commerciale, même quand le client le demande • Ce que devient votre automatisme le jour où vous arrêtez de nous payer |
| 5 | Braquer le projecteur sur le problème et l'agiter | La ressaisie d'un formulaire dans le CRM. L'estimation de mars restée sans suite que personne n'a relancée. Le reporting du 5 du mois qui prend une journée. Ce qui a déjà été essayé : un CRM de plus, un stagiaire, un abonnement à un outil que personne n'ouvre. |
| 6 | La solution et pourquoi c'est la meilleure option | La méthode Sur Pièces — Chronomètre, Doublure, Passation. On ne remplace rien avant d'avoir prouvé, deux relevés à l'appui, que le résultat est le même. |
| 7 | Les références | L'estimateur public, la carte DVF plein écran, le moteur documenté ligne à ligne, les 13 matrices et les 10 outils en ligne. **Nos références sont nos outils, pas encore nos clients — et c'est écrit ainsi.** |
| 8 | Détailler les bénéfices | Deux colonnes : le fait à gauche, ce que ça change à droite. « Doublure de 30 jours » → « vous ne pariez pas votre production sur une promesse ». « Passation documentée » → « vous n'êtes pas prisonnier de nous ». |
| 9 | Preuve sociale | **Il n'y en a pas encore. On n'en invente pas.** À la place : la mesure interne, publiée avec son protocole, du temps que nos propres automatismes nous font gagner. Remplacée par les trois premiers cas clients dès qu'ils existent. |
| 10 | L'offre | L'Atelier, décrit en cinq lignes. |
| 11 | Les bonus | Le classeur de l'agence, la demi-journée Contrôle, le registre des consignes. |
| 12 | Empiler et chiffrer la valeur | Le tableau de §6 : 14 600 €. |
| 13 | Révéler le prix et l'expliquer | 7 900 € HT, ou trois fois 2 800 €. Les trois arguments de justification, dans l'ordre. |
| 14 | La rareté | Deux Ateliers par mois. Prix des dix premiers, compteur affiché. |
| 15 | La garantie | La garantie Chronomètre, en encadré, avec son périmètre, sa durée, ses conditions et sa procédure. |
| 16 | Un appel à l'action unique, à l'impératif | **« Réservez votre diagnostic Sur Pièces »** — et rien d'autre de cliquable dans cet écran. |
| 17 | Le P.S. | « P.S. Rappel : la tâche mesurée divisée par deux en 90 jours, ou nous continuons sans facturer. Chaque mois sans rien changer, la même tâche recoûte le même prix — et personne ne l'a jamais chiffré chez vous. Nous ouvrons deux Ateliers par mois ; le prochain démarrage est le 6 octobre. Réservez votre diagnostic. » |

**À supprimer de la page** : le badge « Bientôt disponible ». Une page dont le
seul job est de vendre un rendez-vous ne peut pas annoncer qu'elle n'est pas
disponible. Soit l'offre est ouverte, soit la page ne doit pas recevoir de
trafic.

### Étape 6 — La prise de rendez-vous

*Ce que voit le prospect* : un agenda avec des créneaux réels, puis cinq
questions obligatoires. Aujourd'hui c'est un lien `mailto:` — un choix honnête
tant que rien n'est branché, mais qui coûte la moitié des rendez-vous. **À
construire : l'agenda et le questionnaire.**

*Ce qu'on lui demande* — les cinq questions de pré-cadrage, pas une de plus :

1. Quelle est la tâche qui vous coûte le plus de temps chaque semaine ?
2. Combien de personnes la font, et combien de temps par jour, à votre estimation ?
3. Qu'avez-vous déjà essayé pour la régler ?
4. Quels outils utilisez-vous — CRM, logiciel de transaction, messagerie ?
5. Qu'est-ce qui vous a décidé à prendre ce créneau maintenant ?

Ce questionnaire fait trois choses : il dit si on peut aider, il donne la matière
de l'appel, et il inverse la psychologie — c'est le prospect qui a franchi des
étapes pour nous parler. Il n'y a donc jamais d'appel à froid.

*Ce qu'on mesure* : taux de prise de rendez-vous depuis la séquence, taux de
complétion du questionnaire, taux de présence effective.

### Étape 7 — L'appel

Détaillé en §10. Son job unique : faire la vente. Durée 45 minutes, nommé et
chiffré comme s'il était payant :

> **Le diagnostic Sur Pièces — 45 minutes (valeur 450 €)**
>
> Pendant cet appel, vous découvrirez :
> - ce que coûte réellement, en euros et sur douze mois, la tâche que vous
>   m'aurez décrite ;
> - laquelle de vos tâches ne doit surtout pas être automatisée, et pourquoi ;
> - ce que les ventes réellement enregistrées de votre secteur disent de votre
>   marché, sur la carte, en direct pendant l'appel ;
> - le calcul de votre net vendeur et de vos honoraires sur un bien que vous avez
>   en portefeuille, fait devant vous.
>
> Vous repartez avec le chiffrage écrit de cette tâche, que vous décidiez ou non
> de travailler avec nous.
>
> **[ Réservez votre diagnostic Sur Pièces ]**
>
> Nous ouvrons deux Ateliers par mois.

*Ce qu'on mesure* : taux de signature, panier moyen, motif de refus classé, et
l'étape du script où ça a bloqué.

---

## 9. La séquence e-mail « lanterne magique »

### Le chemin

```
[Aujourd'hui : son équipe passe ses journées à ressaisir, et personne
 n'a jamais chiffré ce que ça coûte]
   ──①── mesurer ──②── trier ──③── faire produire ──④── contrôler ──>
[État désiré : ses négociateurs sont en rendez-vous, pas devant un
 tableur, et il sait exactement ce que la machine fait et ne fait pas]
```

Quatre jalons, jamais un seul bond. Chaque contenu donne un **résultat que le
lecteur peut constater le jour même**.

### Les règles tenues sur toute la séquence

- Expéditeur : un prénom, jamais une marque, jamais `contact@`.
- Texte brut. Aucun logo en en-tête, aucun bouton dessiné, aucune mise en page.
  Le logo va dans la signature, s'il y va.
- Objets en minuscules, sans ponctuation superflue, **jamais entre 41 et 50
  caractères** — c'est la zone morte de la moyenne. Soit très court, soit
  franchement long.
- Le pré-en-tête ouvre une boucle ; le corps la referme toujours. Une boucle
  laissée ouverte, et on n'est plus jamais ouvert.
- Un seul appel à l'action par message, à l'impératif.
- 80 % de valeur, 20 % d'invitation, toujours en fin de message.
- Chaque e-mail annonce le suivant.
- Deux tiers de contenu, un tiers d'offre sur l'ensemble de la séquence.

### Conformité RGPD, à poser avant le premier envoi

- **Consentement.** Le libellé actuel de la case du formulaire de ressource dit :
  « J'accepte de recevoir cette ressource à cette adresse […] pour vous envoyer
  le fichier et, plus tard, ses mises à jour. » Ce libellé **ne couvre pas** une
  séquence de prospection. Il doit être réécrit avant le premier envoi :
  « J'accepte de recevoir cette ressource, ses mises à jour, et une suite de
  quatre e-mails de méthode sur le même sujet. Désinscription en un clic dans
  chaque message. » On annonce la finalité, on annonce le nombre, on annonce la
  sortie.
- **Base légale.** En B2B, la CNIL admet l'information préalable et le droit
  d'opposition dès la collecte lorsque le message est en rapport avec la
  fonction du destinataire. On reste néanmoins sur le **consentement explicite**,
  parce que le même formulaire reçoit aussi des adresses personnelles et parce
  qu'une preuve de consentement vaut mieux qu'un débat sur la qualification de
  l'adresse.
- **Désinscription en un clic**, dans chaque envoi, plus l'en-tête
  `List-Unsubscribe` et `List-Unsubscribe-Post` : c'est désormais exigé par les
  grands fournisseurs de messagerie et cela pèse directement sur la
  délivrabilité.
- **Durée de conservation** annoncée : 24 mois sans aucune interaction, puis
  suppression. Nettoyer les inactifs n'est pas seulement légal, c'est le
  meilleur levier de délivrabilité.
- **Aucune revente, aucun partage.** La liste de la bibliothèque et le circuit
  des leads vendeurs sont deux traitements distincts, avec deux consentements
  distincts. On ne fait jamais passer une adresse de l'un à l'autre.

### Le calendrier

| Jour | Objet (écrit tel quel) | Pré-en-tête | Angle | Appel à l'action |
|---|---|---|---|---|
| **J+0** | `c'est là` | « et une chose à faire avant de l'ouvrir » | Livraison. Le fichier, en un lien, plus une consigne d'usage en trois lignes. Annonce du J+2. | « Ouvrez le fichier et remplissez la première colonne. » |
| **J+2** | `chronomètre` | « j'ai compté 47 minutes sur une seule fiche, et je n'avais pas fini » | **Jalon 1 — mesurer.** Le protocole exact : trois tâches, une semaine, un relevé par jour, et le tableau de conversion heures → euros chargés. Résultat constatable : à la fin de la semaine, il connaît un chiffre qu'il n'avait jamais eu. | « Choisissez vos trois tâches ce soir et lancez le relevé demain matin. » |
| **J+5** | `la moitié de ce que fait votre équipe ne devrait jamais partir dans une machine` | « la ligne du milieu est celle qui coûte le plus cher » | **Jalon 2 — trier.** La grille valeur / risque en quatre cases, avec les trois tâches qu'on refuse d'automatiser chez un client et pourquoi. | « Placez vos trois tâches dans la grille avant jeudi. » |
| **J+8** | `deux minutes` | « voici la consigne exacte, vous n'avez qu'à changer les noms » | **Jalon 3 — faire produire.** Une consigne complète, copiable, qui produit une fiche de qualification à partir d'un formulaire brut. Résultat constatable : il tient un livrable réel en deux minutes. | « Copiez la consigne, faites-la tourner sur une vraie demande, et dites-moi ce qui manque. » |
| **J+12** | `personne ne relit` | « la troisième vérification est celle que tout le monde saute » | **Jalon 4 — contrôler.** Le protocole de relecture en six points, avec le cas réel d'un chiffre inventé de toutes pièces et la façon de l'attraper. | « Appliquez les six points à ce que vous avez produit lundi. » |
| **J+15** | `deux créneaux` | « je ne sais pas encore si je peux vous aider, c'est justement l'objet » | **L'invitation directe.** Ce qu'est le diagnostic Sur Pièces, ce qu'il contient, ce qu'on en repart avec, et le fait qu'on dit non quand c'est non. | « Réservez votre diagnostic. » |
| **J+22** | `l'agence qui a perdu un mandat parce qu'un tableur n'avait pas été mis à jour` | « la partie gênante arrive au troisième paragraphe » | **Histoire.** Un récit court et concret, la mécanique du problème, ce qu'il aurait fallu faire. Aucune vente dans le corps. | P.S. seulement : rappel de l'offre et du créneau. |
| **J+30** | `avant que j'oublie` | « c'est gratuit et ça restera gratuit, je préfère le dire » | **La preuve par les outils.** La carte DVF, l'estimateur, les 13 matrices : ce qu'on a construit, ouvert, sans compte. Invitation à casser l'outil avant de nous parler. | « Ouvrez la carte sur votre secteur. » |
| **J+45** | `dites-moi si je dois arrêter de vous écrire, je le prendrai très bien` | « une réponse d'un mot suffit » | **Le tri.** Il fait deux choses : il nettoie la liste, et il produit des réponses — le meilleur signal de délivrabilité qui existe. Ceux qui restent sont ceux qui achèteront. | « Répondez « stop » ou « continuez », un mot suffit. » |

Ensuite, rythme de croisière : un envoi par semaine, deux tiers de contenu, un
tiers d'offre, l'offre passant souvent par le P.S.

### Fenêtres d'envoi

Mardi 10 h en priorité, puis jeudi 20 h, puis mercredi 14 h. À retester sur la
liste réelle dès 500 adresses : ces moyennes ont tort jusqu'à preuve du
contraire.

### La question de contrôle avant chaque envoi

Cet e-mail atterrit-il dans la pile « personnel » ou meurt-il dans la pile
« commercial » ? S'il y a un logo en haut, un bouton au milieu et une mise en
page soignée, la réponse est connue.

---

## 10. Le script d'appel

Interlocuteur : dirigeant ou directeur d'agence immobilière, 3 à 15
collaborateurs. Durée 45 minutes. **Une ordonnance sans diagnostic est une faute
professionnelle** — on ne parle de l'offre qu'à la minute 30.

### Avant de décrocher

Relire les cinq réponses du questionnaire. Écrire une hypothèse de diagnostic sur
une feuille. Se tenir prêt à la jeter.

Ouvrir trois onglets : la carte DVF centrée sur sa commune, l'outil « net
vendeur, honoraires et qualification du mandat », l'outil « avis de valeur par
comparaison ». Ils serviront à l'étape 4.

### 1. Le pourquoi — 8 minutes

> « Bonjour [Prénom]. Dites-moi ce qui vous a motivé à prendre ce créneau
> aujourd'hui. »

**Puis se taire.** Laisser le silence travailler.

Si la réponse est molle (« je voulais juste voir ce que vous proposez »), creuser
dans cet ordre :

- Vous m'avez écrit « [sa tâche] ». Racontez-moi une journée où ça coince.
- Qui la fait, exactement ? Depuis combien de temps ?
- Vous avez essayé quoi jusqu'ici ? Pourquoi ça n'a pas tenu selon vous ?
- Pourquoi maintenant, et pas il y a six mois ?

**Ce qu'on cherche à lui faire dire :** un fait daté et nommé — « en mars on a
perdu un mandat parce que la relance n'est jamais partie », pas « on manque
d'organisation ». Tant qu'on n'a pas un fait, on n'a pas de diagnostic.

### 2. Où il veut aller — 5 minutes

> « [Prénom], si on refaisait cette conversation dans douze mois et que vous
> regardiez l'année écoulée — que devrait-il s'être passé pour que vous en soyez
> satisfait ? »

Relances : combien de mandats de plus ? combien de rendez-vous par négociateur
par semaine ? qu'est-ce que ça change à votre semaine à vous ?

**Ce qu'on cherche à lui faire dire :** un chiffre. N'importe lequel, mais un
chiffre. Sans chiffre, il n'y a rien à diviser par deux.

### 3. L'aveu — 5 minutes

- Pourquoi est-ce important de régler ça maintenant ?
- Sur une échelle de 1 à 10, à combien situez-vous l'urgence ?
- Que se passe-t-il si rien ne change d'ici six mois ?
- « Donc si je résume : ce que vous faites aujourd'hui ne vous donne pas ce que
  vous attendez, et il est temps de vous y prendre autrement. C'est bien ça ? »

**Ce qu'on cherche à lui faire dire :** la phrase « ce qu'on fait aujourd'hui ne
marche pas ». Elle doit sortir de sa bouche, pas de la nôtre.

**Si la note d'urgence est inférieure à 7 : on termine poliment et on ne vend
pas.** On propose de le rappeler dans trois mois et on le remet dans la séquence.
Ni l'offre ni le prix ne compensent l'absence de désir.

### 4. Donner la valeur promise — 15 minutes

C'est l'étape que tous les argumentaires ratent : on prouve qu'on peut aider **en
aidant, tout de suite**.

> « [Prénom], je peux clairement vous aider là-dessus. Vous voulez que je vous
> montre comment on s'y prendrait ? »

| Si le problème est… | On montre, en direct |
|---|---|
| la ressaisie des demandes entrantes | le calcul écrit devant lui : 45 min × 3 personnes × 220 jours × 38 € chargés = **19 000 € par an**. On lui envoie la ligne de calcul par écrit pendant l'appel. |
| les estimations sans suite | la carte DVF sur sa commune : ce qui s'est réellement vendu ces six derniers mois, et donc ce qu'il pourrait écrire dans une relance qui apporte une information neuve. |
| les honoraires discutés à chaque mandat | l'outil « net vendeur et honoraires » rempli avec un de ses biens, en direct. |
| la valorisation contestée par le vendeur | l'avis de valeur par comparaison, avec le journal qui dit **ce qui a été écarté et pourquoi** — c'est cette page-là qui fait taire « mon voisin a vendu plus cher ». |

Règle : le prospect doit raccrocher en meilleur état qu'il n'a décroché, qu'il
achète ou non.

### 5. L'engagement — 2 minutes

- Alors, qu'en avez-vous pensé ?
- C'est le type d'accompagnement que vous cherchez ?
- Vous voulez que je vous explique comment ça se passe concrètement ?

**Si ce n'est pas un bon client, le dire et ne pas vendre**, même s'il insiste :
pas de tâche répétitive identifiable, pas d'interlocuteur qui décide, outils
totalement fermés. Un mauvais client coûte plus qu'il ne rapporte, et la parole
se répand vite dans un secteur où tout le monde se connaît.

### 6. L'ordonnance — 2 minutes maximum

Première fois de l'appel où l'on parle de soi. Avec **ses** mots à lui.

> « D'après ce que vous m'avez dit, ce qui correspond, c'est l'Atelier. Parce que
> vous avez [ses mots : « trois personnes qui ressaisissent la même chose »] et
> que vous voulez [ses mots : « qu'elles soient en rendez-vous »].
>
> On commence par une demi-journée chez vous, chronomètre en main : on mesure ce
> que cette tâche coûte, et on l'écrit. On construit l'automatisme. Puis — et
> c'est le point important — il tourne **à côté** de votre équipe pendant
> 30 jours, pas à sa place : chaque semaine, on compare ce qu'il produit et ce
> qu'elle produit. Il ne prend la main que le jour où c'est identique. À la fin,
> vous récupérez tout : l'automatisme, la documentation, les accès. Même si vous
> nous mettez dehors le lendemain.
>
> Concrètement, dans 90 jours, vos trois personnes ne passent plus une heure par
> jour là-dessus. »

Finir sur l'état d'après, jamais sur le processus.

### 7. Conclure

Prise de température, dans cet ordre :

- « [Prénom], ce n'est pas pour tout le monde : il faut nous donner les accès
  sous cinq jours et désigner quelqu'un qui décide. Cela dit, pourquoi
  êtes-vous sérieux là-dessus maintenant ? »
- « Avant qu'on parle de l'investissement : des questions, des réserves que je
  n'aurais pas couvertes ? »
- « En dehors du budget, y a-t-il une raison de ne pas démarrer ? »
- « Selon vous, pourquoi seriez-vous un bon candidat pour cet Atelier ? »

La dernière retourne la table : c'est lui qui se vend.

**Annoncer le prix avec fierté, sans pause, en enchaînant dans la même phrase :**

> « C'est 7 900 €, avec la garantie : la tâche mesurée divisée par deux à
> 90 jours, sinon on continue sans facturer. Il y a normalement 890 € de
> cadrage. J'ai remarqué que les gens qui décident vite sont toujours mes
> meilleurs clients — ils passent à l'action et les allers-retours me coûtent du
> temps. Donc si on cale la date aujourd'hui, je retire les 890 €. On y va ? »

**Puis se taire. Le premier qui parle a perdu.**

Signaux d'accord : « comment ça marche ? », « quelles sont les prochaines
étapes ? », « on peut payer comment ? » → « Parfait. Virement ou trois fois par
carte, vous préférez quoi ? »

### Les quatre objections les plus probables

**1. « J'ai déjà acheté des leads vendeurs, ça ne vaut rien. »**

> « Vous avez raison de commencer par là, et je vais vous dire ce qui cloche dans
> ce que vous avez acheté : personne ne vous a montré d'où venait le contact.
> Chez nous, chaque demande vient d'un propriétaire qui a mené une estimation
> jusqu'au bout sur notre site et qui a coché une case distincte, jamais
> pré-cochée, avec un horodatage serveur. Vous voyez le détail du score, pas
> seulement la note : intention déclarée, complétude, valeur, fraîcheur. Et si
> vous ne le joignez pas après trois tentatives en cinq jours, il vous est
> recrédité. Commencez par les cinq demandes offertes de votre commune : si elles
> ressemblent à ce que vous avez déjà acheté, vous n'aurez rien perdu et vous me
> le direz. »

**2. « L'IA raconte n'importe quoi. Je ne signe pas un avis de valeur produit par
une machine. »**

> « Moi non plus, et c'est exactement pour ça que nous ne vous vendons pas un
> avis de valeur signé par une machine. Notre propre moteur d'estimation refuse
> de répondre quand il a moins de cinq ventes comparables : il préfère se taire
> plutôt que d'inventer un chiffre. Et ce que nous automatisons chez vous, c'est
> la préparation, jamais la décision : un score se lit, il ne signe pas de
> mandat. La demi-journée Contrôle qui est incluse ne sert qu'à ça — apprendre à
> attraper ce qu'une machine invente. Le protocole tient en six points, je peux
> vous l'envoyer maintenant. »

**3. « On a déjà un CRM » / « le réseau nous impose ses outils. »**

> « Tant mieux, on ne le remplace pas. On se branche dessus, ou on le laisse
> tranquille. Ce que nous vous prenons, ce n'est pas le CRM : c'est la
> vingt-cinquième minute passée à recopier un formulaire dedans. Maintenant, il y
> a un cas où je vous dirai non : si l'éditeur ne donne aucun accès technique. On
> le vérifie à la demi-journée de cadrage — et si c'est fermé, je vous le dis à
> ce moment-là, pas après avoir encaissé. »

**4. « C'est cher » / « je vais réfléchir. »**

> « Cher par rapport à quoi ? C'est la seule question qui compte, et on a le
> chiffre : vous m'avez dit trois personnes, environ 45 minutes par jour. Ça fait
> 19 000 € par an, tous les ans, que vous décidiez ou non. L'Atelier, c'est
> 7 900 € une fois, ou trois fois 2 800 €, soit 30 € par jour ouvré sur la
> première année — moins d'une heure de négociateur. Et si dans 90 jours le
> chronomètre ne descend pas de moitié, je continue sans facturer.
>
> Cela dit, si vous voulez réfléchir, réfléchissez. Dites-moi juste sur quoi
> exactement, qu'on regarde ça maintenant plutôt que dans trois semaines. »

Si la réserve porte réellement sur la trésorerie : proposer le Chronomètre à
890 €, déduit intégralement s'il enchaîne sous 30 jours. On ne baisse jamais le
prix de l'Atelier ; on réduit le pas.

### Après l'appel

Une ligne dans la fiche de progression : date, prospect, note d'urgence sur 10,
étape où ça a bloqué, ce qu'on change au script. Un script se muscle appel après
appel ; celui de ce mois-ci ne doit pas être celui du mois prochain.

---

## 11. Les métriques et le budget

### Ce qu'il faut connaître avant de dépenser un euro

Savoir ce que rapporte un client, c'est savoir combien on peut payer pour en
obtenir un. Tant que ces quatre chiffres ne sont pas posés, toute publicité est
un pari.

### Solutions IA — les cibles

| Indicateur | Cible | Plafond acceptable | Justification |
|---|---|---|---|
| Coût par clic | 2,20 € | 3,50 € | requêtes métier B2B peu concurrentielles sur Google ; 0,60 à 1,20 € attendus sur Meta |
| Taux de capture de la page | 22 % | plancher 15 % | une page de contenu à haute valeur bien faite tourne à 25 % ; on part prudent, la fiche ressource porte encore un menu |
| **CPL** | **10 €** | **18 €** | 2,20 € de clic ÷ 22 % de capture |
| Lead → rendez-vous réservé | 3 % | plancher 1,8 % | séquence de 9 e-mails sur trafic tiède ; 4 % visé à six mois, une fois la séquence rodée |
| Rendez-vous honoré | 80 % | plancher 65 % | questionnaire obligatoire + rappel la veille |
| Rendez-vous → client | 30 % | plancher 20 % | vente de 7 900 € après diagnostic ; en dessous de 20 %, le problème est l'offre ou le script, pas le trafic |
| Lead → client | 0,72 % | — | 3 % × 80 % × 30 % |
| **CPA** | **1 400 €** | **2 200 €** | 10 € de CPL × 139 leads par client |
| Panier moyen | 7 900 € HT | — | l'Atelier |
| **LTV (marge)** | **6 500 €** | — | 11 000 € de chiffre d'affaires moyen sur 24 mois — 40 % des clients prennent un second Atelier ou passent en Doublure — à 60 % de marge brute |
| **EPC** | **12 €** | plancher 3 € | 220 leads pour 1 000 clics → 1,58 client → 12 500 € de chiffre d'affaires |

**La conséquence de la LTV** : le plafond théorique d'acquisition est de 6 499 €
par client. On vise 1 400 €, soit **21 % de la marge**. Cela veut dire qu'un clic
à 3,50 € reste rentable là où un concurrent qui regarde son coût par clic à 1 €
trouvera « Google trop cher » et abandonnera un canal qui marche. C'est
exactement l'avantage qu'on achète en tenant ces chiffres.

### Leads vendeurs — les cibles

| Indicateur | Cible | Justification |
|---|---|---|
| Coût par clic, requêtes « estimation immobilière [ville] » | 1,60 € | requête grand public disputée par les portails |
| Taux de complétion du parcours d'estimation (6 étapes) | 14 % | plancher 9 % ; en dessous, le problème est le parcours, pas le trafic |
| Coût par estimation complétée | 11,40 € | 1,60 € ÷ 14 % |
| Taux de coche « contact professionnel » | 32 % | à mesurer réellement dès les 200 premières estimations — c'est la variable la plus incertaine du modèle |
| **Coût par demande consentie** | **36 €** | plafond 60 € ; au-delà, on coupe le payant sur ce secteur et on ne garde que l'organique |
| Revenu par demande | 135 € en mutualisé (3 × 45 €), 140 € en exclusif | |
| Marge par demande | ~100 € | |

**Le seul chiffre qui peut tout casser** : le taux de coche du consentement
professionnel. Il n'a jamais été mesuré. S'il tombe à 12 %, le coût par demande
consentie passe à 95 € et le modèle payant n'est plus rentable — seul l'organique
le reste. C'est le premier chiffre à instrumenter, avant toute campagne.

### Le budget de départ

**7 500 € sur 90 jours**, soit 2 500 € par mois. Répartition initiale : 60 % en
recherche Google, 40 % sur Meta. Un seul canal monté d'abord jusqu'à la
rentabilité, le second alimenté ensuite par les profits du premier — jamais les
deux poussés en même temps.

Ce budget n'est pas une enveloppe à consommer. C'est un **droit d'entrée pour
acheter de l'information** : quel mot-clé produit un rendez-vous, quel aimant
produit une adresse à moins de 12 €.

### La règle d'arbitrage

> On ne devrait avoir un budget marketing que si le marketing ne fonctionne pas.
> Le jour où 1 € investi en rend 3, la seule limite est la trésorerie.

Traduit en règles opérables :

**On augmente quand :**
- un canal tient un retour d'au moins 50 % sur 30 jours glissants,
- **et** qu'il a produit au moins 20 conversions **mesurées jusqu'à la vente**,
  pas jusqu'au clic,
- alors on monte le budget de **20 % par semaine**, jamais plus — au-delà,
  l'algorithme de diffusion réapprend et le coût par acquisition décroche,
- et on continue tant que le CPA reste sous 2 200 €.

**On coupe quand :**
- *au niveau de l'annonce* : 300 clics sans atteindre 10 % de capture → on coupe le
  groupe d'annonces, pas le canal ;
- *au niveau du canal* : 60 jours et 4 000 € dépensés avec un CPA supérieur à
  4 400 € (deux fois le plafond) → on coupe le canal ; on ne « laisse pas mûrir » ;
- *au niveau de l'offre* : moins de 15 % de signatures sur 20 rendez-vous → **on
  coupe le budget publicitaire et on répare l'offre**. Une offre forte survit à
  un texte moyen ; un texte brillant ne sauve jamais une offre faible. Payer du
  trafic pour l'envoyer sur une offre qui ne convertit pas, c'est financer sa
  propre erreur.

**On accepte que le retour baisse en montant en volume.** Un retour de 1 200 %
sur 100 € ne paie personne. Dépenser 1 000 € pour en gagner 6 000 vaut mieux que
dépenser 100 € pour en gagner 1 200, malgré un ratio inférieur. C'est le profit
absolu qui compte, pas le pourcentage.

**Objectif à 12 mois : trois canaux rentables** — recherche Google, Meta, et le
référencement naturel des fiches ressources. Un seul canal, c'est une entreprise
dont la survie dépend de la politique commerciale d'un tiers.

### Le tableau de bord, relevé chaque lundi

Dépense par canal · leads par canal → CPL · rendez-vous obtenus ÷ leads · clients
signés ÷ rendez-vous · CPA par canal · panier moyen et LTV · gain par clic ·
chiffre d'affaires total.

**Prérequis technique, à construire :** le suivi jusqu'à la vente. Aujourd'hui
aucun événement n'est instrumenté. Il faut au minimum quatre événements —
adresse capturée, rendez-vous réservé, rendez-vous honoré, contrat signé — chacun portant
la source, la campagne et le mot-clé d'origine. Sans cela, on optimise à l'aveugle
sur des mots-clés qui ne rapportent rien.

---

## 12. Audit express du site actuel

> **Note d'édition.** Cet audit porte sur le dépôt brouillon `mvpimmo`, dans son
> état au moment de la rédaction. Le présent dépôt en corrige déjà une partie
> par construction : le sélecteur de directions artistiques et ses 4 400 lignes
> de CSS ont disparu, la frontière Particulier / Professionnel n'existe plus,
> les modules coquilles (CRM, biens, contacts, documents) n'ont pas été repris,
> et aucun bouton ne mène à un écran absent. Les constats sur **l'offre**, sur
> **le suivi** et sur **la capture** restent entiers : c'est là que le travail
> commence.

Grille de 70 points appliquée à l'état du code au 1er septembre 2026 : page
d'accueil, `/solutions` et ses trois pages filles, `/ressources` et ses fiches.

### A. L'offre — 3 / 20

| # | Critère | Note | Constat |
|---|---|---|---|
| 1 | Il existe une offre, pas une déclaration | 0 | « Trois façons de travailler avec nous », « Trois étapes, et une porte de sortie à chacune ». Aucune offre : aucun prix, aucun délai, aucun engagement chiffré nulle part sur le site. |
| 2 | Elle est spécifique et chiffrée | 1 | Quelques repères réels — « une demi-journée », « moins d'une minute », « au-delà de 45 jours », « trois destinataires maximum ». Mais aucun euro, aucune échéance. |
| 3 | Elle répond à la douleur n°1 réelle | 1 | Le sujet est le bon (le temps perdu), mais rien n'indique qu'il vienne de verbatims. C'est une hypothèse bien formulée, pas une observation. |
| 4 | Le risque est renversé | 1 | Réel sur les leads (« une demande injoignable vous est recréditée, sans discussion »). Rien sur l'automatisation ni la formation. |
| 5 | La garantie porte sur un résultat | 0 | Le recrédit porte sur un défaut de livraison, pas sur un résultat. Aucune garantie nommée. |
| 6 | Raison crédible à la générosité | 0 | Sans objet : il n'y a pas de générosité à justifier. |
| 7 | La valeur est construite avant le prix | 0 | Aucun prix, donc aucune construction de valeur. « Le prix se cale sur le volume réel de votre secteur : nous le calculons au cadrage. » |
| 8 | Bonus désirables | 0 | Aucun. |
| 9 | Rareté vraie | 0 | Aucune. Pire : les trois pages Solutions portent le badge **« Bientôt disponible »**, qui est l'exact contraire d'une raison d'agir maintenant. |
| 10 | L'offre ferait peur au fondateur | 0 | Elle est parfaitement confortable. Elle n'engage à rien. |

### B. Le message — 9 / 16

| # | Critère | Note | Constat |
|---|---|---|---|
| 11 | Le titre promet un résultat | 1 | Inégal. « Recevez des vendeurs qualifiés de votre secteur » et « Deux minutes pour savoir où se situe votre bien » : oui. « Trois façons de travailler avec nous » : c'est une table des matières. |
| 12 | Chiffre ou spécificité | 1 | Présents dans le corps, absents des titres principaux. |
| 13 | Intrigue ou réserve qualifiante | 1 | Rare, mais réelle : « ou avec un « ce n'est pas pour nous » ». |
| 14 | Les « vous » l'emportent sur les « nous » | 1 | Le chapeau de `/solutions` enchaîne trois « nous » et zéro « vous ». Les pages filles sont mieux orientées. |
| 15 | Vocabulaire du client | 2 | Excellent, et c'est le point fort du site : net vendeur, charge foncière, WAULT, rent roll, comité d'engagement, carte T. Personne ne peut soupçonner que ce site a été écrit par quelqu'un qui ignore le métier. |
| 16 | Le problème est agité avant la solution | 0 | Jamais. Toutes les pages entrent directement par la solution. |
| 17 | Les bénéfices dominent les caractéristiques | 1 | Les cas d'usage sont présentés en entrée / traitement / sortie — une architecture, pas un bénéfice. Quelques exceptions réussies. |
| 18 | Le texte prend position | 2 | Remarquable. « Un score se lit, il ne signe pas de mandat. » « Nous ne facturons pas un abonnement pour maintenir un workflow que vous pourriez tenir vous-même. » « Cas réels, pas de démonstration de salon. » |

### C. La structure — 5 / 14

| # | Critère | Note | Constat |
|---|---|---|---|
| 19 | Un seul job par élément | 1 | La page d'accueil fait deux choses à la fois : un film de marque et un estimateur en six étapes dans le même bloc. |
| 20 | La publicité vend le clic | 0 | Sans objet : aucune campagne ne tourne. |
| 21 | Un chemin pour les 97 % | 0 | **Il n'y en a aucun.** Le formulaire de ressource ne conserve pas l'adresse ; la page l'écrit elle-même : « votre adresse n'est enregistrée nulle part ». |
| 22 | La page de capture ne demande que le minimum | 2 | Un seul champ, l'adresse. Mieux que la règle. Piège à robots hors flux, case jamais pré-cochée. |
| 23 | La page de capture n'a ni menu ni sortie latérale | 0 | La fiche ressource porte le menu complet, les filtres, les favoris et un bandeau d'offre. Choix SEO légitime, mais inutilisable comme page de campagne. |
| 24 | Un seul appel à l'action visible par écran | 0 | Deux boutons concurrents dans le bloc final de l'accueil (« Estimer mon bien » / « Explorer la carte »), deux dans chaque chapeau de `/solutions`, plusieurs sur une fiche ressource. |
| 25 | Les appels à l'action sont à l'impératif | 2 | Systématiquement : « Estimer mon bien », « Recevoir la ressource », « Voir les deux formules ». |

### D. La preuve — 4 / 10

| # | Critère | Note | Constat |
|---|---|---|---|
| 26 | Résultats chiffrés visibles | 0 | Aucun. Aucun client, donc aucun résultat — c'est un fait, pas un défaut d'écriture. |
| 27 | Cas clients nommés | 0 | Aucun. Ne rien inventer : la seule réponse correcte est de produire les premiers. |
| 28 | Preuve visuelle | 2 | Le point le plus fort du site. La carte DVF plein écran, l'estimateur qui tourne, les aperçus de matrices, le PDF, le journal de calcul qui dit ce qui a été écarté et pourquoi. La section « L'estimateur et la carte que vous venez d'utiliser, c'est nous » est exactement la bonne idée. |
| 29 | Objections anticipées dans le texte | 2 | Très bien fait : les quatre limites explicites de l'automatisation, les quatre engagements de la page leads, la mention constante « estimation, jamais expertise ». |
| 30 | Un P.S. de clôture | 0 | Aucun, sur aucune page. Le troisième élément le plus lu est absent partout. |

### E. Le suivi — 0 / 10

| # | Critère | Note | Constat |
|---|---|---|---|
| 31 | Les leads reçoivent une séquence | 0 | Il n'y a pas de liste. L'adresse sert à poser un cookie signé, puis disparaît. |
| 32 | La séquence donne un résultat avant de vendre | 0 | Sans objet. |
| 33 | E-mails en texte brut, expéditeur personnel | 0 | Le seul e-mail existant est le transactionnel « estimation prête », en HTML, expédié depuis une adresse de marque. |
| 34 | CPL et CPA connus | 0 | Aucune acquisition, aucun événement instrumenté. |
| 35 | Valeur vie client connue | 0 | Jamais calculée. |

### Score total : **21 / 70**

Lecture de la grille : *« moins de 25 — ce n'est pas une machine de vente, c'est
une brochure. Tout reprendre en commençant par l'offre. »*

Le diagnostic est net, et il n'est pas décourageant : **le produit est très
au-dessus de son marketing.** Les points forts (vocabulaire, preuve visuelle,
prise de position, honnêteté des données) sont précisément ceux qu'on ne peut pas
acheter ni sous-traiter. Ce qui manque — une offre, une capture qui capture, une
séquence — se construit en quelques semaines.

### Les 10 corrections, classées par rapport impact / effort

| # | Correction | Impact | Effort | Pourquoi ici |
|---|---|---|---|---|
| **1** | **Enregistrer l'adresse et le consentement au passage du formulaire de ressource** | maximal | faible — le dépôt de données et le modèle de consentement existent déjà pour les leads | Sans elle, tout le reste est théorique : 100 % du trafic acquis est perdu à la seconde même où il donne son adresse. |
| **2** | **Écrire l'offre et afficher le prix sur `/solutions`** | maximal | moyen — c'est de la rédaction, pas du développement | Une offre forte sauve un texte moyen ; un texte brillant ne sauve jamais une offre faible. Poste A de la grille : 3 sur 20. |
| **3** | **Retirer les badges « Bientôt disponible » des trois pages Solutions** | fort | dérisoire — une propriété dans `src/config/navigation.ts` | Une page de vente qui annonce son indisponibilité annule sa propre raison d'être. Soit l'offre est ouverte, soit la page ne reçoit pas de trafic. |
| **4** | **Réparer les trois liens morts vers `/ressources/workflow-*`** | moyen | dérisoire | Les pages Automatisation et Leads renvoient vers trois ressources qui n'existent pas dans le catalogue : trois 404 au moment précis où le lecteur veut la preuve. |
| **5** | **Un seul appel à l'action par écran** | fort | faible | Retirer le second bouton du bloc final de l'accueil et des chapeaux de `/solutions`. Deux appels concurrents produisent zéro conversion. |
| **6** | **Écrire et brancher la séquence de §9** | maximal | moyen — 9 e-mails à écrire, un routeur d'envoi à choisir | C'est là que se trouve la marge : 97 % des inscrits ne sont pas prêts le premier jour. |
| **7** | **Remplacer le `mailto:` par un agenda et le questionnaire en 5 questions** | fort | moyen | Un lien de courriel coûte la moitié des rendez-vous et prive l'appel de sa matière première. |
| **8** | **Ajouter la garantie nommée et un P.S. sur les quatre pages Solutions** | fort | faible | Deux postes à 0 dans la grille, réparables en une séance d'écriture. |
| **9** | **Créer la variante de capture `/r/[slug]`, sans menu, en `noindex`** | moyen | moyen | Rend le trafic payant utilisable sans toucher à la doctrine SEO des fiches publiques. |
| **10** | **Instrumenter les quatre événements de conversion jusqu'à la vente** | moyen aujourd'hui, maximal dès la première campagne | moyen | Sans suivi au-delà du clic, on optimisera sur des mots-clés qui ne rapportent rien. |

### Ce qu'il ne faut surtout pas toucher

- **L'honnêteté des données.** Jamais de faux prix, plancher de 5 mutations, le
  mot « estimation » et jamais « expertise », aucun repli silencieux quand la
  source est indisponible. C'est l'actif de réputation du projet ; il vaut plus
  que n'importe quel gain de conversion.
- **Le formulaire de capture à un seul champ**, sa case jamais pré-cochée et sa
  phrase de vérité. Il faut lui ajouter un enregistrement, pas des champs.
- **Les listes de limites** (« nous ne remplaçons pas votre CRM », « un score se
  lit, il ne signe pas de mandat »). Elles traitent les objections avant qu'elles
  ne surgissent, et elles font vendre.
- **La section « La preuve »** de `/solutions` et la gratuité totale de la carte
  et de l'observatoire. Le meilleur argumentaire du projet est un outil qui
  fonctionne et qu'on peut casser avant de parler à qui que ce soit.
- **Les trois consentements séparés du parcours d'estimation** et le refus par
  défaut côté serveur. C'est ce qui rend la revente de leads défendable ; il n'y
  a rien à y gagner en l'assouplissant, et tout à y perdre.
