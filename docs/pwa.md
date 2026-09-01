# Application installable (PWA)

CorpusImmo s'installe sur un écran d'accueil ou sur un bureau, et reste
consultable sans réseau. Rien de plus : **aucun chiffre n'est disponible hors
ligne**, et c'est le point de départ de tout ce qui suit.

## La règle qui gouverne le reste

Un cache est une promesse tenue en retard. Servir une médiane DVF vieille de
trois semaines en la présentant comme le marché serait un mensonge, et un
mensonge invisible pour la personne qui le lit. Donc :

> la **donnée** ne passe jamais par le cache, seule l'**enveloppe** y entre.

Ce qui survit hors connexion, c'est la coque du site et les pages déjà lues.
Un prix, jamais.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `src/app/manifest.ts` | Le manifeste. Convention de fichier Next : la balise `<link rel="manifest">` est posée toute seule, il n'y a **rien** à ajouter dans `layout.tsx` pour lui. |
| `public/sw.js` | Le service worker, écrit à la main. Toute la politique de cache y tient en clair. |
| `public/icons/*.png` | Les icônes, générées depuis la géométrie de `src/app/icon.svg`. |
| `src/app/(site)/hors-ligne/page.tsx` | La page servie quand le réseau manque. |
| `src/components/pwa/` | L'enregistrement du service worker et l'invite d'installation. |

### Ce qui vit dans `src/components/pwa/`

| Module | Ce qu'il fait |
|---|---|
| `pwa-runtime.tsx` | **Le seul point de montage.** Une balise dans `layout.tsx`, et rien d'autre. |
| `service-worker.tsx` | Enregistre `/sw.js` en production ; **désenregistre** en développement. |
| `install-invite.tsx` | Le dessin de l'invite. Ne décide de rien. |
| `use-install-invite.ts` | Toute la décision d'afficher : canal, moment, exclusions. |
| `deferred-prompt.ts` | Attrape `beforeinstallprompt` au niveau du module, donc au plus tôt. |
| `memory.ts` | Le refus mémorisé et le comptage des pages vues. |
| `platform.ts` | iOS, Safari, mode installé. Fonctions pures, testées. |

Le pourquoi de chaque choix est écrit dans l'en-tête des fichiers eux-mêmes.
Ce document ne redit que ce qui se décide **entre** les fichiers.

## Le montage dans la mise en page racine

Une seule ligne d'import et une seule balise, en **dernier enfant** de
`<body>` :

```tsx
import { PwaRuntime } from "@/components/pwa";
// ...
<body>
  <AuthSessionProvider>
    <ToastProvider>{children}</ToastProvider>
  </AuthSessionProvider>
  <PwaRuntime />
</body>
```

Hors des fournisseurs, délibérément : le sujet PWA ne dépend ni de la session
ni des toasts, et rien ne doit lui donner l'occasion d'en dépendre un jour.

`PwaRuntime` ne rend **rien** dans le flux du document. Le registrar rend
`null`, l'invite se dessine dans un portail sur `<body>` et seulement après un
signe d'intérêt : aucun décalage de mise en page n'est possible au chargement.

## La stratégie de cache, et ce qu'elle exclut

| Ce qui est demandé | Stratégie | Cache |
|---|---|---|
| `/_next/static/**`, polices, `/icons/**`, `/outils/apercus/**` | **cache d'abord** | `corpusimmo-coque-<version>` |
| Navigations vers un document | **réseau d'abord**, repli sur la copie, puis sur `/hors-ligne` | `corpusimmo-pages-<version>` |
| `/api/**` | **réseau, et rien d'autre** | jamais |
| Tout le reste | réseau, sans interception | jamais |

« Cache d'abord » n'est sans risque que sur `/_next/static/**` parce que ces
URL sont **empreintées** par le build : leur contenu ne change jamais.

### Ce qui n'entre jamais dans un cache, et pourquoi

- **`/api/**`** : toute la donnée vivante (DVF, géocodage, estimation). Il n'y a
  délibérément **pas de repli sur le cache** derrière le réseau, parce qu'un
  repli, c'est exactement le moment où l'on servirait un prix périmé sans le
  dire. Cela couvre du même geste `/api/outils/*/acces`, `/api/leads`,
  `/api/newsletter` et `/api/auth/*` : rien qui porte une adresse e-mail, un
  cookie d'accès ou une session ne laisse de trace sur le disque.
- **`/mon-espace`** : rendu dynamique, propre à une session.
- **`/outils/*/calculer`** : le calculateur est reverrouillé **à chaque rendu**
  côté serveur (voir `src/lib/access/ledger.ts`). En mettre le HTML en cache
  offrirait une copie de la page qui ne repasse plus par le verrou.
