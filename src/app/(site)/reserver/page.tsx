import type { Metadata } from "next";
import { Clock, ShieldCheck, Video } from "lucide-react";

import { BookingEmbed } from "@/components/marketing/booking-embed";
import { Button } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * LA PRISE DE RENDEZ-VOUS, sans quitter le site.
 *
 * Repli : sans `NEXT_PUBLIC_CAL_LINK`, le calendrier n'existe pas et la page
 * propose d'écrire. Un visiteur ne tombe jamais sur une page vide.
 */

export const metadata: Metadata = pageMetadata({
  title: "Prendre rendez-vous",
  description:
    "Vingt minutes avec l'équipe CorpusImmo pour regarder votre cas : un bien à estimer, " +
    "un secteur à suivre, un outil à mettre en place.",
  path: "/reserver",
  index: false,
});

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK?.trim();

const POINTS = [
  [Clock, "Vingt minutes", "Le temps de poser votre situation et de repartir avec une réponse."],
  [Video, "En visio", "Le lien arrive avec la confirmation. Rien à installer."],
  [ShieldCheck, "Sans engagement", "On regarde ce qui est faisable, et par où commencer."],
] as const;

export default function ReserverPage() {
  return (
    <div className="bg-canvas py-12 md:py-16">
      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-16">
        <div className="max-w-lg">
          <p className="eyebrow">Rendez-vous</p>
          <h1 className="mt-3 font-display text-3xl leading-tight md:text-4xl">
            On regarde votre cas ensemble
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Un bien à estimer, un secteur à suivre, un outil à mettre en place. Choisissez un
            créneau, on vous rappelle avec les chiffres sous les yeux.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {POINTS.map(([Icon, title, body]) => (
              <li key={title} className="flex items-start gap-3 text-sm leading-relaxed">
                <Icon aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-accent" />
                <span>
                  <strong className="text-ink">{title}.</strong> <span className="text-ink-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-muted">
            Vous préférez écrire ?{" "}
            <a href={`mailto:${siteConfig.contactEmail}`} className="text-ink underline underline-offset-4">
              {siteConfig.contactEmail}
            </a>
          </p>
        </div>

        {CAL_LINK ? (
          <BookingEmbed />
        ) : (
          <div className="panel p-8">
            <h2 className="font-display text-2xl">Le calendrier arrive</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              La prise de rendez-vous en ligne n&rsquo;est pas encore ouverte. Écrivez-nous, on vous
              propose un créneau par retour.
            </p>
            <Button asChild className="mt-6">
              <a href={`mailto:${siteConfig.contactEmail}`}>Écrire à {siteConfig.contactEmail}</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
