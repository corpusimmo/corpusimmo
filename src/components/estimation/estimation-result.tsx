"use client";

/**
 * L'affichage du résultat, rendu sur place plutôt que sur une page dédiée.
 *
 * Rien n'est stocké : le moteur a renvoyé l'objet complet, le parcours le
 * détient, cette vue le montre. C'est ce qui permet à cette version de tourner
 * sans base de données — et c'est aussi pourquoi il n'y a PAS de lien
 * partageable. Promettre une URL permanente qui ne survivrait pas au
 * rechargement serait exactement le genre de fausse promesse que le produit
 * s'interdit ailleurs sur les prix.
 *
 * Le rapport PDF, lui, existe bel et bien : il se fabrique en renvoyant ce même
 * objet à `POST /api/estimation/pdf`.
 */

import { useCallback, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";

import { DistributionChart } from "@/components/charts";
import { Badge, Button } from "@/components/ui";
import { disclaimers } from "@/config/site";
import { formatDate } from "@/lib/utils/format";
import { explainValuation } from "@/lib/valuation";
import type { ValuationResult } from "@/types/valuation";

import { ComparablesList } from "./result/comparables-list";
import { ConfidencePanel } from "./result/confidence-panel";
import { FailedResult } from "./result/failed-result";
import { LeadCta } from "./result/lead-cta";
import { Methodology } from "./result/methodology";
import { SubjectSummary } from "./result/subject-summary";
import { ValueHeadline } from "./result/value-headline";

export function EstimationResult({
  valuation,
  onRestart,
}: {
  valuation: ValuationResult;
  onRestart: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/estimation/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(valuation),
      });
      if (!response.ok) throw new Error(`pdf_${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `estimation-${valuation.subject.address.city.toLowerCase()}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      // Libérer l'objet tout de suite : le téléchargement est déjà parti.
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Le rapport n'a pas pu être généré. Réessayez dans quelques instants.");
    } finally {
      setDownloading(false);
    }
  }, [valuation]);

  // Jamais un paragraphe figé : le moteur raconte son propre résultat, donc les
  // mots et les chiffres ne peuvent pas diverger.
  const explanation = explainValuation(valuation);
  const kept = valuation.comparables.filter((comparable) => !comparable.excluded);
  const failed = valuation.status !== "computed" || !valuation.value;

  const distribution = kept
    .map((comparable) => comparable.transaction.pricePerSqm)
    .filter((price): price is number => price !== undefined);

  return (
    <div className="animate-fade-up flex flex-col gap-7">
      <header className="flex flex-col gap-4">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Faire une autre estimation
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl leading-tight text-ink md:text-3xl">
            Estimation du {formatDate(valuation.createdAt)}
          </h1>
          {failed ? (
            <Badge tone="warning">Estimation impossible</Badge>
          ) : (
            <Badge tone="success">Fourchette calculée</Badge>
          )}
        </div>
      </header>

      {failed ? (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-6">
            <FailedResult valuation={valuation} />
            <section
              aria-labelledby="explication-echec"
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6"
            >
              <h2 id="explication-echec" className="eyebrow">
                Ce que nous avons regardé
              </h2>
              <p className="text-sm leading-relaxed text-ink">{explanation}</p>
            </section>
          </div>
          <aside className="flex w-full flex-col gap-5 lg:w-[22rem] lg:shrink-0">
            <SubjectSummary subject={valuation.subject} />
          </aside>
        </div>
      ) : (
        <>
          {valuation.value ? (
            <ValueHeadline
              value={valuation.value}
              pricePerSqm={valuation.pricePerSqm}
              medianPricePerSqm={valuation.medianPricePerSqm}
              averagePricePerSqm={valuation.averagePricePerSqm}
              comparableCount={kept.length}
            />
          ) : null}

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Sur mobile, le panneau de confiance suit immédiatement le chiffre ;
                sur grand écran il tient la colonne de droite. */}
            <aside className="order-1 flex w-full flex-col gap-5 lg:order-2 lg:w-[22rem] lg:shrink-0">
              <ConfidencePanel confidence={valuation.confidence} />
              <SubjectSummary subject={valuation.subject} />
              <LeadCta />
            </aside>

            <div className="order-2 flex flex-1 flex-col gap-6 lg:order-1">
              <section
                aria-labelledby="explication"
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6"
              >
                <h2 id="explication" className="eyebrow">
                  Comment nous sommes arrivés là
                </h2>
                <p className="text-sm leading-relaxed text-ink">{explanation}</p>
              </section>

              {distribution.length >= 5 ? (
                <section
                  aria-labelledby="dispersion"
                  className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
                >
                  <h2 id="dispersion" className="eyebrow">
                    Dispersion des prix au m² retenus
                  </h2>
                  <DistributionChart values={distribution} highlight={valuation.pricePerSqm} />
                </section>
              ) : null}

              <ComparablesList comparables={kept} />
              <Methodology valuation={valuation} />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Emporter cette estimation</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Le rapport reprend la fourchette, la méthode et les ventes retenues.
          </p>
        </div>
        <Button type="button" variant="secondary" loading={downloading} onClick={() => void download()}>
          <Download aria-hidden="true" className="size-4" />
          Télécharger le rapport
        </Button>
      </div>

      {downloadError ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {downloadError}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-subtle">{disclaimers.long}</p>
    </div>
  );
}
