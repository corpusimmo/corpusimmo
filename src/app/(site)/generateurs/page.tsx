import type { Metadata } from "next";
import Link from "next/link";
import { FileStack, Lock, Shield, Sparkles, Table2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TelechargerTrame } from "@/components/generateurs/telecharger-trame";
import { CHARTE_CORPUSIMMO } from "@/lib/brand/charte";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  CONFIDENTIALITY_LABELS,
  DOCUMENT_KINDS,
  SENSITIVE_FIELD_LABELS,
  sectionsFor,
} from "@/lib/generators/documents";

export const metadata: Metadata = pageMetadata({
  title: "Générateurs de documents",
  description:
    "Teaser, mémorandum, avis de valeur, pitch de mandat : ce qui les sépare, et des trames " +
    "à vos couleurs dont les chiffres sortent des ventes enregistrées.",
  path: "/generateurs",
  socialTitle: "Six documents, et ce qui les sépare",
});

/**
 * LE SOMMAIRE DES GÉNÉRATEURS.
 *
 * Cette page a deux tâches, et la première compte autant que la seconde.
 *
 * 1. LEVER LA CONFUSION. Teaser, mémorandum, avis de valeur et dossier de
 *    présentation se ressemblent en surface — des pages, un bien, des chiffres
 *    — et sont couramment employés l'un pour l'autre. Ils diffèrent en réalité
 *    sur l'audience, le moment, et ce qu'on a le DROIT d'y écrire. Chaque
 *    fiche porte donc son piège en toutes lettres, plutôt qu'une définition.
 *
 * 2. DIRE D'OÙ VIENNENT LES CHIFFRES. Les sections marquées « calculé » ne
 *    sont pas rédigées : elles sortent de nos moteurs. C'est ce qui sépare cet
 *    outil d'un habillage de modèle de langage, et ça doit se voir avant de
 *    cliquer.
 */
/**
 * LA PAGE EST STATIQUE, ET DOIT LE RESTER TANT QU'IL N'Y A PAS DE COMPTE.
 *
 * Elle a longtemps porté `force-dynamic`, pour lire la charte de la session et
 * ne jamais servir celle d'un compte à un autre visiteur. Il n'y a plus de
 * session : tout le monde voit la charte de CorpusImmo, donc plus rien à
 * isoler, et le rendu dynamique ne coûtait qu'une fonction par visite.
 *
 * Le jour où les comptes reviennent, ce n'est PAS `force-dynamic` qu'il faudra
 * remettre en tête de page : la personnalisation devra vivre dans un morceau
 * client ou dans un segment à part, pour que la page reste servie depuis le
 * cache et que ses métadonnées continuent d'être calculées à la construction.
 */
