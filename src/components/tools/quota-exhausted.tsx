import Link from "next/link";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * Le refus, et la seule chose qui le rend acceptable : une date.
 *
 * Un mur qui dit « revenez plus tard » sans dire quand est un mur qui fait
 * partir. On donne donc le jour exact de réouverture, et on rappelle que mettre
 * de côté ne coûte aucun crédit — c'est ce qui permet de repérer sans dépenser.
 */
export function QuotaExhausted({ renewsAt, limit }: { renewsAt: Date | null; limit: number }) {
  const date = renewsAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(renewsAt)
    : null;

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-warning/25 bg-warning-soft p-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-1.5 !text-[color:var(--warning-soft-fg)]">
          <Clock aria-hidden="true" className="size-3.5" />
          Quota atteint
        </span>
        <h2 className="font-display text-xl text-warning-soft-fg">
          Vous avez ouvert vos {limit} outils de la semaine
        </h2>
        <p className="text-sm leading-relaxed text-warning-soft-fg/90">
          La bibliothèque est ouverte, pas illimitée&nbsp;: {limit} outils par semaine glissante.
          {date ? (
            <>
              {" "}
              Un crédit se libère le <strong>{date}</strong>.
            </>
          ) : null}
        </p>
        <p className="text-sm leading-relaxed text-warning-soft-fg/90">
          Les outils que vous avez déjà ouverts restent accessibles, sans limite et sans consommer
          quoi que ce soit.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/mon-espace">Voir ce que j&apos;ai déjà ouvert</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/outils">Repérer et mettre de côté</Link>
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-warning-soft-fg/80">
        Mettre un outil de côté ne coûte aucun crédit&nbsp;: parcourez la bibliothèque, marquez ce
        qui servira, et choisissez où dépenser.
      </p>
    </div>
  );
}
