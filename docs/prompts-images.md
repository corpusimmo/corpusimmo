# Catalogue de prompts d’images

Ce fichier ne contient pas d’images&nbsp;: il contient les **prompts** qui les
produisent, prêts à copier. Il existe pour une raison précise. Une plateforme
d’estimation qui se réclame des actes ne peut pas s’illustrer de photos de
banque d’images génériques&nbsp;: un salon de Miami sous une véranda californienne
détruit en une seconde la crédibilité de tout ce qui est écrit à côté.

Les prompts sont rédigés **en anglais** parce que les générateurs y répondent
mieux et suivent mieux les listes négatives. Les commentaires, eux, sont en
français&nbsp;: ils disent **pourquoi** l’image doit ressembler à ça.

---

## Mode d’emploi

Un prompt complet se compose toujours de trois parties, dans cet ordre&nbsp;:

```
[ SUJET ]  +  [ DIRECTION ARTISTIQUE COMMUNE ]  +  [ INTERDITS ]
```

Le sujet change à chaque image. Les deux autres blocs ne changent **jamais**&nbsp;:
c’est ce qui fait qu’une série de vingt images tient ensemble et se lit comme
une commande photographique, pas comme vingt essais.

Le sujet vient des sections 3 à 5 de ce document. Les blocs 2 et 3 sont
ci-dessous, une fois pour toutes.

---

## 1. La direction artistique commune

À coller à la suite de **chaque** sujet, sans rien y changer.

```
Photographic direction: real photograph, documentary architectural register,
shot in France. Late-afternoon raking sunlight, low sun, long soft shadows,
warm side light grazing the facades; no midday flatness, no blue hour.
Full-frame camera; 35 mm lens for context and atmosphere, f/4, ISO 200;
for pure architecture, a 24 mm shifted (tilt-shift perspective-control) frame
with strictly vertical verticals, taken slightly off-axis so the building is
read at an angle rather than flat-on. Deep but not clinical depth of field:
the subject sharp, the far background gently softened.
Palette: restrained and slightly desaturated, built around deep navy blues,
warm off-white limestone, greyed zinc, and bronze / ochre accents in the
metalwork and the light itself. Nothing candy-coloured, nothing teal-and-orange.
Fine natural film grain, honest dynamic range, contrast held back.
Composition: calm, level horizon, generous air above the subject, one clear
subject and nothing competing with it.
```

**Pourquoi ces choix.** La lumière rasante de fin de journée est la seule qui
donne du relief à une modénature de pierre, et c’est celle des visites de fin
d’après-midi. Le 24 mm décalé est l’outil réel du photographe d’architecture&nbsp;:
c’est lui qui redresse les verticales, et un immeuble aux verticales fuyantes se
lit comme une photo d’annonce, pas comme un document. Le décadrage évite la
symétrie frontale, qui est la signature du rendu 3D. La palette est bornée par
la marque&nbsp;: navy `#1B3349`, bronze `#8A6A2F`, papier chaud `#F6F5F2`. Une image
qui sort de ces trois familles jurera sur toutes les pages du site.

---

## 2. Les interdits

À coller à la fin de chaque prompt, dans le champ négatif quand le générateur en
propose un, à la suite du prompt sinon.

```
Negative / forbidden: no text, no lettering, no readable signage, no street
plates, no house numbers, no watermark, no logo, no brand name; no recognisable
faces, no portraits, no people in business suits, no handshake, no smiling
stock-photo people, no real-estate agent handing over keys; no American,
British, Asian or Middle-Eastern architecture, no external fire escapes, no
clapboard siding, no bay windows of the London type, no skyscraper skyline;
no smooth 3D render, no CGI, no architectural visualisation look, no
ray-traced perfection, no plastic surfaces; no HDR, no tone-mapping halos, no
clarity push, no oversaturated sky, no purple or orange sunset gradient, no
lens flare, no bokeh balls; no fisheye, no ultra-wide distortion, no leaning
verticals; no drone-cliché perfectly centred symmetry; no snow, no rain, no
fog; no clutter, no traffic cones, no bins, no parked bicycles in the
foreground.
```

**Pourquoi cette liste.** Les six premières interdictions règlent un problème
juridique (texte inventé, marque, visage). Les suivantes règlent un problème de
crédibilité&nbsp;: l’escalier de secours en façade et le bardage bois horizontal
sont les deux marqueurs qui font instantanément lire une image comme
nord-américaine. Le reste écarte les tics de génération, dont le pire est le
rendu 3D lisse&nbsp;: une image trop parfaite est reconnue comme fausse avant même
d’être regardée.

