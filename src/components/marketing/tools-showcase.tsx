import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Layers,
  Map as MapIcon,
  Scale,
  Table2,
} from "lucide-react";

import { Button } from "@/components/ui";
import { toolCatalogue } from "@/data/tools-catalogue";
import { getToolPreviews, type ToolPreviewShot } from "@/data/tool-previews";

/**
 * CE QUE LE SITE SAIT FAIRE, MONTRÉ AVANT D'ÊTRE EXPLIQUÉ.
 *
 * L'accueil parlait surtout de la méthode de l'estimateur. Or le produit, ce
 * sont QUATRE outils ouverts et dix calculateurs : commencer par la méthode
 * revenait à décrire le moteur d'une voiture avant d'avoir dit qu'elle roule.
 *
 * La preuve, ici, est une CAPTURE RÉELLE du classeur de rentabilité locative,
 * pas une maquette : elle vient de `public/outils/apercus/`, elle est datée et
 * annoncée comme telle sur la fiche de l'outil, et elle montre en une seconde
 * qu'il existe quelque chose derrière la promesse.
 *
 * Aucun chiffre de marché n'apparaît dans cette section. Le site est national,
 * et une médiane de commune posée sur l'accueil ferait croire à un service
 * local à tous ceux qui ne vivent pas dans cette commune-là.
 */

const ENTRIES = [
  {
    href: "/estimer",
    icon: Scale,
    title: "Estimer un bien",
    body: "Six questions, puis une fourchette calculée sur les ventes comparables du secteur, avec le détail de ce qui a été retenu et de ce qui a été écarté.",
    cta: "Lancer une estimation",
  },
  {
    href: "/carte",
    icon: MapIcon,
    title: "La carte des ventes",
    body: "Toutes les mutations enregistrées, à l'échelle de la rue. Prix, surface, date, type de bien. Plein écran, sans compte, sans limite de consultation.",
    cta: "Ouvrir la carte",
  },
  {
    href: "/observatoire",
    icon: Table2,
    title: "L'observatoire",
    body: "La même donnée, augmentée : prix médian au m², volumes, dispersion, recherche tabulaire et sélection de comparables qui vous suit d'un écran à l'autre.",
    cta: "Explorer le marché",
  },
  {
    href: "/prix-immobilier",
    icon: Building2,
    title: "Le prix, commune par commune",
    body: "Cent communes documentées : médianes par type de bien, volumes, évolution entre deux millésimes, et le nombre de ventes qui fonde chaque chiffre.",
    cta: "Voir les communes",
  },
  {
    href: "/outils",
    icon: Layers,
    title: "Dix outils de calcul",
    body: "Rentabilité locative, coût réel d'un prêt, arbitrage fiscal, DCF sur dix ans, charge foncière, WAULT… avec les barèmes affichés et modifiables.",
    cta: "Voir les outils",
  },
] as const;

/**
 * CHAQUE OUTIL AVEC SA CAPTURE, et jamais le fichier lui-même.
 *
 * Montrer le classeur réel prouve en une seconde ce qu'aucune description ne
 * prouve : qu'il existe, qu'il calcule, et à quoi il ressemble. Le classeur,
 * lui, ne se télécharge pas ici : la fiche de l'outil est le seul endroit où
 * il se récupère, avec ses avertissements et sa date.
 *
 * `getToolPreviews` peut légitimement rendre une liste vide : un outil sans
 * capture garde sa carte, avec le nom seul. Une vignette absente vaut mieux
 * qu'un cadre vide, et bien mieux qu'un build qui casse.
 */
/**
 * CINQ APERÇUS, PAS DIX, et une sixième case qui mène au reste.
 *
 * L'accueil montre assez pour qu'on voie de quoi il s'agit, et laisse à
 * `/outils` sa raison d'être : tout déballer ici viderait la bibliothèque de
 * son intérêt et allongerait la page d'un écran entier. Cinq et une, c'est
 * aussi une grille de six qui tombe juste sur deux rangs de trois.
 *
 * Le libellé de la sixième case nomme les cinq outils restants : il dépend
 * donc de ce nombre ET de l'ordre du catalogue. Les deux bougent ensemble.
 */
const HOME_PREVIEW_COUNT = 5;

const LIBRARY: Array<{
  id: string;
  title: string;
  shot: ToolPreviewShot | undefined;
}> = toolCatalogue.slice(0, HOME_PREVIEW_COUNT).map((tool) => ({
  id: tool.id,
  title: tool.title,
  shot: getToolPreviews(tool.id)[0],
}));

