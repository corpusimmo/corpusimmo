"use client";

/**
 * LA CONNEXION, DEMANDÉE UNE SEULE FOIS ET SEULEMENT ICI.
 *
 * La fiche de l'outil reste publique, statique et indexable : on voit ce que
 * l'outil calcule, ce qu'il ne fait pas, et à quoi ressemble le classeur. Seule
 * l'UTILISATION du calculateur demande une connexion.
 *
 * La distinction n'est pas cosmétique. Une bibliothèque qu'on ne peut pas
 * regarder avant d'ouvrir un compte n'est pas une bibliothèque, c'est une porte
 * fermée avec une affiche. Ici, la personne sait exactement ce qu'elle vient
 * chercher avant qu'on lui demande quoi que ce soit.
 *
 * Le reste du site, lui, ne demande rien : l'estimateur et l'observatoire,
 * carte comprise, sont ouverts, et le resteront.
 */

import { signIn } from "next-auth/react";
import { LogIn, Map, Search, Table2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";
import { track } from "@/lib/analytics/track";

export function SignInGate({
  slug,
  title,
  limit,
}: {
  slug: string;
  title: string;
  limit: number;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-1.5">
          <LogIn aria-hidden="true" className="size-3.5" />
          Connexion requise
        </span>
        <h2 className="font-display text-xl text-ink">
          Connectez-vous pour ouvrir «&nbsp;{title}&nbsp;»
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Les dix calculateurs se consultent librement, mais s&apos;utilisent en
          étant connecté. C&apos;est ce qui nous permet de savoir à qui ils
          servent, et de tenir une limite de {limit} outils par semaine qui ne
          dépende pas d&apos;un cookie qu&apos;on peut effacer.
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        loading={pending}
        onClick={() => {
          setPending(true);
          track({ name: "login_started", params: { provider: "google" } });
          void signIn("google", { redirectTo: `/outils/${slug}/calculer` });
        }}
        className="w-fit"
      >
        Continuer avec Google
      </Button>

      <div className="flex flex-col gap-3 border-t border-border-soft pt-5">
        <p className="text-sm font-medium text-ink">
          Le reste du site ne demande rien
        </p>
        <ul className="flex flex-col gap-2 text-sm text-ink-muted">
          <Row icon={<Search aria-hidden="true" className="size-4" />}>
            L&apos;estimateur, de la première question au résultat.
          </Row>
          <Row icon={<Map aria-hidden="true" className="size-4" />}>
            La carte de l&apos;observatoire, en plein écran et sans limite de
            consultation.
          </Row>
          <Row icon={<Table2 aria-hidden="true" className="size-4" />}>
            L&apos;observatoire et la recherche de transactions.
          </Row>
        </ul>
      </div>
    </div>
  );
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-ink-subtle">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
