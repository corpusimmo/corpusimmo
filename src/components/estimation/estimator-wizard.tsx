"use client";

/**
 * Le parcours d'estimation, en six étapes.
 *
 * L'ordre est celui de `wizard-state.ts` : USAGE d'abord, parce que la
 * bifurcation résidentiel / professionnel change la méthode et donc toutes les
 * questions suivantes. Poser l'adresse avant reviendrait à afficher des champs
 * qu'on devrait ensuite invalider.
 *
 * Le résultat n'est pas rangé quelque part puis rechargé depuis une URL : le
 * moteur le renvoie en entier, ce composant le remonte à sa page, et la page
 * l'affiche. Aucun stockage, donc aucune promesse de lien permanent qui ne
 * survivrait pas au rechargement.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, History, Sparkles } from "lucide-react";

import { Button, Progress, Spinner, Stepper } from "@/components/ui";
import { disclaimers } from "@/config/site";
import type { ValuationResult } from "@/types/valuation";

import { StepAddress } from "./steps/step-address";
import { StepContact } from "./steps/step-contact";
import { StepFeatures } from "./steps/step-features";
import { StepIntent } from "./steps/step-intent";
import { StepType } from "./steps/step-type";
import { StepUsage } from "./steps/step-usage";
import {
  INITIAL_STATE,
  STEP_COUNT,
  WIZARD_STEPS,
  applySearchParams,
  clearWizardState,
  loadWizardState,
  parseNumber,
  resolvePropertyType,
  saveWizardState,
  toValuationRequest,
  validateStep,
  type WizardErrors,
  type WizardFeatures,
  type WizardState,
} from "./wizard-state";

/**
 * Un titre et un sous-titre par étape — SIX entrées pour six étapes. Une liste
 * plus courte que `WIZARD_STEPS` ferait silencieusement retomber la dernière
 * étape sur le titre de la première.
 */
const STEP_META: { title: string; subtitle: string }[] = [
  {
    title: "Quel type de bien souhaitez-vous estimer ?",
    subtitle: "Un logement et un local professionnel ne se valorisent pas de la même façon.",
  },
  {
    title: "Précisons la famille du bien",
    subtitle: "Nous n'afficherons ensuite que les questions utiles à ce type.",
  },
  {
    title: "Où se situe-t-il ?",
    subtitle: "L'adresse détermine les ventes que nous allons comparer.",
  },
  {
    title: "Décrivez le bien",
    subtitle: "Un champ facultatif peut rester vide : mieux vaut vide qu'approximatif.",
  },
  {
    title: "Pourquoi souhaitez-vous connaître sa valeur ?",
    subtitle: "Une question, et vous y êtes presque.",
  },
  {
    title: "Où envoyons-nous l'estimation ?",
    subtitle: "Dernière étape avant le calcul.",
  },
];

type SubmitStatus = "idle" | "submitting" | "error";

export interface EstimatorWizardProps {
  /** Remonte le résultat à la page, qui décide de son affichage. */
  onResult: (result: ValuationResult) => void;
}