export function ToolsShowcase() {
  return (
    <section
      aria-labelledby="outils"
      className="container-page pt-16 pb-4 md:pt-20 md:pb-6"
    >
      <div className="reveal max-w-2xl">
        <p className="eyebrow">Quatre entrées, dix calculateurs</p>
        <h2
          id="outils"
          className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
        >
          Quatre outils ouverts, et dix calculateurs métier
        </h2>
        {/* Ni « tout est ouvert », ni le détail du quota : le premier est faux,
            le second n'a pas sa place dans une accroche. La règle d'accès se dit
            là où elle s'applique, sur la fiche de l'outil et au moment d'ouvrir
            un calculateur. */}
        <p className="mt-4 leading-relaxed text-ink-muted">
          L&apos;estimateur, la carte et l&apos;observatoire s&apos;utilisent
          librement, partout en France&nbsp;: un outil qu&apos;on ne peut pas
          essayer ne prouve rien. Les dix calculateurs reprennent les feuilles
          que les professionnels se transmettent, avec leurs barèmes affichés,
          modifiables et datés.
        </p>
      </div>

      {/* Quatre colonnes égales : une carte plus large que les autres laissait
          un trou dans la grille à partir de 1024 px. L'entrée principale se
          distingue par sa teinte et son filet, pas par sa taille. */}
      <ul className="reveal-late mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map((entry, index) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              className={
                "group relative flex h-full flex-col gap-4 overflow-hidden rounded-lg border border-border p-7 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md " +
                (index === 0 ? "bg-surface-3" : "bg-surface")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "absolute inset-x-0 top-0 h-0.5 origin-left bg-accent-rule transition-transform duration-300 ease-out group-hover:scale-x-100 " +
                  (index === 0 ? "scale-x-100" : "scale-x-0")
                }
              />
              <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
                <entry.icon aria-hidden="true" className="size-5" />
              </span>
              <div className="flex flex-1 flex-col gap-2">
                <h3 className="font-display text-xl leading-snug text-ink">
                  {entry.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-muted">
                  {entry.body}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {entry.cta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Les dix calculateurs, chacun avec l'aperçu de son classeur. Une
          grille de vignettes se vérifie ; une promesse de « nombreux outils »
          ne se vérifie pas. */}
      <div className="panel reveal mt-6 px-6 py-10 md:px-10 md:py-12">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">La bibliothèque</p>
            <h3 className="mt-3 font-display text-2xl leading-tight text-ink md:text-3xl">
              Les calculs que les professionnels font sur tableur, en ligne et
              datés
            </h3>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Chaque outil affiche ses barèmes, les laisse modifier, et dit ce
              qu&apos;il ne sait pas calculer. Chacun double un classeur, dont
              voici l&apos;aperçu réel.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/outils">
              Ouvrir la bibliothèque
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {LIBRARY.map((tool) => (
            <li key={tool.id}>
              <Link
                href={`/outils/${tool.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
              >
                {/* `object-top` : une capture de tableur se reconnaît par son
                    en-tête et ses premières lignes, jamais par son milieu. */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                  {tool.shot ? (
                    <Image
                      src={tool.shot.src}
                      alt={`Aperçu du classeur : ${tool.title}, onglet « ${tool.shot.label} ».`}
                      fill
                      sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
                      className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <span className="flex flex-1 items-center px-3.5 py-3 text-sm leading-snug font-semibold text-ink">
                  {tool.title}
                </span>
              </Link>
            </li>
          ))}
          {/* La dernière case de la grille mène au reste : une grille qui
              s'arrête sans le dire laisse croire qu'il n'y a que six outils. */}
          <li>
            <Link
              href="/outils"
              className="group flex h-full min-h-[9rem] flex-col items-start justify-between gap-3 rounded-md border border-dashed border-border-strong bg-surface-2 p-4 transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <span className="text-sm leading-snug font-semibold text-ink">
                {toolCatalogue.length - HOME_PREVIEW_COUNT} autres calculateurs
              </span>
              <span className="text-xs leading-relaxed text-ink-muted">
                Avis de valeur, net vendeur, DCF, charge foncière, WAULT.
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Tout voir
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
          Aperçus réels des classeurs. Les matrices ont été révisées
          depuis&nbsp;: chaque fiche d&apos;outil le dit, et c&apos;est là que
          le classeur se récupère.
        </p>
      </div>
    </section>
  );
}
