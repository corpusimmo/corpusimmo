import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  OSM_LINES_ATTRIBUTION,
  OSM_LINES_SOURCE_ID,
  OSM_LINE_BADGE_LAYER,
  OSM_LINE_CASING_LAYER,
  OSM_LINE_LAYER,
  OSM_LINE_LAYER_IDS,
  installOsmLineLayers,
  osmLineLayers,
  setOsmLineVisibility,
} from "./transports-osm-lines";

type Spec = Record<string, unknown>;

const specs = () => osmLineLayers() as unknown as Spec[];
const byId = (id: string) => specs().find((l) => l.id === id) as Spec;

/**
 * Une carte de façade : on ne teste pas le rendu, on teste ce que le module
 * DEMANDE à MapLibre. Le rendu, lui, ne se relit pas dans une suite de tests.
 */
function fakeMap() {
  const layers = new Map<string, Spec>();
  const sources = new Map<string, Spec>();
  const ordre: (string | undefined)[] = [];
  return {
    layers,
    sources,
    ordre,
    map: {
      getLayer: (id: string) => layers.get(id),
      getSource: (id: string) => sources.get(id),
      addSource: vi.fn((id: string, spec: Spec) => sources.set(id, spec)),
      addLayer: vi.fn((layer: Spec, before?: string) => {
        layers.set(layer.id as string, layer);
        ordre.push(before);
      }),
      setLayoutProperty: vi.fn((id: string, key: string, value: unknown) => {
        const layer = layers.get(id);
        if (layer) (layer.layout as Spec)[key] = value;
      }),
    },
  };
}

/**
 * `zoom` n'est admis qu'en entrée DIRECTE d'un `interpolate` ou d'un `step`.
 * Ailleurs — sous une addition, sous un `case` — MapLibre rejette le style
 * ENTIER au chargement, sans un mot dans la console : la carte reste, les
 * calques disparaissent tous, et rien ne dit pourquoi.
 */
function zoomMalPlace(noeud: unknown, direct = false): boolean {
  if (!Array.isArray(noeud)) return false;
  if (noeud[0] === "zoom") return !direct;
  const interpole = noeud[0] === "interpolate" || noeud[0] === "interpolate-hcl";
  const marche = noeud[0] === "step";
  return noeud.some((enfant, i) =>
    zoomMalPlace(enfant, (interpole && i === 2) || (marche && i === 1)),
  );
}

