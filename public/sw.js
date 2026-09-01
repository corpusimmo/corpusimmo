/**
 * LE SERVICE WORKER DE CORPUSIMMO — écrit à la main, et volontairement court.
 *
 * Pas de `next-pwa`, pas de Workbox. Un générateur de service worker se
 * réaccorde à chaque version majeure de Next et produit un fichier que
 * personne ne relit ; ici la totalité de la politique de cache tient dans ce
 * fichier, en clair, et se relit en une minute.
 *
 * LE PRINCIPE QUI GOUVERNE TOUT LE RESTE — ce produit ne dit jamais un prix
 * qu'il ne peut pas justifier. Un cache est par nature une promesse tenue en
 * retard : servir une médiane DVF vieille de trois semaines en la présentant
 * comme le marché serait un mensonge, et un mensonge dont le visiteur n'aurait
 * aucun moyen de se rendre compte. Donc :
 *
 *   la DONNÉE ne passe jamais par ici, seule l'ENVELOPPE est mise en cache.
 *
 * Ce qui est hors ligne, c'est la coque du site et les pages déjà lues. Aucun
 * chiffre n'en sort.
 *
 * CE QU'IL FAUT SAVOIR AVANT D'Y TOUCHER
 *   - `VERSION` est une constante MANUELLE. Elle sert à jeter d'un coup tous
 *     les caches quand la coque change (nouvelle page hors ligne, nouvelle
 *     stratégie). Le navigateur ne remplace ce service worker que si les
 *     OCTETS de ce fichier changent : modifier `VERSION` suffit donc à
 *     déclencher la mise à jour ET à purger l'ancien contenu, d'une pierre
 *     deux coups.
 *   - les plafonds `_MAX` sont là parce qu'un cache sans plafond finit par se
 *     faire évincer en entier par le navigateur, au pire moment.
 */

const VERSION = "2026-09-01";

/** L'enveloppe : JS, CSS, polices, icônes, images d'aperçu, page hors ligne. */
const COQUE = `corpusimmo-coque-${VERSION}`;
/** Les documents HTML déjà visités, gardés pour le jour où le réseau manque. */
const PAGES = `corpusimmo-pages-${VERSION}`;

const CACHES_COURANTS = [COQUE, PAGES];
/** Le préfixe qui nous appartient : on ne supprime jamais le cache d'autrui. */
const PREFIXE = "corpusimmo-";

const PAGE_HORS_LIGNE = "/hors-ligne";

const COQUE_MAX = 140;
const PAGES_MAX = 24;

/* ==========================================================================
   CE QUI NE DOIT JAMAIS ÊTRE MIS EN CACHE
   --------------------------------------------------------------------------
   Cette liste n'est pas une optimisation, c'est une règle de sécurité et
   d'honnêteté. Chaque entrée a une raison distincte.
   ========================================================================== */
const HORS_ATTEINTE = [
  // Toute donnée vivante. DVF, géocodage, estimation, formulaires : ces
  // routes vont au réseau et NULLE PART ailleurs. Il n'y a délibérément pas
  // de repli sur le cache derrière, parce qu'un repli, c'est exactement le
  // moment où l'on servirait un prix périmé sans le dire.
  //
  // Cela couvre du même geste `/api/outils/*/acces`, `/api/leads`,
  // `/api/newsletter` et `/api/auth/*` : rien qui porte une adresse e-mail,
  // un cookie d'accès ou une session ne doit laisser de trace sur le disque.
  /^\/api\//,

  // L'espace personnel : rendu dynamique, propre à une session.
  /^\/mon-espace/,

  // Le calculateur est reverrouillé À CHAQUE RENDU côté serveur (voir
  // `src/lib/access/ledger.ts`). Mettre son HTML en cache, ce serait offrir
  // une copie de la page qui ne repasse plus par le verrou.
  /^\/outils\/[^/]+\/calculer/,

  // Les écrans d'authentification : jamais de copie locale.
  /^\/connexion/,
];

