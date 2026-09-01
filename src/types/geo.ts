/**
 * Geographic primitives shared by the geocoder, the map and the DVF layer.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** [west, south, east, north] — the order MapLibre and GeoJSON both use. */
export type BBox = [number, number, number, number];

export type AddressKind = "housenumber" | "street" | "locality" | "municipality";

/**
 * A resolved French address. Always produced by the geocoding adapter, never
 * assembled by hand in a component.
 */
export interface GeoAddress {
  /** Stable id from the Base Adresse Nationale (e.g. `44109_1234_00008`). */
  id: string;
  /** Full human label — `8 Rue de la Paix 75002 Paris`. */
  label: string;
  kind: AddressKind;
  houseNumber?: string;
  street?: string;
  postcode?: string;
  city: string;
  /** INSEE code of the commune — the join key for DVF. */
  cityCode: string;
  /** 2 or 3 char department code (`44`, `2A`, `971`). */
  departmentCode: string;
  context?: string;
  coordinates: LatLng;
  /** 0 → 1 relevance as returned by the geocoder. */
  score: number;
}

export interface Commune {
  /** INSEE code. */
  code: string;
  name: string;
  postcodes?: string[];
  departmentCode: string;
  population?: number;
  center?: LatLng;
}
