import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, Clock, History, Unlock } from "lucide-react";

import { EstimationHistory } from "@/components/account/estimation-history";
import { SavedTools } from "@/components/account/saved-tools";
import { Button, PageHeader } from "@/components/ui";
import { getToolCard } from "@/data/tools-catalogue";
import { readAccess } from "@/lib/access/ledger";
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
  const access = await readAccess();
  const unlocked = access.unlocked
    .map((grant) => ({ grant, tool: getToolCard(grant.slug) }))
    .filter((entry): entry is { grant: (typeof access.unlocked)[number]; tool: NonNullable<ReturnType<typeof getToolCard>> } =>
      entry.tool !== undefined,
    );

  const renews = access.quota.renewsAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(
        access.quota.renewsAt,
      )
    : null;

  return (
    <div className="bg-canvas py-8 md:py-12">
      <div className="container-page flex max-w-4xl flex-col gap-10">
        <PageHeader
          title="Mon espace"
          description="Ce que vous avez ouvert, ce que vous avez mis de côté, et ce que vous avez estimé. Sans compte : tout est rattaché à ce navigateur."
        />

        {/* ----------------------------------------------------- le quota -- */}
        <section
          aria-labelledby="quota"
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="quota" className="flex items-center gap-2 font-display text-xl text-ink">
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
                    Il vous en reste <strong className="text-ink">
                      {access.quota.remaining}
                    </strong>.
                  </>
                ) : renews ? (
                  <>
                    {" "}
                    Un crédit se libère le <strong className="text-ink">{renews}</strong>.
                  </>
                ) : null}
              </p>
              <p className="text-sm leading-relaxed text-ink-subtle">
                La fenêtre glisse : elle ne se remet pas à zéro un lundi matin, chaque déblocage
                libère son crédit sept jours après lui. Rouvrir un outil déjà ouvert ne coûte rien,
                et mettre de côté non plus.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ink-muted">
              Le quota n&apos;est pas appliqué sur cet environnement : tous les outils sont ouverts.
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
              Ils le restent, sans limite de temps ni de nombre d&apos;ouvertures.
            </p>
          </div>

          {unlocked.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface-2 px-6 py-8 text-center text-sm text-ink-muted">
              Vous n&apos;avez encore ouvert aucun outil. Le premier est à une adresse e-mail.
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
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                        new Date(grant.at * 1000),
                      )}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary" className="shrink-0">
                    <Link href={`/outils/${tool.id}/calculer`}>Rouvrir le calculateur</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------------------- les outils mis de côté -- */}
        <section aria-labelledby="signets" className="flex flex-col gap-4">
          <div>
            <h2 id="signets" className="flex items-center gap-2 font-display text-xl text-ink">
              <Bookmark aria-hidden="true" className="size-5 text-ink-subtle" />
              Mis de côté pour plus tard
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Repérer ne consomme aucun crédit. C&apos;est fait pour choisir où dépenser les deux de
              la semaine.
            </p>
          </div>

          <SavedTools unlocked={access.unlocked.map((grant) => grant.slug)} />
        </section>

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
              Chaque estimation terminée s&apos;ajoute ici, avec sa fourchette et le nombre de
              ventes qui la portent.
            </p>
          </div>

          <EstimationHistory />
        </section>
      </div>
    </div>
  );
}