/** L'enveloppe statique, reconnue au chemin puis, à défaut, à l'extension. */
function estCoque(url) {
  // Empreinté par le build : le contenu d'une URL `/_next/static/…` ne change
  // JAMAIS. C'est le seul endroit où « cache d'abord » est sans risque par
  // construction. Les polices `next/font` y vivent aussi.
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  if (url.pathname.startsWith("/outils/apercus/")) return true;
  return /\.(?:woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico)$/i.test(url.pathname);
}

function estHorsAtteinte(pathname) {
  return HORS_ATTEINTE.some((motif) => motif.test(pathname));
}

/**
 * Le dernier garde-fou avant l'écriture. Une réponse ne rentre en cache que si
 * elle est à nous, complète, et que le serveur ne s'y est pas opposé.
 */
function stockable(response) {
  if (!response || response.status !== 200) return false;

  // `basic` = même origine, en-têtes lisibles. Une réponse `opaque` (CORS sans
  // en-têtes) n'expose ni statut ni contenu : on ne saurait jamais si l'on
  // vient d'archiver une erreur 500. Une réponse `error` non plus.
  if (response.type !== "basic") return false;

  // Une réponse issue d'une redirection ne peut pas être rejouée telle quelle
  // sur une navigation : le navigateur refuse alors la page avec
  // « Response served by service worker has redirected ». C'est un piège
  // classique, et il ne se voit qu'en production.
  if (response.redirected) return false;

  // Ce que le serveur a lui-même déclaré non stockable. C'est la ceinture qui
  // protège une réponse portant un cookie si jamais un chemin nous échappait
  // dans `HORS_ATTEINTE` : les routes sensibles répondent `no-store`.
  const directives = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !directives.includes("no-store") && !directives.includes("private");
}

/**
 * Plafonne un cache. `keys()` rend les entrées dans leur ordre d'insertion :
 * couper par la tête revient à jeter les plus anciennes. Ce n'est pas une vraie
 * LRU, et ça n'a pas besoin de l'être.
 */
async function plafonner(nom, maximum) {
  const cache = await caches.open(nom);
  const clefs = await cache.keys();
  const surplus = clefs.length - maximum;
  if (surplus <= 0) return;
  await Promise.all(clefs.slice(0, surplus).map((clef) => cache.delete(clef)));
}

/* ==========================================================================
   INSTALLATION
   ========================================================================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(COQUE);
        // `cache: "reload"` court-circuite le cache HTTP du navigateur. Sans
        // lui, on pré-chargerait potentiellement la version PRÉCÉDENTE de la
        // page hors ligne, c'est-à-dire celle que l'on est en train de
        // remplacer.
        await cache.add(new Request(PAGE_HORS_LIGNE, { cache: "reload" }));
      } catch {
        // Réseau capricieux au moment de l'installation : le service worker
        // s'installe quand même. Il aura simplement une page hors ligne de
        // moins, ce qui vaut mieux que pas de service worker du tout.
      }
    })(),
  );

  // PAS de `skipWaiting()` ici, et c'est un choix, pas un oubli.
  //
  // Un onglet ouvert exécute le JavaScript d'une version donnée du site et
  // demande des morceaux `/_next/static/<empreinte>/…` qui appartiennent à
  // CETTE version. Prendre la main de force au milieu de sa vie, c'est mettre
  // en face de lui un service worker dont les caches ont été purgés à
  // l'activation : le prochain morceau chargé paresseusement peut ne plus
  // exister. On laisse donc le nouveau service worker attendre que les onglets
  // de l'ancienne version soient fermés. À la toute première visite il n'y a
  // pas d'ancien contrôleur : l'activation est immédiate, et rien n'attend.
});

/* ==========================================================================
   ACTIVATION — c'est ici que l'on jette les vieux caches
   ========================================================================== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms
          .filter((nom) => nom.startsWith(PREFIXE) && !CACHES_COURANTS.includes(nom))
          .map((nom) => caches.delete(nom)),
      );

      // Prendre la main sur les onglets qui n'ont pas encore de contrôleur.
      // En pratique : la première visite, celle où la page a fini de se
      // charger avant que le service worker n'existe. Sans `claim()`, il
      // faudrait un rechargement pour que la mise hors ligne commence, et
      // personne ne recharge une page qui marche.
      await self.clients.claim();
    })(),
  );
});

/**
 * La sortie de secours pour activer une mise à jour sans attendre.
 *
 * Rien ne l'appelle aujourd'hui : ce serait au produit de proposer d'abord un
 * « une nouvelle version est disponible, recharger ? ». Le point d'entrée
 * existe pour que ce jour-là il n'y ait pas à retoucher le service worker.
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "corpusimmo:activer-maintenant") {
    self.skipWaiting();
  }
});

/* ==========================================================================
   LES TROIS STRATÉGIES
   ========================================================================== */

