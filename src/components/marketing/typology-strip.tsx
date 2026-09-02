import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import { buildEstimatorHref, type PropertyUsage } from "@/components/estimation/wizard-state";

/**
 * LES TYPOLOGIES QUE LE CORPUS COUVRE, EN IMAGES.
 *
 * Le site refuse la porte « Particuliers / Professionnels » : ce bandeau est
 * ce qui la remplace. Neuf typologies, du studio à l'entrepôt, dans une seule
 * rangée, parce que c'est un seul corpus et une seule méthode.
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
    illustration: "immeuble résidentiel récent, balcons en loggia et dernier étage en retrait",
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
    illustration: "immeuble de rapport de faubourg, brique et enduit, rideau métallique fermé",
    src: "/illustrations/bien-immeuble.webp",
    usage: "professional",
  },
  {
    icon: "office",
    label: "Bureaux",
    illustration: "immeuble de bureaux des années 2000, mur-rideau, plateaux allumés",
    src: "/illustrations/bien-bureaux.webp",
    usage: "professional",
  },
  {
    icon: "retail",
    label: "Commerce",
    illustration: "vitrine de pied d'immeuble sans enseigne, rue pavée de centre-ville",
    src: "/illustrations/bien-commerce.webp",
    usage: "professional",
  },
  {
    icon: "business_premises",
    label: "Local d’activité",
    illustration: "bâtiment d'activité en bardage gris, porte sectionnelle fermée",
    src: "/illustrations/bien-local-activite.webp",
    usage: "professional",
  },
  {
    icon: "warehouse",
    label: "Entrepôt",
    illustration: "entrepôt logistique, rangée de quais de chargement, cour de manœuvre",
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
    <section aria-labelledby="typologies" className="border-b border-border bg-canvas">
      <div className="container-page pt-14 md:pt-20">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Un seul corpus</p>
            <h2
              id="typologies"
              className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
            >
              Un logement, un commerce, un plateau de bureaux&nbsp;: la même méthode
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">
              DVF enregistre toutes les mutations, pas seulement les logements. Le résidentiel et
              le professionnel vivent ici sous le même menu, et l&apos;usage est une question posée
              dans l&apos;outil, jamais une porte à l&apos;entrée.
            </p>
          </div>
          <p className="shrink-0 text-xs text-ink-subtle md:pb-1.5">
            Illustrations, pas des biens du corpus.
          </p>
        </div>
      </div>

      {/* La rangée déborde du conteneur à droite, et démarre alignée sur la
          marge : le bord tronqué de la dernière carte dit qu'il y a une suite. */}
      <div className="scroll-slim mt-8 overflow-x-auto pb-14 md:pb-20">
        <ul className="container-page flex w-max snap-x snap-mandatory gap-4 pr-5 md:pr-8">
          {TYPOLOGIES.map((typology) => (
            <li key={typology.label} className="w-[15.5rem] shrink-0 snap-start md:w-[17rem]">
              <Link
                href={buildEstimatorHref(null, typology.usage)}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-3">
                  <Image
                    src={typology.src}
                    alt={`Illustration : ${typology.illustration}.`}
                    fill
                    sizes="(min-width: 768px) 272px, 248px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                    <AssetTypeIcon name={typology.icon} className="size-5" />
                  </span>
                  <span className="flex-1 font-display text-lg leading-tight text-ink">
                    {typology.label}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
