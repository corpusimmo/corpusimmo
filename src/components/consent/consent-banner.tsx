"use client";

/**
 * LE BANDEAU DE CONSENTEMENT.
 *
 * Trois exigences de la CNIL, tenues par la forme autant que par le code :
 *
 *   · REFUSER EST AUSSI SIMPLE QU'ACCEPTER. Deux boutons, même taille, même
 *     rang, côte à côte. Pas de « continuer sans accepter » caché en gris pâle
 *     dans un coin, pas de second écran pour dire non ;
 *   · LE CHOIX EST ÉCLAIRÉ. Les finalités sont nommées avant le clic, pas
 *     derrière un lien qu'il faudrait aller ouvrir ;
 *   · L'ABSENCE DE RÉPONSE N'EST PAS UN ACCORD. Le bandeau ne se ferme pas
 *     tout seul, ne se ferme pas au défilement, et n'a pas de croix : une
 *     fermeture sans choix laisserait un état ambigu qu'il faudrait ensuite
 *     interpréter, et l'interprétation pencherait toujours du même côté.
 *
 * Il n'y a rien à bloquer derrière : aucun traceur n'est chargé tant que la
 * réponse n'est pas donnée. Le bandeau n'est donc pas une formalité qui ouvre
 * une porte déjà ouverte, c'est bien lui qui commande le chargement.
 *
 * Il apparaît après l'hydratation, en bas d'écran, sans voile ni superposition
 * modale : la page reste lisible et utilisable pendant qu'on décide.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui";
import { useConsent } from "@/lib/consent/consent";
import { privacySignalRefuses, pushConsentState } from "@/lib/analytics/track";
import { reportConsentChoice } from "@/lib/leads/consent-beacon";

export function ConsentBanner() {
  const { status, choices, hydrated, acceptAll, refuseAll } = useConsent();

  // Google doit être tenu au courant d'un retrait comme d'un accord, sans
  // attendre un rechargement. Et le registre côté serveur reçoit la même
  // décision, dans les deux sens : prouver qu'on a demandé et essuyé un non
  // vaut autant que prouver un oui. Le dépôt ne se rejoue que si la décision a
  // changé, sinon chaque page vue écrirait une ligne.
  useEffect(() => {
    if (status !== "answered") return;
    pushConsentState(choices.analytics);
    void reportConsentChoice(choices.analytics);
  }, [status, choices.analytics]);

  // Le navigateur a déjà dit non pour la personne : lui reposer la question
  // reviendrait à espérer une réponse différente.
  if (!hydrated || status === "answered" || privacySignalRefuses()) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consentement-titre"
      className="animate-fade-in fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/98 backdrop-blur"
    >
      <div className="container-page flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex gap-3">
          <Cookie aria-hidden="true" className="mt-0.5 hidden size-5 shrink-0 text-ink-subtle sm:block" />
          <div className="min-w-0">
            <p id="consentement-titre" className="text-sm font-semibold text-ink">
              Mesure d&apos;audience
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Nous aimerions compter les visites et savoir quelles pages servent, avec Google
              Analytics. Rien n&apos;est chargé tant que vous n&apos;avez pas répondu, et refuser ne
              retire aucune fonctionnalité. Les cookies nécessaires au fonctionnement du site
              (session, accès aux outils) ne sont pas concernés.{" "}
              <Link href="/cookies" className="font-medium text-primary underline underline-offset-2">
                Le détail des traceurs
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={refuseAll} className="sm:min-w-36">
            Tout refuser
          </Button>
          <Button type="button" onClick={acceptAll} className="sm:min-w-36">
            Tout accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
