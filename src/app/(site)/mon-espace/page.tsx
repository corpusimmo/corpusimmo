import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Clock,
  History,
  UserRound,
  Unlock,
} from "lucide-react";

import { EstimationHistory } from "@/components/account/estimation-history";
import { ProfileForm } from "@/components/account/profile-form";
import { SavedTools } from "@/components/account/saved-tools";
import { Button, PageHeader } from "@/components/ui";
import { getToolCard } from "@/data/tools-catalogue";
import { UNKNOWN_ACCESS, readAccess } from "@/lib/access/ledger";
import { currentUserId } from "@/lib/auth/current-user";
import { listEstimations, readProfile } from "@/lib/db";
import { attempt } from "@/lib/db/attempt";

import {
  clearEstimationsAction,
  forgetEstimationAction,
  saveProfileAction,
} from "./actions";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * MON ESPACE, sans compte.
 *
 * Trois choses s'y retrouvent, et elles ne vivent pas au même endroit :
 *   · les outils DÉBLOQUÉS, dans un cookie signé côté serveur. C'est ce qui
 *     rend le quota honnête : le compteur ne dépend pas de ce que le navigateur
 *     veut bien exécuter ;
 *   · les outils MIS DE CÔTÉ et les ESTIMATIONS, dans `localStorage`. Ce sont
 *     des conforts, pas des droits : les ranger côté serveur ferait basculer
 *     toute la bibliothèque en rendu dynamique pour un signet.
 *
 * La page le dit plutôt que de laisser croire à un compte : ce qui est ici est
 * lié à CE navigateur. Le jour où une base existe, la connexion Google devient
 * le porte-clés et la même page se remplit à l'identique.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Mon espace",
  description:
    "Les outils que vous avez ouverts, ceux que vous avez mis de côté, vos estimations et " +
    "vos accès de la semaine.",
  path: "/mon-espace",
  index: false,
});