---

## 3. Les typologies d’actif

Dix prompts, un par typologie du produit. Chacun vise une image **française et
crédible**&nbsp;: la ville ou la région est précisée quand elle aide le générateur à
trouver la bonne architecture.

Pour chacun&nbsp;: le **format**, l’**usage** et une note de **recadrage**, parce
qu’une image sera presque toujours recadrée par le composant qui l’affiche.

### 3.1 Appartement ancien

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: carte de typologie, en-tête de fiche, illustration d’article.
Recadrage&nbsp;: prévoir 15&nbsp;% d’air en haut, le composant recadre en 16:9 sur
mobile.

```
A Haussmannian apartment building facade in a French city, Lyon 6e or Bordeaux
Chartrons, cut limestone ashlar, continuous wrought-iron balcony on the second
and fifth floors, tall double-casement windows with slim white frames, grey
zinc mansard roof, a plane tree just entering the frame on the left.
```

Note&nbsp;: demander explicitement le balcon filant au deuxième **et** au cinquième
étage. C’est la règle de composition haussmannienne réelle, et c’est ce détail
qui fait qu’un œil français reconnaît l’immeuble au lieu de le trouver
« européen ».

### 3.2 Appartement récent

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: carte de typologie, page d’estimation, pôle neuf.
Recadrage&nbsp;: garder le ciel, il fait respirer une façade contemporaine dense.

```
A recent French residential building, built in the 2010s, four to six storeys,
light rendered facade with large full-height glazed openings, recessed
aluminium-railed balconies with planted boxes, flat roof with a slight
setback on the top floor, low landscaped foreground with young birch trees,
outskirts of Nantes or Rennes.
```

Note&nbsp;: le balcon en loggia et le retrait du dernier niveau sont les deux
marqueurs du logement neuf français des dix dernières années. Sans eux,
l’image glisse vers le condominium anonyme.

### 3.3 Maison individuelle

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: carte de typologie, parcours d’estimation résidentiel.
Recadrage&nbsp;: cadrer de façon que la maison tienne dans le tiers central, pour
survivre à un recadrage carré.

```
A detached French suburban house from the 1970s, single storey over a
semi-buried garage, pale roughcast render, brown-red concrete roof tiles with
a shallow pitch, aluminium roller shutters, a low hedge and a concrete driveway,
a mature hydrangea by the entrance steps, residential street in the
Loire-Atlantique countryside outskirts.
```

Note&nbsp;: le pavillon des années 70 sur sous-sol, avec ses volets roulants et sa
tuile mécanique, est la maison française la plus vendue dans DVF. C’est elle
qu’il faut montrer, pas la villa d’architecte.

### 3.4 Immeuble de rapport

Format&nbsp;: 4:5 portrait, 1600 × 2000 px.
Usage&nbsp;: pôle investisseur, fiches d’outils de rendement.
Recadrage&nbsp;: le portrait est volontaire, un immeuble se regarde en hauteur.

```
A small French mixed-use tenement building, five storeys, faubourg architecture
of the late nineteenth century, brick and rendered facade, shop unit at street
level with a plain closed metal shutter, simple wrought-iron window guards,
slate roof with two dormers, narrow street in Saint-Étienne, Le Havre or
Roubaix, no cars in the foreground.
```

Note&nbsp;: demander le rideau métallique **fermé et lisse**. Un rideau ouvert
demanderait une enseigne, donc du texte, donc un interdit.

### 3.5 Terrain à bâtir

Format&nbsp;: 16:9 paysage, 2400 × 1350 px.
Usage&nbsp;: fiche outil bilan promoteur, pôle aménageur.
Recadrage&nbsp;: bandeau possible en 3:1 en coupant le ciel.

```
An empty building plot on the edge of a French village, freshly mown grass,
wooden boundary stakes with orange marker tape, a gravel access track, a low
stone wall on one side, mature detached houses visible in the background,
overhead electricity pole at the edge of the frame, gently rolling farmland
behind, Anjou or Gers countryside.
```

Note&nbsp;: les piquets de bornage et le coffret de raccordement sont ce qui
distingue un terrain **à bâtir** d’un pré. Le prompt doit les nommer, sinon on
obtient un paysage.