export function EstimatorWizard({ onResult }: EstimatorWizardProps) {
  const searchParams = useSearchParams();

  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const initialised = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Reprendre une session, puis laisser la query string combler ce qu'elle peut.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const stored = loadWizardState();
    const base = stored ?? INITIAL_STATE;
    const next = applySearchParams(base, new URLSearchParams(searchParams.toString()));
    setState(next);
    setRestored(Boolean(stored) && (stored?.step ?? 0) > 0);
    setHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (hydrated) saveWizardState(state);
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const updateFeatures = useCallback((patch: Partial<WizardFeatures>) => {
    setState((current) => ({ ...current, features: { ...current.features, ...patch } }));
  }, []);

  const focusStep = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Le focus va sur le titre d'étape : c'est ce qui annonce le changement à
    // un lecteur d'écran, que le défilement ne dit pas.
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  const submit = useCallback(async () => {
    const request = toValuationRequest(state);
    if (!request) {
      setStatus("error");
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/estimation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error(`estimation_failed_${response.status}`);

      const result = (await response.json()) as ValuationResult;
      if (!result.id) throw new Error("estimation_missing_id");

      // Le contact est un effet de bord de l'estimation, jamais son péage :
      // un échec ici ne doit pas coûter son résultat à la personne.
      if (state.address) {
        const propertyType = resolvePropertyType(state);
        const livingArea = parseNumber(state.features.livingArea);
        const phone = state.contact.phone.replace(/[\s.\-()]/g, "");

        void fetch("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contact: {
              firstName: state.contact.firstName.trim(),
              email: state.contact.email.trim(),
              ...(phone ? { phone } : {}),
            },
            consents: state.consents,
            propertyType: propertyType ?? "other",
            city: state.address.city,
            cityCode: state.address.cityCode,
            ...(state.address.postcode ? { postcode: state.address.postcode } : {}),
            ...(livingArea !== undefined ? { livingArea } : {}),
            intent: state.intent ?? "other",
            valuation: result,
          }),
        }).catch(() => undefined);
      }

      clearWizardState();
      onResult(result);
    } catch {
      setStatus("error");
      window.requestAnimationFrame(() => errorRef.current?.focus());
    }
  }, [onResult, state]);

  const goNext = useCallback(() => {
    const stepErrors = validateStep(state.step, state);
    setErrors(stepErrors);

    if (Object.keys(stepErrors).length > 0) {
      window.requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    if (state.step === STEP_COUNT - 1) {
      void submit();
      return;
    }

    setState((current) => ({ ...current, step: current.step + 1 }));
    focusStep();
  }, [focusStep, state, submit]);

  const goBack = useCallback(() => {
    setErrors({});
    setStatus("idle");
    setState((current) => ({ ...current, step: Math.max(0, current.step - 1) }));
    focusStep();
  }, [focusStep]);

  const meta = STEP_META[state.step] ?? STEP_META[0];
  const errorList = Object.values(errors);
  const isLast = state.step === STEP_COUNT - 1;
  const submitting = status === "submitting";

  const stepProps = { state, errors, update, updateFeatures };

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progression — honnête : six étapes, aucun « presque fini » fabriqué.
          Deux indicateurs, une seule vérité : le rail numéroté sur grand écran,
          la jauge compacte sur mobile, et ils disent exactement la même chose. */}
      <div className="flex flex-col gap-4">
        <div className="hidden md:block">
          <Stepper steps={[...WIZARD_STEPS]} current={state.step} />
        </div>
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink">{WIZARD_STEPS[state.step]}</p>
            <p className="tnum text-xs text-ink-muted">
              Étape {state.step + 1} sur {STEP_COUNT}
            </p>
          </div>
          <Progress
            value={state.step + 1}
            max={STEP_COUNT}
            label={`Progression : étape ${state.step + 1} sur ${STEP_COUNT}`}
          />
        </div>
      </div>

      {restored && state.step > 0 ? (
        <p className="mt-5 flex items-center gap-2 rounded-md bg-primary-soft px-4 py-2.5 text-sm text-primary-soft-fg">
          <History aria-hidden="true" className="size-4 shrink-0" />
          Nous avons repris votre saisie là où vous l&apos;aviez laissée.
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // Sur l'étape d'adresse, la touche Entrée appartient à la combobox
          // tant qu'aucune adresse n'a été réellement choisie.
          if (state.step === 2 && !state.address) return;
          goNext();
        }}
        className="mt-6 rounded-lg border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-col gap-6 p-5 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl leading-tight text-ink outline-none sm:text-[1.75rem]"
            >
              {meta?.title}
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">{meta?.subtitle}</p>
          </div>

          <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="outline-none">
            {errorList.length > 0 ? (
              <div className="animate-fade-in flex gap-3 rounded-md border border-danger bg-danger-soft px-4 py-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
                <div className="flex flex-col gap-1 text-sm text-danger-soft-fg">
                  <p className="font-semibold">
                    {errorList.length === 1
                      ? "Une information manque pour continuer"
                      : `${errorList.length} informations manquent pour continuer`}
                  </p>
                  <ul className="flex list-disc flex-col gap-0.5 pl-4">
                    {errorList.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="animate-fade-in flex flex-col gap-3 rounded-md border border-danger bg-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
                  <div className="text-sm text-danger-soft-fg">
                    <p className="font-semibold">Le calcul n&apos;a pas abouti</p>
                    <p>
                      Nous n&apos;avons pas réussi à joindre le moteur d&apos;estimation. Vos réponses
                      conservées, vous pouvez réessayer immédiatement.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void submit()}>
                  Réessayer
                </Button>
              </div>
            ) : null}
          </div>

          {submitting ? (
            <div aria-live="polite" className="flex flex-col items-center gap-4 py-16 text-center">
              <Spinner size="lg" />
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-ink">
                  Nous analysons les ventes enregistrées autour du bien…
                </p>
                <p className="text-sm text-ink-muted">
                  Recherche des comparables, pondération, calcul de la fourchette.
                </p>
              </div>
            </div>
          ) : (
            <div key={state.step} className="animate-fade-up">
              {state.step === 0 ? <StepUsage {...stepProps} /> : null}
              {state.step === 1 ? <StepType {...stepProps} /> : null}
              {state.step === 2 ? <StepAddress {...stepProps} /> : null}
              {state.step === 3 ? <StepFeatures {...stepProps} /> : null}
              {state.step === 4 ? <StepIntent {...stepProps} /> : null}
              {state.step === 5 ? <StepContact {...stepProps} /> : null}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center gap-3 rounded-b-lg border-t border-border bg-surface/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={state.step === 0 || submitting}
            className="shrink-0"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Retour
          </Button>

          <Button type="submit" size="lg" loading={submitting} className="ml-auto min-w-40">
            {isLast ? (
              <>
                <Sparkles aria-hidden="true" className="size-4" />
                Obtenir l&apos;estimation
              </>
            ) : (
              <>
                Continuer
                <ArrowRight aria-hidden="true" className="size-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="mt-5 text-xs leading-relaxed text-ink-subtle">{disclaimers.short}</p>
    </div>
  );
}
