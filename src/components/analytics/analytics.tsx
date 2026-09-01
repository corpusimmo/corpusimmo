"use client";

/**
 * LA MESURE D'AUDIENCE, ET LE MOMENT OÙ ELLE COMMENCE.
 *
 * La balise Google n'est PAS chargée puis mise en sourdine : elle n'est pas
 * demandée du tout tant que le consentement n'a pas été donné. C'est la lecture
 * stricte de ce qu'attend la CNIL, et c'est celle qui ne se discute pas : le
 * mode consentement de Google, avec ses requêtes sans cookie envoyées malgré un
 * refus, laisse une zone grise dans laquelle ce projet n'a rien à gagner.
 *
 * Conséquence assumée : on perd la mesure des visites qui refusent, et celle de
 * la première seconde de chaque visite. C'est le prix, il est connu, il est
 * payé.
 *
 * TROIS AUTRES GARDE-FOUS
 *   · rien en développement ni en préproduction : sans quoi les chiffres de
 *     production seraient pollués par nos propres allers-retours ;
 *   · rien sans identifiant de mesure configuré, ce qui est un cas NORMAL : le
 *     dépôt doit démarrer avec un `.env` vide ;
 *   · `send_page_view: false`, et les pages vues envoyées à la main. La
 *     navigation d'un routeur applicatif ne recharge pas le document ; laisser
 *     Google la deviner produit soit des pages manquantes, soit des doublons.
 *
 * `usePathname` seul, jamais `useSearchParams` : ce dernier ferait basculer
 * toutes les pages en rendu client, ce qui coûterait au site son atout le plus
 * solide pour un gain de mesure dérisoire. Les paramètres de recherche ne sont
 * donc pas dans les pages vues, et c'est documenté plutôt que subi.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

import { analyticsEnv, env } from "@/config/env";
import { useConsent } from "@/lib/consent/consent";
import { privacySignalRefuses, track } from "@/lib/analytics/track";

export function Analytics() {
  const { status, choices, hydrated } = useConsent();
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  const id = analyticsEnv.measurementId;
  const allowed =
    hydrated && status === "answered" && choices.analytics && !privacySignalRefuses();
  const active = Boolean(id) && env.isProduction && allowed;

  useEffect(() => {
    if (!active || lastSent.current === pathname) return;
    lastSent.current = pathname;
    track({
      name: "page_view",
      params: { page_path: pathname, page_title: document.title },
    });
  }, [active, pathname]);

  if (!active || !id) return null;

  return (
    <>
      {/*
        L'ordre compte : cette déclaration doit être évaluée avant que la balise
        ne s'exécute. `next/script` conserve l'ordre des scripts d'une même
        stratégie, et les deux partagent `afterInteractive`.
      */}
      <Script id="ga-consent" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=window.gtag||gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('consent','update',{analytics_storage:'granted'});`}
      </Script>

      <Script
        id="ga-tag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
      />

      <Script id="ga-config" strategy="afterInteractive">
        {`gtag('js', new Date());
gtag('config','${id}',{send_page_view:false,anonymize_ip:true});`}
      </Script>
    </>
  );
}