### 3.6 Bureaux

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: pôle immobilier d’entreprise, fiches d’outils tertiaires.
Recadrage&nbsp;: garder de l’air à droite pour poser un titre en surimpression.

```
A French office building from the early 2000s in a secondary business district,
six storeys, aluminium and glass curtain wall with horizontal ribbon glazing,
pale stone-clad base, a planted forecourt with clipped hedges and a bicycle
rack, a bus shelter at the edge of the frame, Euralille in Lille or
Part-Dieu in Lyon, early evening, a few lit floors.
```

Note&nbsp;: quelques plateaux allumés en fin de journée valent tous les
personnages du monde. C’est ce qui rend un immeuble tertiaire vivant sans
mettre un visage dans l’image.

### 3.7 Local commercial de pied d’immeuble

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: pôle commerce, fiches d’outils de bail commercial.
Recadrage&nbsp;: ne jamais recadrer serré, la relation au trottoir fait le sujet.

```
A ground-floor retail unit in a French provincial town centre, nineteenth
century building above, plain unbranded shopfront with a dark painted timber
frame and a plain fabric awning, large clean glazing reflecting the street
opposite, two stone steps and a worn threshold, cobbled pavement, planters,
the street receding out of focus, Angers or Poitiers town centre.
```

Note&nbsp;: « unbranded » et « plain awning » sont indispensables. Toute enseigne
génère du faux texte, et le faux texte est le premier signe d’une image
fabriquée.

### 3.8 Local d’activité

Format&nbsp;: 16:9 paysage, 2400 × 1350 px.
Usage&nbsp;: pôle immobilier d’entreprise, articles sur les zones d’activité.
Recadrage&nbsp;: bandeau 3:1 possible, la zone d’activité est horizontale par
nature.

```
A small French light-industrial unit in a peripheral business park, single
volume with a shallow mono-pitch roof, pale grey profiled metal cladding,
a closed roller shutter door, a glazed office corner with an aluminium
canopy, marked parking bays, low clipped shrubs, wide sky, flat landscape of
a Bourgogne or Centre-Val de Loire industrial estate.
```

Note&nbsp;: la zone d’activité française est **basse, large et vide**. Ne pas
demander d’activité humaine&nbsp;: un site désert en fin de journée est plus
crédible qu’un site animé.

### 3.9 Entrepôt logistique

Format&nbsp;: 21:9 bandeau, 2560 × 1100 px.
Usage&nbsp;: bandeau de section logistique, en-tête d’article.
Recadrage&nbsp;: conçu comme un bandeau, ne pas tenter le portrait.

```
A large French logistics warehouse on a motorway corridor, very long low
volume, pale grey and white profiled cladding with a dark plinth, a continuous
row of loading dock doors with concrete levellers and rubber bumpers, a wide
manoeuvring yard, trailer parking bays marked on the tarmac, a plain white
unmarked semi-trailer at one dock, flat agricultural plain behind, the A1 or
A7 logistics corridor.
```

Note&nbsp;: « unmarked semi-trailer » est un interdit déguisé. Une remorque porte
toujours une marque, et le générateur en inventera une si on ne l’en empêche
pas.

### 3.10 Parking

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: carte de typologie, articles sur le stationnement.
Recadrage&nbsp;: recadrage carré possible, la structure est répétitive.

```
The interior of a French concrete multi-storey car park, board-marked concrete
columns and beams, painted white bay lines and yellow kerbs, a long open side
opening letting warm late-afternoon light rake across the deck, two or three
ordinary European cars parked far away, a helical ramp visible at the end,
no people, no signage.
```

Note&nbsp;: le silo béton photographié en contre-jour est un sujet
photographiquement riche, et c’est le seul moyen de rendre un parking
présentable sans le rendre inquiétant.

---

## 4. Vues aériennes de villes françaises

Trois variantes, toutes pensées comme **bandeaux larges**. Une vue aérienne
sert de respiration entre deux blocs denses&nbsp;: elle doit donc être calme et
supporter un titre en surimpression.

### 4.1 Métropole dense

Format&nbsp;: 21:9 bandeau, 2560 × 1100 px.
Usage&nbsp;: bandeau d’accueil, en-tête d’observatoire.
Recadrage&nbsp;: prévoir que le tiers inférieur puisse être assombri pour porter du
texte blanc.

