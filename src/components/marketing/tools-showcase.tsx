import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Layers,
  Map as MapIcon,
  Scale,
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
    kicker: "Estimation",
    fond: "/illustrations/carte-estimation.webp",
    title: "Estimer un bien",
    body: "Six questions, puis une fourchette calculée sur les ventes comparables du secteur, avec le détail de ce qui a été retenu et de ce qui a été écarté.",
    cta: "Lancer une estimation",
  },
  {
    href: "/observatoire",
    icon: MapIcon,
    kicker: "Cartographie",
    fond: "/illustrations/carte-cartographie.webp",
    title: "L'observatoire",
    body: "La carte de toutes les mutations enregistrées, à l'échelle de la rue, et la même donnée augmentée : médianes au m², volumes, dispersion, table de recherche et sélection de comparables.",
    cta: "Explorer le marché",
  },
  {
    href: "/prix-immobilier",
    icon: Building2,
    kicker: "Références",
    fond: "/illustrations/carte-references.webp",
    title: "Le prix, commune par commune",
    body: "Cent communes documentées : médianes par type de bien, volumes, évolution entre deux millésimes, et le nombre de ventes qui fonde chaque chiffre.",
    cta: "Voir les communes",
  },
  {
    href: "/outils",
    icon: Layers,
    kicker: "Outils",
    fond: "/illustrations/carte-calculs.webp",
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

      {/*
        PAS DE CARTES. C'est un choix, et le seul point de cette grille.

        Quatre boîtes arrondies, ombrées, chacune ouverte par une icône dans
        une pastille ronde et fermée par un lien fléché : c'est la composition
        que tout générateur produit, et elle se reconnaît au premier coup
        d'œil. Elle avait en plus un défaut mesurable ici, quatre éléments dans
        une grille de trois colonnes laissant une case vide au dernier rang.

        Ce qui la remplace est un SOMMAIRE, en deux colonnes qui tombent
        juste. Chaque entrée s'ouvre sur un filet et son surtitre, qui dit sa
        nature plutôt que de la décorer, et l'icône se retire à l'extrémité de
        ce filet. Le filet est la seule chose qui bouge au survol : il passe à
        l'accent et s'épaissit. Aucune ombre, aucun cadre, aucun fond.
      */}
      <ul className="reveal-late mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2 md:gap-x-16">
        {ENTRIES.map((entry) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              className={
                // LE TEXTE NE DÉBORDE JAMAIS SUR LA PHOTOGRAPHIE. La réserve
                // de droite est posée ici, sur le lien, plutôt que sur chaque
                // élément de texte : une seule règle, et rien ne peut lui
                // échapper le jour où l'on ajoute une ligne.
                "group relative isolate flex h-full flex-col gap-3 overflow-hidden " +
                "rounded-lg border-t-2 border-border px-5 pt-5 pb-6 pr-[46%]"
              }
            >
              {/* LA PLAQUE RÉPOND AU SURVOL, sur les quatre entrées.
                  Elle était figée sur la première, ce qui la désignait comme
                  l'entrée principale : les quatre ont le même poids, et la
                  matière doit récompenser le geste plutôt que hiérarchiser.
                  Le filet neutre reste dessous, si bien que rien ne bouge en
                  hauteur quand la plaque apparaît. */}
              <span
                aria-hidden="true"
                className="plaque-metal absolute inset-x-0 -top-0.5 h-[3px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              {/* ── LA PHOTOGRAPHIE, ET POURQUOI ELLE NE PASSE PAS SOUS LE TEXTE
                  ──────────────────────────────────────────────────────────
                  Première tentative : l'image en fond de carte, couverte d'un
                  voile et d'un dégradé de lecture. Mesuré sur les pixels
                  peints, le point le plus sombre de la bande de texte donnait
                  2,9:1 avec l'encre secondaire, sous le seuil de 4,5. Il a
                  fallu renforcer le voile jusqu'à 5,4:1, et à ce compte la
                  photographie avait presque disparu. Un fond qu'on doit
                  effacer pour pouvoir lire n'est plus un fond, c'est une
                  tache.

                  Elle occupe donc la DROITE, sur un peu plus de la moitié de
                  la carte, et s'efface vers la gauche par un masque. Le texte
                  reste sur le fond plein du site : son contraste redevient
                  celui du reste de la page, sans mesure particulière, et la
                  photographie garde sa matière là où elle est visible.

                  Le cadrage des images sert exactement à cela : sujet à
                  droite, tiers gauche vide. C'est ce vide qui disparaît sous
                  le masque. */}
              <span
                aria-hidden="true"
                /* LE MASQUE FAIT DEUX CHOSES, ET LA SECONDE EST LA PLUS
                   IMPORTANTE. Il fond la photographie vers la gauche, et il
                   PLAFONNE son opacité à 72 % même à droite. Une image à
                   pleine force contre un fond plein donne une frontière que
                   le dégradé, si long soit-il, ne rattrape pas : c'est le
                   saut d'opacité qu'on voit, pas la position du dégradé.

                   La bande est aussi plus large que la réserve de texte, si
                   bien que la photographie commence sous le texte à six pour
                   cent : assez pour qu'il n'y ait plus de bord, trop peu pour
                   se voir. Le contraste a été remesuré à cette valeur. */
                className="absolute inset-y-0 right-0 -z-10 w-[72%] overflow-hidden [mask-image:linear-gradient(90deg,transparent_0%,rgb(0_0_0/0.06)_16%,rgb(0_0_0/0.22)_44%,rgb(0_0_0/0.5)_72%,rgb(0_0_0/0.72)_100%)]"
              >
                <Image
                  src={entry.fond}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 30vw, 60vw"
                  className="object-cover object-center"
                />
              </span>
              <span
                aria-hidden="true"
                className="plaque-metal absolute inset-x-0 -top-0.5 h-[3px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              {/* ── LA PHOTOGRAPHIE, ET LES DEUX COUCHES QUI LA RENDENT LISIBLE
                  ──────────────────────────────────────────────────────────
                  L'IMAGE RESTE À PLEINE OPACITÉ. Baisser l'opacité d'une photo
                  la fait virer au gris et lui retire sa matière ; c'est un
                  VOILE de couleur qui la couvre, et le voile, lui, garde sa
                  teinte. C'est la différence entre une image affaiblie et une
                  image derrière un calque.

                  LE DÉGRADÉ VIENT DE LA GAUCHE parce que le texte y est. Les
                  photographies ont été cadrées pour cela, sujet à droite et
                  tiers gauche vide : le dégradé n'a donc rien à masquer, il
                  ne fait qu'assurer le contraste là où il compte. */}
              {/* Le surtitre, un filet de liaison, puis l'icône : la ligne dit
                  la nature de l'entrée avant d'en dire le nom. */}
              <span className="flex items-center gap-3">
                <span className="eyebrow-text text-ink-subtle transition-colors duration-200 group-hover:text-accent">
                  {entry.kicker}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-border-strong/40"
                />
                <entry.icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-subtle transition-colors duration-200 group-hover:text-accent"
                />
              </span>

              <h3 className="font-display text-2xl leading-tight tracking-tight text-ink">
                {entry.title}
              </h3>
              <p className="flex-1 text-sm leading-relaxed text-ink-muted">
                {entry.body}
              </p>
              <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-primary">
                {entry.cta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-1"
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