describe("tracés de lignes issus d'OpenStreetMap", () => {
  it("prend la couleur de chaque ligne dans la donnée, jamais dans le style", () => {
    // Si quelqu'un remplaçait un jour `["get", "couleur"]` par une teinte
    // littérale, la carte resterait belle et deviendrait fausse : aucune
    // relecture visuelle ne rattrape ça.
    expect((byId(OSM_LINE_LAYER).paint as Spec)["line-color"]).toEqual([
      "get",
      "couleur",
    ]);

    const pastille = byId(OSM_LINE_BADGE_LAYER);
    expect((pastille.paint as Spec)["text-color"]).toEqual([
      "get",
      "couleurTexte",
    ]);
    // Le fond de la pastille EST le halo : le perdre rendrait le numéro
    // illisible sur un fond de carte clair.
    expect((pastille.paint as Spec)["text-halo-color"]).toEqual([
      "get",
      "couleur",
    ]);
    expect((pastille.layout as Spec)["text-field"]).toEqual(["get", "ref"]);
  });

  it("n'emploie `zoom` qu'en entrée directe d'une interpolation", () => {
    for (const layer of specs()) {
      expect(zoomMalPlace(layer.paint)).toBe(false);
      expect(zoomMalPlace(layer.layout)).toBe(false);
    }
    // Le détecteur doit mordre, sinon il ne garantit rien.
    expect(zoomMalPlace(["+", 2, ["zoom"]])).toBe(true);
    expect(zoomMalPlace(["interpolate", ["linear"], ["zoom"], 8, 1])).toBe(false);
    expect(zoomMalPlace(["+", 2, ["interpolate", ["linear"], ["zoom"], 8, 1]])).toBe(
      false,
    );
  });

  it("pose le liseré sous le trait, et la pastille au-dessus des deux", () => {
    const layers = specs();
    expect(layers.map((l) => l.id)).toEqual([...OSM_LINE_LAYER_IDS]);
    expect(OSM_LINE_LAYER_IDS.indexOf(OSM_LINE_CASING_LAYER)).toBeLessThan(
      OSM_LINE_LAYER_IDS.indexOf(OSM_LINE_LAYER),
    );
    expect(OSM_LINE_LAYER_IDS.indexOf(OSM_LINE_BADGE_LAYER)).toBe(
      OSM_LINE_LAYER_IDS.length - 1,
    );

    // Le liseré doit rester PLUS LARGE que le trait à tout zoom, sinon il
    // cesse d'être un liseré et devient une seconde ligne.
    const largeur = (id: string) =>
      (byId(id).paint as Spec)["line-width"] as unknown[];
    const liseré = largeur(OSM_LINE_CASING_LAYER);
    const trait = largeur(OSM_LINE_LAYER);
    for (let i = 3; i < liseré.length; i += 2) {
      expect(liseré[i]).toBe(trait[i]);
      expect(liseré[i + 1] as number).toBeGreaterThan(trait[i + 1] as number);
    }
  });

  it("naît éteint, sur une source unique", () => {
    for (const layer of specs()) {
      expect(layer.source).toBe(OSM_LINES_SOURCE_ID);
      expect(layer.layout).toMatchObject({ visibility: "none" });
    }
  });

  it("installe la source avec son attribution, et ne la repose pas", () => {
    const { map, sources, ordre } = fakeMap();

    expect(installOsmLineLayers(map as never, "dvf-pastilles")).toBe(true);
    expect(sources.get(OSM_LINES_SOURCE_ID)).toMatchObject({
      type: "geojson",
      attribution: OSM_LINES_ATTRIBUTION,
    });
    expect(map.addLayer).toHaveBeenCalledTimes(OSM_LINE_LAYER_IDS.length);
    // `beforeId` inconnu de la carte : on passe `undefined` plutôt que de
    // laisser MapLibre lever sur une couche qui n'existe pas.
    expect(ordre).toEqual(OSM_LINE_LAYER_IDS.map(() => undefined));

    // L'installation repasse à chaque `styledata` : elle doit être inerte.
    expect(installOsmLineLayers(map as never)).toBe(true);
    expect(map.addLayer).toHaveBeenCalledTimes(OSM_LINE_LAYER_IDS.length);
    expect(map.addSource).toHaveBeenCalledTimes(1);
  });

  it("respecte `beforeId` quand la couche visée existe", () => {
    const { map, layers } = fakeMap();
    layers.set("dvf-pastilles", { id: "dvf-pastilles" });

    installOsmLineLayers(map as never, "dvf-pastilles");
    for (const appel of map.addLayer.mock.calls) {
      expect(appel[1]).toBe("dvf-pastilles");
    }
  });

  it("allume et éteint toutes les couches posées, et seulement celles-là", () => {
    const { map, layers } = fakeMap();
    installOsmLineLayers(map as never);

    setOsmLineVisibility(map as never, true);
    for (const id of OSM_LINE_LAYER_IDS) {
      expect((layers.get(id)?.layout as Spec).visibility).toBe("visible");
    }

    setOsmLineVisibility(map as never, false);
    for (const id of OSM_LINE_LAYER_IDS) {
      expect((layers.get(id)?.layout as Spec).visibility).toBe("none");
    }

    // Sur une carte vierge, aucune couche : le module ne doit pas lever.
    const vierge = fakeMap();
    expect(() => setOsmLineVisibility(vierge.map as never, true)).not.toThrow();
    expect(vierge.map.setLayoutProperty).not.toHaveBeenCalled();
  });

  it("annonce la source et sa licence dans l'attribution", () => {
    // L'ODbL fait de la citation une CONDITION de réutilisation : cette
    // chaîne n'est pas de la décoration, elle est le droit d'afficher.
    expect(OSM_LINES_ATTRIBUTION).toMatch(/OpenStreetMap/);
    expect(OSM_LINES_ATTRIBUTION).toMatch(/ODbL/);
  });
});

/**
 * Le fichier lui-même, et pas seulement le module qui le lit.
 *
 * Une base dérivée d'OSM qui circulerait sans sa licence serait en infraction
 * quel que soit le soin apporté au calque. Le contrôle est donc porté par la
 * suite de tests, là où il bloque, et non par un commentaire.
 */
describe("fichier des tracés", () => {
  const data = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "public/geo/transports-lignes-osm.geojson"),
      "utf8",
    ),
  ) as {
    licence?: string;
    attribution?: string;
    features: { properties: Record<string, string>; geometry: { type: string } }[];
  };

  it("porte sa licence et son attribution en tête", () => {
    expect(data.licence).toBe("ODbL 1.0");
    expect(data.attribution).toMatch(/contributeurs OpenStreetMap/);
  });

  it("donne à chaque ligne un numéro, une couleur normalisée et son encre", () => {
    expect(data.features.length).toBeGreaterThan(100);
    for (const { properties } of data.features) {
      expect(properties.ref).toBeTruthy();
      expect(properties.couleur).toMatch(/^#[0-9a-f]{6}$/);
      expect(["#000000", "#ffffff"]).toContain(properties.couleurTexte);
      expect(["tram", "metro", "funiculaire"]).toContain(properties.mode);
    }
  });

  it("ne garde qu'une entité par ligne, tous réseaux confondus", () => {
    // Sans dédoublonnage, chaque tram arrive en deux à six exemplaires — un
    // par sens, plus les variantes de service — et le trait s'épaissit au
    // hasard des recouvrements.
    const cles = data.features.map(
      (f) => `${f.properties.reseau}/${f.properties.ref}/${f.properties.mode}`,
    );
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("garde les trois trams de Nantes à la couleur de l'exploitant", () => {
    // Le repère de recette : OSM dit #00a754 pour la ligne 1, l'exploitant
    // #007a45. C'est le second qui doit gagner.
    const nantes = data.features.filter((f) =>
      ["TAN", "Naolib"].includes(f.properties.reseau),
    );
    const couleurs = Object.fromEntries(
      nantes.map((f) => [f.properties.ref, f.properties.couleur]),
    );
    expect(couleurs).toEqual({ "1": "#007a45", "2": "#e53138", "3": "#0079bc" });
  });
});
