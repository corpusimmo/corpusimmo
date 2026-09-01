/**
 * Le centrage de la carte par l'URL, lu côté client après montage.
 *
 * POURQUOI CÔTÉ CLIENT : `/carte` est une page statique dont le composant
 * client fait tout. Lire `searchParams` côté serveur forcerait le rendu
 * dynamique de la page ; `useSearchParams` sans `Suspense` casserait le
 * prérendu. On lit donc `window.location.search` une fois monté, et on ne
 * rend la carte qu'après cette lecture, pour ne pas la créer deux fois.
 *
 * Deux formes, la première réservée aux communes publiées :
 *   · `?commune=<code INSEE>` : le centre vient du référentiel figé des pages
 *     villes (`src/data/cities/communes.ts`), sans appel réseau. Un code hors
 *     de cette liste est ignoré : mieux vaut la France entière qu'un centre
 *     inventé.
 *   · `?lat=&lng=[&zoom=]` : un point quelconque ; le zoom est borné à ce que
 *     la carte accepte, et vaut 15 (le niveau où les pastilles de prix
 *     apparaissent) quand il est absent.
 */

import { cityCommunes, type CityCommune } from "@/data/cities/communes";
import type { GeoAddress, LatLng } from "@/types/geo";

/** Zoom auquel une commune se lit en entier : celui de la recherche d'adresse. */
export const COMMUNE_ZOOM = 13;
const DEFAULT_POINT_ZOOM = 15;
const MIN_ZOOM = 4;
const MAX_ZOOM = 19.5;

export interface UrlTarget {
  center: LatLng;
  zoom: number;
  /** Renseignée pour une commune, pour afficher son nom dans la recherche. */
  address?: GeoAddress;
}

export function readUrlTarget(search: string): UrlTarget | null {
  const params = new URLSearchParams(search);

  const commune = params.get("commune")?.trim();
  if (commune) {
    const found = findCommuneByInsee(commune);
    if (found) {
      return { center: found.center, zoom: COMMUNE_ZOOM, address: toAddress(found) };
    }
  }

  const lat = toFinite(params.get("lat"));
  const lng = toFinite(params.get("lng"));
  if (lat === undefined || lng === undefined) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const zoom = toFinite(params.get("zoom"));
  return {
    center: { lat, lng },
    zoom: zoom === undefined ? DEFAULT_POINT_ZOOM : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
  };
}

export function findCommuneByInsee(insee: string): CityCommune | undefined {
  return cityCommunes.find((commune) => commune.insee === insee);
}

/** Le minimum pour que le champ de recherche affiche la commune reçue. */
function toAddress(commune: CityCommune): GeoAddress {
  return {
    id: `insee:${commune.insee}`,
    label: `${commune.name} (${commune.departmentCode})`,
    kind: "municipality",
    city: commune.name,
    cityCode: commune.insee,
    departmentCode: commune.departmentCode,
    postcode: commune.postcodes[0],
    coordinates: commune.center,
    score: 1,
  };
}

function toFinite(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