```
A high oblique aerial view of a dense French metropolitan city, continuous
Haussmannian and nineteenth-century blocks, grey zinc and slate roofs forming
a continuous silvery plain, inner courtyards visible, tree-lined boulevards
cutting through, a river with stone bridges in the middle distance, no
landmark monument in frame, late-afternoon low sun, long roof shadows, light
atmospheric haze on the horizon, Paris or Lyon.
```

Note&nbsp;: « no landmark monument » est délibéré. Une tour Eiffel dans l’image
fait basculer la page dans le registre touristique, et le produit n’est pas
touristique.

### 4.2 Ville moyenne

Format&nbsp;: 21:9 bandeau, 2560 × 1100 px.
Usage&nbsp;: bandeau de page d’observatoire, articles de marché local.
Recadrage&nbsp;: la ligne d’horizon doit rester dans le tiers supérieur.

```
A high oblique aerial view of a medium-sized French town of about eighty
thousand people, a compact historic core of terracotta and slate roofs, a
church spire, a market square, then post-war blocks and detached houses with
gardens spreading outward, a canal or a small river, farmland at the edge of
the frame, late-afternoon light, calm and ordinary, Angers, Chartres or
Valence.
```

Note&nbsp;: « calm and ordinary » compte autant que le reste. La ville moyenne est
le cœur du marché DVF, et elle doit être montrée sans exotisme.

### 4.3 Littoral

Format&nbsp;: 21:9 bandeau, 2560 × 1100 px.
Usage&nbsp;: bandeau de section résidence secondaire, articles littoral.
Recadrage&nbsp;: garder de la mer à droite, c’est la zone morte idéale pour un
titre.

```
A high oblique aerial view of a French Atlantic coastal town, white rendered
houses with pale terracotta roofs, a tidal harbour with moored sailing boats,
a stone jetty, oyster beds and salt marshes behind the town, low dunes and
pine woods along the shore, late-afternoon light, calm sea, Charente-Maritime
or southern Brittany.
```

Note&nbsp;: marais salants et parcs à huîtres sont les marqueurs qui distinguent
l’Atlantique français d’une côte méditerranéenne ou portugaise.

---

## 5. Visuels d’ambiance des pages clés

Ces images ne montrent pas un bien&nbsp;: elles installent le registre d’une page.
Elles doivent donc être **plus abstraites** et supporter d’être recouvertes.

### 5.1 Accueil

Format&nbsp;: 21:9 bandeau, 2560 × 1100 px.
Usage&nbsp;: bandeau de tête, sous le titre et la barre de recherche d’adresse.
Recadrage&nbsp;: le sujet doit vivre à droite, la moitié gauche reste disponible
pour le texte.

```
A quiet French urban street seen from a first-floor window in late afternoon,
a row of ordinary nineteenth-century town houses across the road, warm raking
light on the stone, deep calm shadows in the lower left of the frame, no
people, no cars in the foreground, the far end of the street softened by
distance.
```

Note&nbsp;: la vue depuis une fenêtre est le point de vue de quelqu’un qui
**observe** un marché, pas de quelqu’un qui vend un bien. C’est exactement la
posture du produit.

### 5.2 Estimation

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: illustration latérale du parcours, page d’explication de méthode.
Recadrage&nbsp;: le portrait 4:5 fonctionne aussi, l’objet est central.

```
A notary's desk photographed from above at a slight angle, matte off-white
paper documents stacked square, a folded cadastral plan showing plain
uncoloured parcel outlines, a brass ruler, a fountain pen laid parallel to the
edge of the desk, dark walnut surface, warm low side light, no readable text
on any document, no hands, shallow depth of field on the far edge.
```

Note&nbsp;: « no readable text on any document » est capital. Un plan cadastral
généré porte toujours des chiffres inventés, et une estimation illustrée par
des chiffres faux est une contradiction que personne ne pardonne.

### 5.3 Carte des ventes

Format&nbsp;: 21:9 bandeau, 2560 × 1100 px.
Usage&nbsp;: bandeau au-dessus de la carte plein écran, écran de chargement.
Recadrage&nbsp;: bandeau uniquement.

```
A near-vertical aerial view of a French residential neighbourhood, a mosaic of
individual plots with hedges, garages and gardens, a few streets crossing the
frame diagonally, cars parked along the kerb, long late-afternoon shadows
giving relief to every roof, no people visible, no landmark, flat even light
across the whole frame.
```

