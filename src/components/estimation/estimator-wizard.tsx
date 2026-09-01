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

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, History, MapPin, Sparkles } from "lucide-react";

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
  ADDRESS_STEP,
  INITIAL_STATE,
  WIZARD_STEPS,
  clearWizardState,
  isLastStep,
  loadWizardState,
  nextStep,
  parseNumber,
  previousStep,
  resolveEntry,
  resolvePropertyType,
  saveWizardState,
  toValuationRequest,
  validateStep,
  visibleSteps,
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Renseigné quand une saisie en cours et une nouvelle adresse se
   * contredisent. Le parcours pose alors la question au lieu d'écraser.
   */
  const [conflict, setConflict] = useState<{ draft: WizardState; fresh: WizardState } | null>(null);

  const initialised = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Reprendre une session, puis laisser le lien combler ce qu'il peut. Quand
  // les deux se contredisent, on n'arbitre pas : on demande.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const stored = loadWizardState();
    const outcome = resolveEntry(stored, new URLSearchParams(searchParams.toString()));

    setState(outcome.state);
    setConflict(outcome.conflict ?? null);
    setRestored(!outcome.conflict && Boolean(stored) && (stored?.step ?? 0) > 0);
    setHydrated(true);
  }, [searchParams]);

  // Tant que le conflit n'est pas tranché, on n'écrit rien : sauvegarder
  // reviendrait à choisir à la place de la personne.
  useEffect(() => {
    if (hydrated && !conflict) saveWizardState(state);
  }, [state, hydrated, conflict]);

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

  /**
   * Le choix tranché. On retire l'adresse de l'URL au passage : sans ça, un
   * rechargement reposerait la même question, et « reprendre » se ferait
   * écraser au premier F5.
   */
  const settle = useCallback(
    (chosen: WizardState) => {
      setConflict(null);
      setState(chosen);
      saveWizardState(chosen);
      router.replace("/estimer", { scroll: false });
      focusStep();
    },
    [focusStep, router],
  );

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

    if (isLastStep(state)) {
      void submit();
      return;
    }

    setState((current) => ({ ...current, step: nextStep(current) }));
    focusStep();
  }, [focusStep, state, submit]);

  const goBack = useCallback(() => {
    setErrors({});
    setStatus("idle");
    setState((current) => ({ ...current, step: previousStep(current) }));
    focusStep();
  }, [focusStep]);

  /** Rouvre l'étape d'adresse : la personne veut estimer un autre bien. */
  const unlockAddress = useCallback(() => {
    setErrors({});
    setState((current) => ({ ...current, addressLocked: false, step: ADDRESS_STEP }));
    focusStep();
  }, [focusStep]);

  const meta = STEP_META[state.step] ?? STEP_META[0];
  const errorList = Object.values(errors);
  const isLast = isLastStep(state);
  const submitting = status === "submitting";

  // Les étapes réellement posées. Quand l'adresse est déjà connue, le parcours
  // en compte cinq et l'affiche : annoncer six écrans pour n'en montrer que
  // cinq serait un compte faux, dans le sens qui arrange, ce que ce parcours
  // s'interdit ailleurs sur les prix.
  const steps = visibleSteps(state);
  const position = Math.max(0, steps.indexOf(state.step));

  const stepProps = { state, errors, update, updateFeatures };

  if (conflict) {
    return (
      <ResumeOrRestart
        draft={conflict.draft}
        fresh={conflict.fresh}
        onResume={() => settle(conflict.draft)}
        onRestart={() => settle(conflict.fresh)}
      />
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progression, honnête : aucun « presque fini » fabriqué. Deux
          indicateurs, une seule vérité : le rail numéroté sur grand écran, la
          jauge compacte sur mobile, et ils disent exactement la même chose. */}
      <div className="flex flex-col gap-4">
        <div className="hidden md:block">
          <Stepper steps={steps.map((index) => WIZARD_STEPS[index] ?? "")} current={position} />
        </div>
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink">{WIZARD_STEPS[state.step]}</p>
            <p className="tnum text-xs text-ink-muted">
              Étape {position + 1} sur {steps.length}
            </p>
          </div>
          <Progress
            value={position + 1}
            max={steps.length}
            label={`Progression : étape ${position + 1} sur ${steps.length}`}
          />
        </div>
      </div>

      {state.addressLocked && state.address ? (
        <div className="mt-5 flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-w-0 items-start gap-2 text-sm text-ink">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-rule" />
            <span className="min-w-0">
              <span className="text-ink-muted">Bien à estimer&nbsp;:</span>{" "}
              <strong className="font-medium">{state.address.label}</strong>
            </span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={unlockAddress} className="shrink-0">
            Changer d&apos;adresse
          </Button>
        </div>
      ) : null}

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

        {/* Les deux actions tiennent côte à côte dès 360 px. En dessous, elles
            ne tiennent PAS : « Retour » et « Obtenir l'estimation » réclament
            ensemble 343 px là où l'écran en offre 280, et les libellés d'un
            bouton ne se coupent pas en deux. La rangée passe donc en colonne,
            plutôt que de laisser le bouton principal sortir de l'écran — un
            débordement masqué reste un bouton qu'on ne peut pas atteindre. */}
        <div className="sticky bottom-0 flex flex-col gap-3 rounded-b-lg border-t border-border bg-surface/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur min-[360px]:flex-row min-[360px]:items-center sm:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={state.step === 0 || submitting}
            // `self-start` en colonne : un « Retour » étiré sur toute la
            // largeur pèserait autant que l'action principale posée en
            // dessous, alors qu'il ne fait que revenir en arrière.
            className="shrink-0 self-start min-[360px]:self-auto"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Retour
          </Button>

          <Button
            type="submit"
            size="lg"
            loading={submitting}
            className="min-w-40 min-[360px]:ml-auto"
          >
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


/**
 * REPRENDRE OU RECOMMENCER.
 *
 * Une estimation en cours vaut cinq écrans de saisie. Une nouvelle adresse
 * arrivée depuis l'accueil vaut une intention explicite. Les deux sont
 * légitimes, et rien dans le code ne permet de deviner laquelle prime : on
 * demande, une fois, plutôt que d'écraser en silence.
 *
 * L'écran ne propose pas de troisième voie ni de croix de fermeture : sortir
 * sans choisir laisserait le parcours dans un état que personne n'a demandé.
 */
function ResumeOrRestart({
  draft,
  fresh,
  onResume,
  onRestart,
}: {
  draft: WizardState;
  fresh: WizardState;
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-8">
      <span className="eyebrow flex items-center gap-1.5">
        <History aria-hidden="true" className="size-3.5" />
        Une estimation est déjà commencée
      </span>

      <h2 className="mt-2 font-display text-2xl leading-tight text-ink">
        Reprendre celle en cours, ou en commencer une nouvelle&nbsp;?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Vous aviez commencé une estimation, et vous venez d&apos;en lancer une autre pour une
        adresse différente. Nous ne remplaçons rien sans vous le demander.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Choice
          title="Reprendre l'estimation en cours"
          address={draft.address?.label ?? "Adresse non renseignée"}
          detail={`Saisie déjà commencée${
            draft.step > 0 ? `, arrêtée à l'étape « ${WIZARD_STEPS[draft.step] ?? ""} »` : ""
          }.`}
          action={
            <Button type="button" variant="secondary" fullWidth onClick={onResume}>
              Reprendre
            </Button>
          }
        />
        <Choice
          title="Commencer une nouvelle estimation"
          address={fresh.address?.label ?? "Adresse non renseignée"}
          detail="La saisie en cours sera remplacée."
          action={
            <Button type="button" fullWidth onClick={onRestart}>
              Commencer
            </Button>
          }
        />
      </div>
    </div>
  );
}

function Choice({
  title,
  address,
  detail,
  action,
}: {
  title: string;
  address: string;
  detail: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="flex items-start gap-1.5 text-sm text-ink">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-rule" />
          <span className="min-w-0">{address}</span>
        </p>
        <p className="text-xs leading-relaxed text-ink-subtle">{detail}</p>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  );
}
