import Image from "next/image";

import images from "@/data/cities/images.json";

/**
 * LA PHOTOGRAPHIE D'UNE COMMUNE, EMPRUNTÉE À WIKIPÉDIA.
 *
 * TROIS RÈGLES, ET AUCUNE N'EST NÉGOCIABLE.
 *
 * 1. LE CRÉDIT EST AFFICHÉ, toujours, sous l'image et non caché derrière une
 *    infobulle. Les licences Creative Commons exigent le nom de l'auteur, le
 *    nom de la licence et un lien vers elle : les trois sont là, et le lien
 *    vers le fichier permet de remonter à la source complète.
 *
 * 2. RIEN N'EST INVENTÉ QUAND L'IMAGE MANQUE. Onze communes sur cent n'ont
 *    pas d'image dont la licence soit vérifiable, ou pas d'auteur nommé. Elles
 *    n'affichent alors rien du tout, plutôt qu'une vue générique qui laisserait
 *    croire qu'on montre la commune. C'est la même règle que pour les chiffres.
 *
 * 3. LE TRI DES LICENCES A EU LIEU AILLEURS, dans `scripts/villes-images.mjs`,
 *    et une fois pour toutes. Ce composant ne juge rien : ce qui est dans le
 *    fichier de données a déjà été accepté, ce qui n'y est pas a été refusé.
 *
 * L'image est servie depuis Wikimedia, à travers l'optimiseur de Next : elle
 * est donc redimensionnée et mise en cache chez nous, et Wikimedia n'est
 * sollicité qu'une fois par format.
 */

interface ImageVille {
  url: string;
  largeur: number;
  hauteur: number;
  auteur: string;
  licence: string;
  licenceUrl: string | null;
  fichierUrl: string;
  article: string;
}

const CATALOGUE = images as Record<string, ImageVille>;

export function cityPhoto(slug: string): ImageVille | null {
  return CATALOGUE[slug] ?? null;
}

/**
 * LA PHOTOGRAPHIE EN FOND DE BANDEAU.
 *
 * TROIS COUCHES, ET CHACUNE FAIT UNE SEULE CHOSE.
 *
 *   la PHOTOGRAPHIE, à pleine opacité. Baisser l'opacité d'une image la fait
 *   virer au gris et lui retire sa matière ; c'est un voile qui la couvre, et
 *   le voile garde sa teinte.
 *
 *   le VOILE, en aplat de marine à 88 %. C'est lui qui donne au bandeau sa
 *   couleur et qui garantit le contraste du titre, quelle que soit la
 *   photographie qui passe dessous. Une image claire et une image sombre
 *   donnent le même fond.
 *
 *   le DÉGRADÉ, du plein à gauche vers le presque transparent à droite. Le
 *   texte est à gauche, la photographie se voit à droite, et il n'y a pas de
 *   bord entre les deux.
 *
 * LE CRÉDIT RESTE VISIBLE, en bas du bandeau. Ce n'est pas une politesse mais
 * une condition de la licence : l'auteur, la licence, un lien vers elle.
 * Le mettre en petit est permis, le cacher ne l'est pas.
 */
export function CityPhotoBanner({
  slug,
  name,
  children,
}: {
  slug: string;
  name: string;
  children: React.ReactNode;
}) {
  const photo = cityPhoto(slug);

  /* SANS PHOTOGRAPHIE, PAS DE BANDEAU SOMBRE. Onze communes sur cent n'en ont
     pas de licence vérifiable : leur en-tête reste sur le fond clair de la
     page plutôt que d'afficher un aplat de couleur qui promettrait une image
     absente. */
  if (!photo) return <>{children}</>;

  return (
    <div className="relative isolate overflow-hidden rounded-xl bg-primary text-ink-inverted">
      <Image
        src={photo.url}
        alt=""
        aria-hidden="true"
        fill
        sizes="(min-width: 1024px) 1000px, 100vw"
        className="-z-20 object-cover object-center"
        priority
      />
      {/* LE DÉGRADÉ EST ÉCRIT EN STYLE EN LIGNE, PAS EN CLASSE UTILITAIRE.
          En classe arbitraire, il ne peignait rien : le voile était absent et
          la photographie passait à pleine lumière sous le titre, ce qu'une
          mesure de contraste a fini par montrer. Un dégradé qui porte la
          lisibilité du titre ne doit pas dépendre de la génération d'une
          classe. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(100deg," +
            "var(--primary) 0%," +
            "var(--primary) 44%," +
            "color-mix(in srgb, var(--primary) 86%, transparent) 60%," +
            "color-mix(in srgb, var(--primary) 42%, transparent) 84%," +
            "color-mix(in srgb, var(--primary) 22%, transparent) 100%)",
        }}
      />
      <div className="px-6 pt-8 pb-10 md:px-10 md:pt-10">{children}</div>
      {/* LE CRÉDIT RESTE LISIBLE, MAIS IL NE PARLE PAS PLUS FORT QUE LA PAGE.
          La licence demande que l'auteur et la licence soient visibles, pas
          qu'ils occupent une barre pleine largeur. Il descend donc dans le coin
          bas droit, en corps très petit, et reprend de la densité au survol. */}
      <p className="absolute right-3 bottom-2 z-10 flex flex-wrap items-center justify-end gap-x-1 text-[0.625rem] leading-tight text-ink-inverted/45 transition-colors hover:text-ink-inverted/80 md:right-5">
        <span>{photo.auteur.split(",")[0]}</span>
        <span aria-hidden="true">·</span>
        {photo.licenceUrl ? (
          <a
            href={photo.licenceUrl}
            className="hover:underline hover:underline-offset-2"
            rel="noopener noreferrer license"
            target="_blank"
          >
            {photo.licence}
          </a>
        ) : (
          <span>{photo.licence}</span>
        )}
        <span aria-hidden="true">·</span>
        <a
          href={photo.fichierUrl}
          className="hover:underline hover:underline-offset-2"
          rel="noopener noreferrer"
          target="_blank"
        >
          Commons
        </a>
        <span className="sr-only">, photographie de {name}</span>
      </p>
    </div>
  );
}