Note&nbsp;: la quasi-verticale est le seul angle qui fasse écho à une carte sans
imiter une carte. Les ombres longues sont ce qui empêche l’image d’être plate.

### 5.4 Observatoire

Format&nbsp;: 16:9 paysage, 2400 × 1350 px.
Usage&nbsp;: en-tête d’observatoire, vignette de partage.
Recadrage&nbsp;: prévoir un recadrage 2:1 pour les cartes sociales.

```
A wide view over the rooftops of a French city at the end of the day, chimney
stacks, zinc valleys and roof windows in the foreground, the roofscape
receding in layers into a light haze, a single distant church tower, cool blue
shadows against warm lit slopes, no people, no monument, no crane.
```

Note&nbsp;: les plans successifs qui s’estompent sont une métaphore directe de ce
que fait l’observatoire, qui regarde loin à partir de ce qui est proche.

### 5.5 Outils

Format&nbsp;: 3:2 paysage, 2400 × 1600 px.
Usage&nbsp;: en-tête de la bibliothèque d’outils, vignettes de fiches.
Recadrage&nbsp;: recadrage carré prévu pour les vignettes de la grille.

```
A working desk photographed from above in warm low light, a closed matte
notebook, a mechanical pencil, a small brass calculator with blank unmarked
keys, a folded architectural drawing showing only plain unlabelled line work,
a mug of black coffee at the edge of frame, dark linen surface, no screens,
no text anywhere, no hands.
```

Note&nbsp;: « no screens » évite la capture d’écran inventée, qui est la façon la
plus rapide de fabriquer une fausse promesse d’interface.

### 5.6 À propos

Format&nbsp;: 4:5 portrait, 1600 × 2000 px.
Usage&nbsp;: colonne latérale de la page, portrait éditorial de la démarche.
Recadrage&nbsp;: garder le portrait, il équilibre une page de texte long.

```
An archive room of bound land registers, tall wooden shelves of uniform
leather-spined volumes with no readable titles, one volume lying open on a
reading table with plain unreadable ruled columns, warm raking light from a
high window, dust in the light beam, no people, deep calm shadows.
```

Note&nbsp;: le registre relié est l’image du **corpus**&nbsp;: un ensemble fini, clos,
constaté. C’est la signature de marque rendue visible sans l’écrire.

---

## 6. Droits, honnêteté, mentions

Cette section n’est pas un avertissement de forme. Elle est la condition pour
que ces images puissent servir sur ce produit-là.

**Une image générée n’est jamais la photographie d’un bien réel.** Elle ne doit
donc jamais être placée à un endroit où un lecteur pourrait la prendre pour le
bien qu’il vient d’estimer, ni pour une vente DVF affichée sur la carte. Une
illustration d’ambiance a sa place en tête de page ou en marge&nbsp;; elle n’en a
aucune à côté d’un prix.

**Aucune adresse réelle ne doit être identifiable.** Pas de numéro de rue, pas
de plaque, pas de vitrine reconnaissable, pas de façade assez singulière pour
qu’un habitant la nomme. Les prompts ci-dessus l’interdisent déjà&nbsp;; il faut
encore le vérifier sur l’image produite, parce qu’un générateur peut restituer
un bâtiment appris.

**Aucun visage, aucune marque, aucun texte.** Le visage engage le droit à
l’image, la marque engage le droit des marques, et le texte généré est presque
toujours faux. Les trois sont dans la liste des interdits, et les trois doivent
être revérifiés à la livraison.

**Le texte alternatif doit dire ce que l’image est.** On écrit « illustration&nbsp;:
façade haussmannienne » et non « appartement à Lyon 6e ». Un `alt` honnête coûte
cinq mots et évite une affirmation fausse lue par un lecteur d’écran comme par
un moteur.

**Garder la trace.** Pour chaque image livrée, conserver le prompt exact, le
générateur, sa version et la date. C’est la seule façon de répondre à une
question de provenance six mois plus tard, et c’est la même exigence que celle
qu’on applique aux chiffres.

**Ce que ces images ne remplacent pas.** Les schémas qui expliquent la méthode
sont dessinés, pas générés&nbsp;: ils vivent dans `src/components/illustrations/` et
sont documentés dans `docs/illustrations.md`. Un schéma engage un raisonnement,
donc il doit être exact&nbsp;; une photo d’ambiance n’engage qu’une atmosphère. Ne
jamais confier à un générateur d’images le soin d’expliquer un calcul.
