import Image from "next/image";
import Link from "next/link";

import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import { Button } from "@/components/ui";
import {
  buildEstimatorHref,
  type PropertyUsage,
} from "@/components/estimation/wizard-state";

/**
 * LES TYPOLOGIES QUE LE CORPUS COUVRE, EN IMAGES.
 *
 * Le site refuse la porte « Particuliers / Professionnels » : ce bandeau est
 * ce qui la remplace. Neuf typologies, du studio à l'entrepôt, dans une seule
 * rangée, parce que c'est un seul corpus.
 *
 * CE NE SONT PAS DES BOUTONS, ET C'EST LE POINT. Chaque vignette a longtemps
 * été un lien, avec sa flèche et sa pastille de couleur, ce qui promettait dix
 * destinations. Il n'y en a jamais eu que deux : l'estimateur en résidentiel,
 * l'estimateur en professionnel. Cliquer « Entrepôt » ouvrait exactement le
 * même écran que cliquer « Bureaux ». Une flèche qui ne mène pas où elle a
 * l'air de mener use la confiance pour rien.
 *
 * Les vignettes redeviennent donc ce qu'elles sont, des images légendées, et
 * les deux vraies portes sont posées dessous, nommées.
 *
 * LES IMAGES SONT DES ILLUSTRATIONS, PAS DES BIENS. Elles sont générées d'après
 * les prompts de `docs/images.md`, sans adresse identifiable, sans texte, sans
 * visage, et leur `alt` le dit : « illustration : façade haussmannienne »,
 * jamais « appartement à Lyon ». Aucune ne voisine un prix : la règle est
 * écrite dans `docs/images.md`, elle vaut pour ce bandeau comme pour le reste.
 *
 * LE DÉFILEMENT HORIZONTAL est volontaire à toutes les largeurs : neuf cartes
 * en grille prendraient trois rangs sur mobile, et l'accueil est déjà long.
 * Un rang qui déborde se lit comme un rang, et l'accrochage des cartes
 * (`snap`) fait que le doigt s'arrête toujours sur une carte entière.
 */

type Typology = {
  icon: AssetIconName;
  label: string;
  /** Ce que montre l'image, honnêtement : c'est le texte alternatif. */
  illustration: string;
  src: string;
  usage: PropertyUsage;
};

const TYPOLOGIES: readonly Typology[] = [
  {
    icon: "apartment",
    label: "Appartement",
    illustration: "façade haussmannienne en pierre de taille, balcons filants",
    src: "/illustrations/bien-appartement-ancien.webp",
    usage: "residential",
  },
  {
    icon: "house",
    label: "Maison",
    illustration: "pavillon des années 1970 sur sous-sol, volets roulants",
    src: "/illustrations/bien-maison.webp",
    usage: "residential",
  },
  {
    icon: "apartment",
    label: "Logement neuf",
    illustration:
      "immeuble résidentiel récent, balcons en loggia et dernier étage en retrait",
    src: "/illustrations/bien-appartement-recent.webp",
    usage: "residential",
  },
  {
    icon: "land",
    label: "Terrain",
    illustration: "parcelle à bâtir bornée de piquets, en lisière de village",
    src: "/illustrations/bien-terrain.webp",
    usage: "residential",
  },
  {
    icon: "building",
    label: "Immeuble",
    illustration:
      "immeuble de rapport de faubourg, brique et enduit, rideau métallique fermé",
    src: "/illustrations/bien-immeuble.webp",
    usage: "professional",
  },
  {
    icon: "office",
    label: "Bureaux",
    illustration:
      "immeuble de bureaux des années 2000, mur-rideau, plateaux allumés",
    src: "/illustrations/bien-bureaux.webp",
    usage: "professional",
  },
  {
    icon: "retail",
    label: "Commerce",
    illustration:
      "vitrine de pied d'immeuble sans enseigne, rue pavée de centre-ville",
    src: "/illustrations/bien-commerce.webp",
    usage: "professional",
  },
  {
    icon: "business_premises",
    label: "Local d’activité",
    illustration:
      "bâtiment d'activité en bardage gris, porte sectionnelle fermée",
    src: "/illustrations/bien-local-activite.webp",
    usage: "professional",
  },
  {
    icon: "warehouse",
    label: "Entrepôt",
    illustration:
      "entrepôt logistique, rangée de quais de chargement, cour de manœuvre",
    src: "/illustrations/bien-entrepot.webp",
    usage: "professional",
  },
  {
    icon: "parking",
    label: "Parking",
    illustration: "parking silo en béton brut, lumière rasante sur le plateau",
    src: "/illustrations/bien-parking.webp",
    usage: "residential",
  },
];

export function TypologyStrip() {
  return (
    <section
      aria-labelledby="typologies"
      className="border-b border-border bg-canvas"
    >
      <div className="container-page pt-14 md:pt-20">
        <div className="reveal flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Toutes les typologies</p>
            <h2
              id="typologies"
              className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
            >
              Un logement, un commerce, un plateau de bureaux&nbsp;: le même
              corpus
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">
              DVF enregistre toutes les mutations, pas seulement les logements&nbsp;:
              bureaux, commerces, entrepôts et terrains y figurent au même titre
              qu&apos;un appartement. L&apos;usage se choisit au début de
              l&apos;estimation, et la méthode suit&nbsp;: comparaison au mètre
              carré pour un logement, approche par le revenu pour un actif
              tertiaire, dont les ventes sont trop rares pour un prix au m².
            </p>
          </div>
          <p className="shrink-0 text-xs text-ink-subtle md:pb-1.5">
            Illustrations, pas des biens du corpus.
          </p>
        </div>
      </div>

      {/* La rangée déborde du conteneur à droite, et démarre alignée sur la
          marge : le bord tronqué de la dernière carte dit qu'il y a une suite. */}
      <div className="scroll-slim reveal-late mt-8 overflow-x-auto pb-8">
        <ul className="container-page flex w-max snap-x snap-mandatory gap-4 pr-5 md:pr-8">
          {TYPOLOGIES.map((typology) => (
            <li
              key={typology.label}
              className="w-[15.5rem] shrink-0 snap-start md:w-[17rem]"
            >
              <figure className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-3">
                  <Image
                    src={typology.src}
                    alt={`Illustration : ${typology.illustration}.`}
                    fill
                    sizes="(min-width: 768px) 272px, 248px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="flex items-center gap-2.5 px-4 py-3.5">
                  <AssetTypeIcon
                    name={typology.icon}
                    className="size-4 shrink-0 text-ink-subtle"
                  />
                  <span className="font-display text-lg leading-tight text-ink">
                    {typology.label}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>

      {/* Deux portes, parce qu'il y en a exactement deux : les deux branches
          de l'estimateur, qui ne partagent pas la même méthode. */}
      <div className="container-page flex flex-wrap gap-3 pb-14 md:pb-20">
        <Button asChild>
          <Link href={buildEstimatorHref(null, "residential")}>
            Estimer un logement
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={buildEstimatorHref(null, "professional")}>
            Estimer un local professionnel
          </Link>
        </Button>
      </div>
    </section>
  );
}