export default async function MonEspacePage() {
  // Pour une personne connectée, l'historique vient de la base et suit d'un
  // appareil à l'autre. Sinon il reste dans le navigateur, et la page le dit.
  const userId = await currentUserId();

  /*
   * LES TROIS LECTURES PARTENT ENSEMBLE, et c'est ce qui décide si la page
   * s'affiche.
   *
   * Elles étaient enchaînées, chacune attendant la précédente. Sur une base
   * qui dort — Neon suspend une base inactive, et la réveiller coûte plusieurs
   * secondes — trois allers-retours en série suffisaient à dépasser le délai
   * de la fonction : pas d'erreur, pas de page, juste une requête qui ne
   * répond jamais. Elles ne dépendent pas les unes des autres, seulement de
   * `userId` : elles partent donc en même temps, et la page attend la plus
   * lente au lieu de leur somme.
   *
   * Chacune garde son garde-fou. `readAccess` rattrape déjà ses propres
   * pannes, mais pas celles qui viennent d'ailleurs — un rôle sans droits sur
   * `tool_unlocks` faisait tomber la page ENTIÈRE, alors que le profil et les
   * estimations n'en dépendent pas. Une lecture qui échoue se dit dans le
   * bandeau ; elle ne ferme pas la porte. Voir `lib/db/attempt.ts`.
   */
  const [accessRead, storedRead, profileRead] = await Promise.all([
    attempt("accès de la semaine", () => readAccess(), UNKNOWN_ACCESS),
    userId
      ? attempt(
          "historique des estimations",
          () => listEstimations(userId),
          null,
        )
      : Promise.resolve({ value: null, failed: false }),
    userId
      ? attempt("profil", () => readProfile(userId), null)
      : Promise.resolve({ value: null, failed: false }),
  ]);

  const access = accessRead.value;
  const stored = storedRead.value;
  const profile = profileRead.value;
  const degraded = accessRead.failed || storedRead.failed || profileRead.failed;
  const unlocked = access.unlocked
    .map((grant) => ({ grant, tool: getToolCard(grant.slug) }))
    .filter(
      (
        entry,
      ): entry is {
        grant: (typeof access.unlocked)[number];
        tool: NonNullable<ReturnType<typeof getToolCard>>;
      } => entry.tool !== undefined,
    );

  const renews = access.quota.renewsAt
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(access.quota.renewsAt)
    : null;

  return (
    <div className="bg-canvas py-8 md:py-12">
      <div className="container-page flex max-w-4xl flex-col gap-10">
        <PageHeader
          title="Mon espace"
          description={
            userId
              ? "Ce que vous avez ouvert, ce que vous avez mis de côté, et ce que vous avez estimé. Rattaché à votre compte, donc retrouvable sur tous vos appareils."
              : "Ce que vous avez ouvert, ce que vous avez mis de côté, et ce que vous avez estimé. Sans compte : tout est rattaché à ce navigateur."
          }
        />

        {degraded ? (
          <p
            role="status"
            className="rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning-soft-fg"
          >
            Une partie de vos données n&apos;a pas pu être relue à
            l&apos;instant. Rien n&apos;est perdu&nbsp;: rechargez la page dans
            un moment.
          </p>
        ) : null}

        {/* ----------------------------------------------------- le quota -- */}
        <section
          aria-labelledby="quota"
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6"
        >
          <h2
            id="quota"
            className="flex items-center gap-2 font-display text-xl text-ink"
          >
            <Clock aria-hidden="true" className="size-5 text-ink-subtle" />
            Vos accès de la semaine
          </h2>

          {access.enforced ? (
            <>
              <p className="tnum text-sm leading-relaxed text-ink-muted">
                <strong className="text-ink">
                  {access.quota.used} sur {access.quota.limit}
                </strong>{" "}
                outils ouverts sur les sept derniers jours.
                {access.quota.remaining > 0 ? (
                  <>
                    {" "}
                    Il vous en reste{" "}
                    <strong className="text-ink">
                      {access.quota.remaining}
                    </strong>
                    .
                  </>
                ) : renews ? (
                  <>
                    {" "}
                    Un crédit se libère le{" "}
                    <strong className="text-ink">{renews}</strong>.
                  </>
                ) : null}
              </p>
              <p className="text-sm leading-relaxed text-ink-subtle">
                La fenêtre glisse : elle ne se remet pas à zéro un lundi matin,
                chaque déblocage libère son crédit sept jours après lui. Rouvrir
                un outil déjà ouvert ne coûte rien, et mettre de côté non plus.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ink-muted">
              Le quota n&apos;est pas appliqué sur cet environnement : tous les
              outils sont ouverts.
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="secondary" size="sm">
              <Link href="/outils">
                Parcourir la bibliothèque
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* --------------------------------------- les outils débloqués -- */}
        <section aria-labelledby="debloques" className="flex flex-col gap-4">
          <div>
            <h2
              id="debloques"
              className="flex items-center gap-2 font-display text-xl text-ink"
            >
              <Unlock aria-hidden="true" className="size-5 text-ink-subtle" />
              Vos outils débloqués
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Ils le restent, sans limite de temps ni de nombre
              d&apos;ouvertures.
            </p>
          </div>

          {unlocked.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface-2 px-6 py-8 text-center text-sm text-ink-muted">
              Vous n&apos;avez encore ouvert aucun outil. Le premier est à une
              adresse e-mail.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {unlocked.map(({ grant, tool }) => (
                <li
                  key={tool.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/outils/${tool.id}`}
                      className="font-medium text-ink transition-colors hover:text-primary"
                    >
                      {tool.title}
                    </Link>
                    <p className="tnum mt-0.5 text-sm text-ink-subtle">
                      Ouvert le{" "}
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "long",
                      }).format(new Date(grant.at * 1000))}
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                  >
                    <Link href={`/outils/${tool.id}/calculer`}>
                      Rouvrir le calculateur
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------------------- les outils mis de côté -- */}
        <section aria-labelledby="signets" className="flex flex-col gap-4">
          <div>
            <h2
              id="signets"
              className="flex items-center gap-2 font-display text-xl text-ink"
            >
              <Bookmark aria-hidden="true" className="size-5 text-ink-subtle" />
              Mis de côté pour plus tard
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Repérer ne consomme aucun crédit. C&apos;est fait pour choisir où
              dépenser les deux de la semaine.
            </p>
          </div>

          <SavedTools unlocked={access.unlocked.map((grant) => grant.slug)} />
        </section>

        {/* ----------------------------------------------- le profil -- */}
        {userId ? (
          <section aria-labelledby="profil" className="flex flex-col gap-4">
            <div>
              <h2
                id="profil"
                className="flex items-center gap-2 font-display text-xl text-ink"
              >
                <UserRound
                  aria-hidden="true"
                  className="size-5 text-ink-subtle"
                />
                Vos informations
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Elles ne servent qu&apos;à vous adresser correctement, et à vous
                rappeler si vous le demandez. Le téléphone est facultatif.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-6">
              <ProfileForm
                initial={{
                  firstName: profile?.firstName ?? "",
                  lastName: profile?.lastName ?? "",
                  phone: profile?.phone ?? "",
                }}
                onSave={saveProfileAction}
              />
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------- les estimations -- */}
        <section aria-labelledby="estimations" className="flex flex-col gap-4">
          <div>
            <h2
              id="estimations"
              className="flex items-center gap-2 font-display text-xl text-ink"
            >
              <History aria-hidden="true" className="size-5 text-ink-subtle" />
              Vos estimations
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Chaque estimation terminée s&apos;ajoute ici, avec sa fourchette
              et le nombre de ventes qui la portent.{" "}
              {stored
                ? "Elles sont rattachées à votre compte."
                : "Elles restent dans ce navigateur tant que vous n'êtes pas connecté."}
            </p>
          </div>

          <EstimationHistory
            stored={stored}
            onForget={forgetEstimationAction}
            onClear={clearEstimationsAction}
          />
        </section>
      </div>
    </div>
  );
}