/** Cache d'abord. Réservé à ce dont le contenu ne peut pas changer. */
async function cacheDAbord(request, event) {
  const cache = await caches.open(COQUE);
  const enCache = await cache.match(request);
  if (enCache) return enCache;

  const response = await fetch(request);
  if (stockable(response)) {
    const copie = response.clone();
    // La page n'attend pas l'écriture : `waitUntil` garde seulement le service
    // worker en vie le temps qu'elle se termine.
    event.waitUntil(cache.put(request, copie).then(() => plafonner(COQUE, COQUE_MAX)));
  }
  return response;
}

/** Réseau d'abord, repli sur la copie de la page, puis sur la page hors ligne. */
async function documentDAbordAuReseau(request, event) {
  try {
    const response = await fetch(request);
    if (stockable(response)) {
      const copie = response.clone();
      event.waitUntil(caches.open(PAGES).then(async (cache) => {
        await cache.put(request, copie);
        await plafonner(PAGES, PAGES_MAX);
      }));
    }
    return response;
  } catch {
    const pages = await caches.open(PAGES);
    const copie = await pages.match(request);
    if (copie) return copie;

    const coque = await caches.open(COQUE);
    const horsLigne = await coque.match(PAGE_HORS_LIGNE);
    if (horsLigne) return horsLigne;

    // Même la page hors ligne manque (installation interrompue) : on répond
    // en clair plutôt que de laisser l'écran d'erreur du navigateur.
    return new Response(
      "Vous êtes hors connexion, et CorpusImmo n'a pas encore pu mettre sa page hors ligne de côté.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Une écriture ne se met pas en cache et ne se rejoue jamais. `POST
  // /api/leads`, `POST /api/newsletter`, `POST /api/estimation` passent droit.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Tuiles OpenFreeMap, géocodeur de l'IGN, tout ce qui n'est pas à nous : le
  // service worker s'écarte. Ces réponses sont opaques, donc illisibles, et
  // leur mise en cache relève de leurs en-têtes HTTP, pas de nous.
  if (url.origin !== self.location.origin) return;

  if (estHorsAtteinte(url.pathname)) return;

  // Les seuls documents que l'on garde sont ceux d'une VRAIE navigation.
  //
  // C'est plus fin qu'il n'y paraît : une navigation côté client dans Next ne
  // demande pas du HTML mais une charge utile RSC, sur le MÊME chemin avec un
  // `?_rsc=…`. Filtrer sur `mode === "navigate"` évite d'archiver ce flux sous
  // la clef d'une page, ce qui rendrait ensuite du JSON à qui demande une page.
  if (request.mode === "navigate") {
    event.respondWith(documentDAbordAuReseau(request, event));
    return;
  }

  if (estCoque(url)) {
    event.respondWith(cacheDAbord(request, event));
  }

  // Tout le reste part au réseau sans que l'on s'en mêle. Ne pas répondre est
  // plus sûr que répondre à peu près.
});
