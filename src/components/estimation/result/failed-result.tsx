import Link from "next/link";
import { CircleSlash } from "lucide-react";
import { RadiusEscalation } from "@/components/illustrations";
import { Button } from "@/components/ui";
import { formatDistance, formatNumber } from "@/lib/utils/format";
import type { ValuationResult } from "@/types/valuation";

/**
 * An estimation that cannot conclude gets an explanation, never a number.
 * This screen exists precisely so no one is tempted to fill the gap.
 */
export function FailedResult({ valuation }: { valuation: ValuationResult }) {
  const { diagnostics } = valuation;

  return (
    <section
      className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-9"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning-soft-fg">
          <CircleSlash aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold leading-tight text-ink">
            Nous ne pouvons pas estimer ce bien de façon honnête
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Les ventes enregistrées autour de votre adresse ne permettent pas de produire une
            fourchette crédible. Plutôt qu’un chiffre inventé, voici ce que nous avons trouvé.
          </p>
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-3 rounded-lg bg-surface-2 p-5 sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-muted">Rayon exploré</dt>
          <dd className="tnum text-sm font-medium text-ink">
            {formatDistance(diagnostics.radiusUsed)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-muted">Ventes trouvées</dt>
          <dd className="tnum text-sm font-medium text-ink">
            {formatNumber(diagnostics.candidatesFound)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-muted">Ventes comparables retenues</dt>
          <dd className="tnum text-sm font-medium text-ink">{formatNumber(diagnostics.retained)}</dd>
        </div>
      </dl>

      {/* Le schéma de l'escalade de rayon, ici plus qu'ailleurs : quand le
          moteur refuse de conclure, le dessin explique le refus mieux qu'un
          paragraphe. Les rayons dessinés sont ceux du moteur. */}
      <div className="rounded-lg bg-canvas p-3 sm:p-5">
        <RadiusEscalation />
      </div>

      {diagnostics.failureReason ? (
        <p className="rounded-lg border-l-2 border-warning bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning-soft-fg">
          {diagnostics.failureReason}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink">Ce que vous pouvez faire</h3>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>
            Vérifier les caractéristiques saisies : une surface erronée peut écarter toutes les
            ventes comparables.
          </li>
          <li>
            Explorer la carte DVF : même sans estimation, vous pouvez consulter les ventes
            enregistrées autour de votre adresse.
          </li>
          <li>
            Dans les communes peu denses, il arrive qu’aucune vente récente ne ressemble
            suffisamment à votre bien. Seul un professionnel sur place pourra alors trancher.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/estimer">Reprendre l’estimation</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/carte">Voir les ventes du secteur</Link>
        </Button>
      </div>
    </section>
  );
}
