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

export function CityPhoto({ slug, name }: { slug: string; name: string }) {
  const photo = cityPhoto(slug);
  if (!photo) return null;

  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface-3">
      <div className="relative aspect-[21/9] w-full">
        <Image
          src={photo.url}
          alt={`Vue de ${name}`}
          fill
          sizes="(min-width: 1024px) 900px, 100vw"
          className="object-cover"
          /* La photographie est en tête de page : elle ne se charge pas
             paresseusement, sinon elle arrive après le premier regard. */
          priority
        />
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 py-2.5 text-xs text-ink-subtle">
        <span>
          Photographie&nbsp;: <span className="text-ink-muted">{photo.auteur}</span>
        </span>
        <span aria-hidden="true">·</span>
        {photo.licenceUrl ? (
          <a
            href={photo.licenceUrl}
            className="underline decoration-border-strong underline-offset-2 hover:text-ink"
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
          className="underline decoration-border-strong underline-offset-2 hover:text-ink"
          rel="noopener noreferrer"
          target="_blank"
        >
          Fichier sur Wikimedia Commons
        </a>
      </figcaption>
    </figure>
  );
}