export default async function GenerateursPage() {
  const charte = CHARTE_CORPUSIMMO;

  return (
    <div className="bg-canvas pb-14">
      <header className="relative isolate overflow-hidden bg-primary">
        <div className="container-page py-12 md:py-16">
          <p className="eyebrow-text text-[color:var(--accent-rule)]">
            Générateurs
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight text-white md:text-5xl">
            Six documents, et ce qui les sépare
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/80">
            Teaser, mémorandum, avis de valeur&nbsp;: on les confond souvent, et
            l&apos;erreur se paie. Chacun a son audience, son moment, et ce
            qu&apos;on a le droit d&apos;y écrire.
          </p>
        </div>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,var(--accent-rule),var(--accent),var(--accent-rule))]"
        />
      </header>

      <div className="container-page">
        {/* Les deux régimes. Annoncés AVANT le catalogue : ils déterminent ce
            qu'on obtient, et le second n'est pas encore ouvert. */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="panel flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2">
              <Table2 aria-hidden className="size-4 text-ink-muted" />
              <h2 className="font-display text-lg font-semibold text-ink">
                Trames et modèles
              </h2>
              <Badge tone="success" size="sm">
                Disponible
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              Un dossier complet à vos couleurs&nbsp;: couverture, sommaire,
              une page par section dans l&apos;ordre de la pratique française,
              et le contact pour finir. Chaque page arrive avec la forme que son
              contenu demande, tableau pour un rent roll, deux volets pour des
              forces et des faiblesses, pavés d&apos;indicateurs pour une
              synthèse de marché.
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">
              Et chaque page porte ses notes&nbsp;: ce qu&apos;on y attend, dans
              quel ordre, et le piège du document. Les zones, elles, restent
              vides. Vous gardez la main sur la rédaction, ce que préfèrent la
              plupart des professionnels expérimentés.
            </p>
          </article>

          <article className="panel flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-ink-muted" />
              <h2 className="font-display text-lg font-semibold text-ink">
                Dossier complet
              </h2>
              <Badge tone="neutral" size="sm">
                En préparation
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              Le document rédigé de bout en bout à partir de votre formulaire et
              de vos pièces jointes. La rédaction habille des valeurs déjà
              vérifiées&nbsp;: aucun chiffre publié ne sort d&apos;un modèle de
              langage.
            </p>
          </article>
        </section>

        {/* La règle, posée une fois, en évidence. */}
        <p className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink-muted">
          <Shield aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            <strong className="font-semibold text-ink">
              L&apos;intelligence artificielle n&apos;écrit jamais un chiffre.
            </strong>{" "}
            Comparables, médianes, évolution et zonage sont calculés par nos
            moteurs à partir des ventes enregistrées, puis injectés tels quels.
            Sur un avis de valeur, qui engage votre signature, une valeur
            inventée serait une faute.
          </span>
        </p>

        {/* ── LE CATALOGUE ────────────────────────────────────────────────── */}
        <h2 className="mt-12 font-display text-2xl text-ink">
          Quel document, pour qui&nbsp;?
        </h2>

        <ul className="mt-6 grid gap-5 lg:grid-cols-2">
          {DOCUMENT_KINDS.map((kind) => {
            const confidentiality = CONFIDENTIALITY_LABELS[kind.confidentiality];
            const sections = sectionsFor(kind);

            return (
              <li key={kind.id} className="panel flex flex-col gap-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-semibold text-ink">
                    {kind.label}
                  </h3>
                  <Badge
                    tone={
                      kind.confidentiality === "anonyme"
                        ? "warning"
                        : kind.confidentiality === "sous-nda"
                          ? "accent"
                          : "neutral"
                    }
                    size="sm"
                  >
                    {kind.confidentiality !== "nominatif" ? (
                      <Lock aria-hidden className="size-3" />
                    ) : null}
                    {confidentiality.label}
                  </Badge>
                  <span className="text-xs text-ink-subtle">{kind.pages}</span>
                </div>

                <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                    Pour qui
                  </dt>
                  <dd className="text-ink-muted">{kind.audience}</dd>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                    Quand
                  </dt>
                  <dd className="text-ink-muted">{kind.moment}</dd>
                </dl>

                {/* Le piège plutôt qu'une définition : c'est la phrase qui
                    évite réellement la confusion. */}
                <p className="prose-justifiee rounded-sm bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink-muted">
                  {kind.pitfall}
                </p>

                {kind.notToConfuse ? (
                  <p className="text-xs leading-relaxed text-ink-subtle">
                    <span className="font-semibold">À ne pas confondre.</span>{" "}
                    {kind.notToConfuse}
                  </p>
                ) : null}

                {kind.forbiddenFields.length > 0 ? (
                  <p className="text-xs leading-relaxed text-ink-subtle">
                    <span className="font-semibold text-ink">
                      Champs non proposés
                    </span>{" "}
                    <span className="text-ink-subtle">
                      (absents du formulaire, pas seulement décochés)&nbsp;:
                    </span>{" "}
                    {kind.forbiddenFields
                      .map((field) => SENSITIVE_FIELD_LABELS[field])
                      .join(", ")}
                    .
                  </p>
                ) : null}

                <div className="mt-auto">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                    Sections
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {sections.map((section) => (
                      <li
                        key={section.id}
                        className={
                          section.computed
                            ? "rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-soft-fg"
                            : "rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink-muted"
                        }
                      >
                        {section.label}
                        {section.computed ? " · calculé" : ""}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
                  <TelechargerTrame kind={kind} charte={charte} />
                  <span className="text-xs text-ink-subtle">
                    {charte.parDefaut
                      ? "Aux couleurs de CorpusImmo. Renseignez votre charte pour la vôtre."
                      : `Aux couleurs de ${charte.entreprise}.`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
          <FileStack aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Les sections en doré sont alimentées par les ventes réellement
            enregistrées&nbsp;: elles ne sont pas rédigées, elles sont
            calculées. Les autres viennent de votre formulaire et de vos pièces.
          </span>
        </p>

        <p className="mt-10 text-sm text-ink-muted">
          Besoin d&apos;un calcul plutôt que d&apos;un document&nbsp;?{" "}
          <Link href="/outils" className="font-semibold text-primary underline">
            Voir les matrices Excel
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