- **`/connexion`** : jamais de copie locale d'un écran d'authentification.
- **Toute méthode autre que `GET`** : une écriture ne se rejoue pas.
- **Les origines tierces** (tuiles OpenFreeMap, géocodeur de l'IGN) : leurs
  réponses sont opaques, donc illisibles, et leur mise en cache relève de leurs
  en-têtes HTTP, pas de nous.

Trois garde-fous supplémentaires, appliqués à toute écriture : jamais de
réponse non `basic` (une réponse opaque pourrait être une erreur 500 que l'on
archiverait sans le savoir), jamais de réponse `redirected` (le navigateur
refuserait ensuite la page avec « Response served by service worker has
redirected »), et jamais de réponse marquée `no-store` ou `private` par le
serveur.

### Le piège RSC

Une navigation côté client dans Next ne demande pas du HTML mais une charge
utile RSC, sur le **même chemin** avec un `?_rsc=…`. Le filtre
`request.mode === "navigate"` est ce qui évite d'archiver ce flux sous la clef
d'une page, et donc de rendre du JSON à qui demande une page.

## Les versions de cache

`VERSION`, en tête de `public/sw.js`, est une constante **manuelle**.

Le navigateur ne remplace le service worker que si les **octets** du fichier
changent : modifier `VERSION` déclenche donc la mise à jour **et** purge les
anciens caches d'une pierre deux coups. À incrémenter dès que la coque change
(nouvelle page hors ligne, nouvelle stratégie). Les caches sont par ailleurs
plafonnés, parce qu'un cache sans plafond finit par se faire évincer en entier
par le navigateur, au pire moment.

### `skipWaiting` : prévu, pas appelé

Le service worker écoute le message `corpusimmo:activer-maintenant` et appelle
alors `skipWaiting()`. **Rien ne l'envoie aujourd'hui**, et c'est un choix.

Un onglet ouvert exécute le JavaScript d'une version donnée du site et demande
des morceaux `/_next/static/<empreinte>/…` qui appartiennent à *cette* version.
Prendre la main de force au milieu de sa vie, c'est mettre en face de lui un
service worker dont les caches viennent d'être purgés à l'activation : le
prochain morceau chargé paresseusement peut ne plus exister. On laisse donc le
nouveau service worker attendre la fermeture des onglets de l'ancienne version.

`clients.claim()` est en revanche bien appelé à l'activation : il sert la
**première** visite, celle où la page a fini de se charger avant que le service
worker n'existe. Sans lui, il faudrait un rechargement pour que la mise hors
ligne commence, et personne ne recharge une page qui marche.

Le jour où le produit voudra proposer « une nouvelle version est disponible,
recharger ? », le point d'entrée existe déjà.

## L'invite d'installation

Discrète est une **exigence**, pas une préférence.

### La forme

Une barre en bas d'écran sur mobile, une carte de 21 rem en bas **à gauche** sur
ordinateur. À gauche parce que le coin bas-droit est déjà pris : les toasts y
vivent (`ui/toast.tsx`, `z-60`) et le panier de comparables aussi
(`observatoire/comparables-cart.tsx`, `z-40`). L'invite se range en `z-30`,
sous les deux : si quelque chose doit passer devant, ce n'est jamais elle.

Jamais de modale, jamais de superposition qui assombrit la page, jamais de vol
de focus. L'animation est `animate-fade-up`, six pixels ; `globals.css`
neutralise déjà toutes les animations sous `prefers-reduced-motion`, de façon
globale et sans exception.

### Le déclenchement

Elle n'apparaît **jamais** avant qu'il y ait un signe d'intérêt :

- une **deuxième page vue** (le compteur survit aux rechargements), **ou**
- **trente secondes** passées sur la page en cours.

Quelqu'un qui vient de tomber sur le site depuis une recherche n'a aucune
raison de vouloir l'installer.

Elle ne s'affiche pas non plus :

- si l'application tourne **déjà installée** (`display-mode: standalone`,
  `minimal-ui`, `fullscreen`, ou `navigator.standalone` sur iOS) ;
- sur les **écrans de travail** : `/estimer`, `/carte`, `/observatoire`,
  `/mon-espace`, `/connexion`, `/hors-ligne`. Interrompre une estimation en
  cours pour vendre un raccourci, c'est le contraire de discret ;
- si le refus est encore en vigueur.

### Le refus

Stocké dans `localStorage`, clef `corpusimmo.pwa-invite.v1`.

**Soixante jours** au minimum, et l'attente **double à chaque refus
supplémentaire** (60, 120, 240, puis 480 jours, plafonné là). Un « non » qui
revient le lendemain est un « non » qu'on n'a pas écouté. Un refus dans la
boîte de dialogue native du navigateur compte exactement comme un refus dans
notre barre. Une installation constatée, par l'invite ou par le menu du
navigateur (`appinstalled`), ferme le sujet définitivement.

