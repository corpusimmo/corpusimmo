/**
 * LE LIEN VERS GOOGLE MAPS, pour aller voir un bien de ses yeux.
 *
 * DVF dit ce qui s'est vendu et à quel prix ; il ne dit rien de la rue, du
 * vis-à-vis, de l'état de la façade. Un lien vers la vue satellite et Street
 * View clôt cet écart sans que nous ayons à héberger une seule image.
 *
 * TROIS PRÉCAUTIONS.
 *
 * 1. RIEN N'EST ENVOYÉ TANT QUE PERSONNE NE CLIQUE. Le lien est un `href` :
 *    aucun appel réseau vers Google n'a lieu au rendu, aucun script tiers
 *    n'est chargé, et la mesure d'audience n'a pas à être consentie pour
 *    qu'une fiche s'affiche.
 * 2. L'ADRESSE EST CELLE QUE DVF PUBLIE, jamais un enrichissement. Elle est
 *    déjà publique ; nous ne la croisons avec rien.
 * 3. LE POINT GÉOGRAPHIQUE PRIME quand il existe. Une adresse DVF est parfois
 *    approximative (« 12 AV CHANZY » sans commune normalisée) et Google la
 *    résout alors n'importe où en France ; les coordonnées, elles, viennent du
 *    géocodage d'Etalab et tombent sur la parcelle.
 */

export interface MapsTarget {
  /** Coordonnées géocodées, quand la mutation en porte. */
  coordinates?: { lat: number; lng: number };
  /** L'adresse telle que publiée, en repli et pour l'infobulle. */
  addressLabel?: string;
  postcode?: string;
  city?: string;
}

/** Ce qu'on montre à Google : le point, ou l'adresse écrite. */
function query(target: MapsTarget): string | null {
  const { coordinates } = target;
  if (
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng)
  ) {
    return `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
  }

  const written = [target.addressLabel, target.postcode, target.city]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");

  return written ? written : null;
}

/**
 * La vue carte. `api=1` est la forme documentée et stable des liens Maps :
 * elle fonctionne sur mobile en ouvrant l'application, et sur ordinateur dans
 * le navigateur, sans clé et sans quota.
 */
export function googleMapsUrl(target: MapsTarget): string | null {
  const q = query(target);
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : null;
}

/**
 * La vue immersive, celle qui montre vraiment le bien. Elle n'a de sens qu'avec
 * des coordonnées : Street View ne sait pas se placer sur une chaîne de texte.
 */
export function streetViewUrl(target: MapsTarget): string | null {
  const { coordinates } = target;
  if (
    !coordinates ||
    !Number.isFinite(coordinates.lat) ||
    !Number.isFinite(coordinates.lng)
  ) {
    return null;
  }

  const point = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point}`;
}