Garde-fou : une date de refus située dans le futur (horloge système reculée) se
lit comme « toujours en vigueur », jamais comme « il y a très longtemps ». Le
doute profite à qui a dit non.

### iOS

Safari ne tire **pas** `beforeinstallprompt` et n'expose aucune API
d'installation. Prétendre installer serait mentir : on affiche à la place la
marche à suivre, « touchez Partager, puis Sur l'écran d'accueil », et il n'y a
aucun bouton d'action.

Cette instruction n'est montrée qu'à **Safari** sur iOS. Chrome, Firefox et
Edge sur iOS empruntent WebKit mais n'ont pas le menu Partager de Safari, et
les navigateurs intégrés (Facebook, Instagram, LinkedIn…) n'ont pas du tout
« Sur l'écran d'accueil ». Leur décrire un bouton qui n'existe pas à cet
endroit serait pire que se taire. `platform.ts` fait ce tri, et
`platform.test.ts` le vérifie sur de vraies chaînes d'agent, dont le cas de
l'iPad, qui se présente comme un Mac de bureau et ne s'en distingue que par le
tactile.

### L'accessibilité

`role="dialog"` **non modal** : ni `aria-modal`, ni piège à focus, avec un nom
et une description portés par `aria-labelledby` / `aria-describedby`. Échap
ferme, sauf si une vraie modale est ouverte par-dessus (détectée par
`[aria-modal="true"]`) : cette touche lui appartient alors.

L'invite ne prend jamais le focus d'elle-même. Elle mémorise en revanche d'où
le focus est venu **si** quelqu'un y entre au clavier, et le lui rend à la
fermeture : sans cela le focus tomberait sur `<body>` et un lecteur d'écran
perdrait sa place.

## Les icônes

Générées depuis la géométrie de `src/app/icon.svg`, recopiée telle quelle. Une
icône d'application qui diverge de la favicon d'un demi-pixel se remarque, et
se remarque mal.

| Fichier | Taille | `purpose` |
|---|---|---|
| `icone-192.png`, `icone-384.png`, `icone-512.png` | 192, 384, 512 | `any` |
| `icone-maskable-192.png`, `icone-maskable-512.png` | 192, 512 | `maskable` |
| `apple-touch-icon.png` | 180 | iOS (voir plus bas) |

Le tirage `any` est le carré bleu nuit aux angles courts, exactement la
favicon. Le tirage `maskable` est le même signe **plein bord**, dessiné pour
être rogné : Android applique son propre masque (cercle, goutte, carré arrondi)
et ne garantit que le disque central de 80 %. Le motif y occupe **90 % du rayon
utile**, soit 184 px de rayon englobant pour une zone sûre de 205 px : il
survit au cercle, qui est le masque le plus sévère.

Ce n'est pas une garantie arithmétique, c'est une vérification : les icônes ont
été rendues, masquées en cercle et en carré arrondi, puis **regardées**. Une
maskable mal calibrée ne se voit qu'à l'œil.

### Ce qui reste à câbler pour iOS

`public/icons/apple-touch-icon.png` est généré mais **n'est référencé nulle
part**. Safari le trouverait tout seul s'il était servi à la racine
(`/apple-touch-icon.png`), ce qui n'est pas le cas ici. Deux façons de le
brancher, au choix :

- déplacer le fichier vers `public/apple-touch-icon.png` : Safari le trouve par
  convention, aucune balise à écrire ;
- ou le déclarer dans les métadonnées : `icons: { apple: "/icons/apple-touch-icon.png" }`
  dans l'export `metadata` de `src/app/layout.tsx`.

Depuis iOS 16.4, Safari lit aussi les icônes du manifeste ; l'`apple-touch-icon`
ne sert donc plus qu'aux versions antérieures.

## Vérifier

```bash
pnpm typecheck && pnpm lint && pnpm test
```

En production seulement, dans les outils de développement du navigateur :

- **Application → Manifest** : le nom, les icônes, et « Installable » sans
  avertissement ;
- **Application → Service Workers** : `sw.js` activé, et un seul ;
- **Network → Offline**, puis rechargement : les pages déjà visitées
  s'affichent, une page jamais visitée rend `/hors-ligne`, et un appel à
  `/api/**` échoue franchement au lieu de rendre un chiffre périmé.

En développement, il n'y a **rien** à voir : le service worker n'est pas
enregistré, et un service worker qui traînerait est désenregistré au montage.
Un cache local et le rechargement à chaud de Next ne cohabitent pas
honnêtement.
