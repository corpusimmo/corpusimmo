import { describe, expect, it } from "vitest";

import {
  AMENITY_CATEGORIES,
  NEIGHBOURHOOD_MIN_ZOOM,
  RANK_LIMIT_STOPS,
  STATION_MIN_ZOOM,
  TRANSPORT_LAYER_IDS,
  TRANSPORT_LINES,
  TRANSPORT_LINE_MIN_ZOOM,
  TRANSPORT_STOPS,
  rankLimitExpression,
  transportLayers,
} from "./transports";

/**
 * Ce que ces tests gardent, ce n'est pas le rendu — c'est le contrat de
 * lecture : une couleur par entrée de légende, aucune valeur de tuile
 * revendiquée deux fois, des couches qui naissent éteintes, et des seuils de
 * zoom qui empêchent une commodité d'apparaître à l'échelle d'un département.
 */

/** Les couches sont des documents JSON : on les lit comme tels. */
function spec(layer: unknown): Record<string, unknown> {
  return layer as Record<string, unknown>;
}

function layerById(id: string): Record<string, unknown> {
  const found = transportLayers().find((layer) => layer.id === id);
  expect(found, `couche absente : ${id}`).toBeDefined();
  return spec(found);
}

describe("transports et commodités", () => {
  it("donne un identifiant et une couleur distincts à chaque entrée de légende", () => {
    const entries = [
      ...TRANSPORT_LINES,
      ...TRANSPORT_STOPS,
      ...AMENITY_CATEGORIES,
    ];
    const ids = entries.map((e) => e.id);
    const colors = entries.map((e) => e.color);

    expect(new Set(ids).size).toBe(ids.length);
    // Deux familles de la même teinte rendraient la légende indécidable.
    expect(new Set(colors).size).toBe(colors.length);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("n'attribue jamais la même valeur de tuile à deux familles", () => {
    const seen = new Map<string, string>();
    const claim = (key: string, owner: string) => {
      expect(seen.get(key), `${key} déjà pris par ${seen.get(key)}`).toBe(
        undefined,
      );
      seen.set(key, owner);
    };

    for (const line of TRANSPORT_LINES) {
      for (const value of line.classes) claim(`transportation/${value}`, line.id);
    }
    for (const group of TRANSPORT_STOPS) {
      for (const value of group.subclasses) claim(`poi:sub/${value}`, group.id);
    }
    for (const category of AMENITY_CATEGORIES) {
      for (const value of category.classes) {
        claim(`poi:class/${value}`, category.id);
      }
    }
  });

  it("écarte les classes fourre-tout de la couche poi", () => {
    // `shop` couvre la supérette ET le salon de tatouage, `office` l'agence
    // immobilière ET l'avocat : les accepter rendrait la légende fausse.
    const claimed = AMENITY_CATEGORIES.flatMap((c) => c.classes);
    expect(claimed).not.toContain("shop");
    expect(claimed).not.toContain("office");
    // `entrance` ferait cinq points là où il y a une gare.
    expect(claimed).not.toContain("entrance");
  });

  it("couvre les quatre familles de commodités attendues", () => {
    expect(AMENITY_CATEGORIES.map((c) => c.id)).toEqual([
      "ecole",
      "alimentation",
      "sante",
      "parc",
    ]);
  });

  it("lit le réseau ferré sur `class`, qui couvre toutes les sous-classes", () => {
    // Les tuiles françaises ne portent que subway et tram sous `transit`, mais
    // light_rail et monorail sont au schéma : filtrer sur la classe les prend
    // sans que nous ayons à parier sur une sous-classe.
    const classes = TRANSPORT_LINES.flatMap((l) => l.classes);
    expect(classes).toEqual(expect.arrayContaining(["rail", "transit"]));
  });
});

describe("couches de transports", () => {
  it("expose exactement les identifiants annoncés, dans l'ordre de dessin", () => {
    expect(transportLayers().map((l) => l.id)).toEqual([
      ...TRANSPORT_LAYER_IDS,
    ]);
  });

  it("naît éteinte, sur notre source, et sur une couche de tuile connue", () => {
    for (const layer of transportLayers()) {
      const s = spec(layer);
      expect(s.layout).toMatchObject({ visibility: "none" });
      expect(s.source).toBe("openmaptiles");
      expect(["transportation", "poi"]).toContain(s["source-layer"]);
    }
  });

  it("dessine les lignes sous les points, et les gares au-dessus des commodités", () => {
    const ids = transportLayers().map((l) => l.id);
    const lastLine = Math.max(
      ...ids.flatMap((id, i) => (id.startsWith("transports-line-") ? [i] : [])),
    );
    const firstAmenity = ids.findIndex((id) =>
      id.startsWith("transports-amenity-"),
    );
    const firstStop = ids.findIndex((id) => id.startsWith("transports-stop-"));

    // Un arrêt posé sur sa propre ligne doit rester visible.
    expect(lastLine).toBeLessThan(firstAmenity);
    // La gare est le repère, la commodité le décor.
    expect(firstAmenity).toBeLessThan(firstStop);
  });

  it("pose un halo clair sous chaque ligne, plus large que le trait", () => {
    for (const line of TRANSPORT_LINES) {
      const casing = layerById(`transports-line-${line.id}-casing`);
      const stroke = layerById(`transports-line-${line.id}`);
      const paint = casing.paint as Record<string, unknown>;

      expect(paint["line-color"]).toBe("#ffffff");
      // Sans ce halo, un trait de tram se lit comme une rue de plus.
      const widthAt = (layer: Record<string, unknown>) =>
        ((layer.paint as Record<string, unknown>)["line-width"] as number[])[4];
      expect(widthAt(casing)).toBeGreaterThan(widthAt(stroke) as number);
    }

    // Le halo est SOUS le trait dans l'ordre de dessin, jamais l'inverse.
    const ids = transportLayers().map((l) => l.id);
    for (const line of TRANSPORT_LINES) {
      expect(ids.indexOf(`transports-line-${line.id}-casing`)).toBeLessThan(
        ids.indexOf(`transports-line-${line.id}`),
      );
    }
  });

  it("distingue le train du tram par le pointillé", () => {
    for (const line of TRANSPORT_LINES) {
      const paint = layerById(`transports-line-${line.id}`).paint as Record<
        string,
        unknown
      >;
      if (line.dashed) expect(paint["line-dasharray"]).toBeDefined();
      else expect(paint["line-dasharray"]).toBeUndefined();
    }
  });

  it("n'affiche aucune commodité à l'échelle d'un département", () => {
    for (const layer of transportLayers()) {
      const s = spec(layer);
      expect(s.minzoom as number).toBeGreaterThanOrEqual(
        TRANSPORT_LINE_MIN_ZOOM,
      );
    }

    for (const category of AMENITY_CATEGORIES) {
      expect(layerById(`transports-amenity-${category.id}`).minzoom).toBe(
        NEIGHBOURHOOD_MIN_ZOOM,
      );
    }
    // Une gare est un repère d'agglomération, un arrêt de bus non.
    expect(layerById("transports-stop-gare").minzoom).toBe(STATION_MIN_ZOOM);
    expect(layerById("transports-stop-arret").minzoom).toBe(
      NEIGHBOURHOOD_MIN_ZOOM,
    );
    expect(STATION_MIN_ZOOM).toBeLessThan(NEIGHBOURHOOD_MIN_ZOOM);
  });

  it("n'écrit jamais de texte : les pastilles de prix restent la donnée principale", () => {
    // L'invariant porte sur le TEXTE, pas sur le type de couche. Les
    // pictogrammes d'arrêts sont des `symbol` sans `text-field` : ils
    // n'entrent donc pas en concurrence de lecture avec les prix, et
    // interdire le type `symbol` interdirait aussi les icônes.
    for (const layer of transportLayers()) {
      const s = spec(layer);
      const layout = (s.layout ?? {}) as Record<string, unknown>;
      expect(Object.keys(layout)).not.toContain("text-field");
      expect(Object.keys(layout)).not.toContain("text-size");
    }
  });

  it("pose un pictogramme par arrêt et par commodité, jamais de texte", () => {
    const icons = transportLayers().filter((layer) =>
      String(spec(layer).id).startsWith("transports-icon-"),
    );

    expect(icons.length).toBe(
      TRANSPORT_STOPS.length + AMENITY_CATEGORIES.length,
    );
    for (const icon of icons) {
      const layout = spec(icon).layout as Record<string, unknown>;
      expect(layout.visibility).toBe("none");
      expect(layout["icon-image"]).toBeDefined();
      // Un pictogramme illisible ne vaut pas mieux que rien : il n'apparaît
      // qu'au zoom où la place existe.
      expect(Number(spec(icon).minzoom)).toBeGreaterThanOrEqual(15.5);
    }
  });

  it("filtre les commodités sur `class` et les arrêts sur `subclass`", () => {
    const first = AMENITY_CATEGORIES[0];
    expect(layerById(`transports-amenity-${first?.id}`).filter).toEqual([
      "all",
      ["match", ["get", "class"], [...(first?.classes ?? [])], true, false],
      ["<", ["coalesce", ["get", "rank"], 0], rankLimitExpression()],
    ]);

    // `railway` mélange la gare SNCF et l'arrêt de tram : seule la sous-classe
    // les sépare.
    const gare = TRANSPORT_STOPS.find((g) => g.id === "gare");
    expect(layerById("transports-stop-gare").filter).toEqual([
      "all",
      ["match", ["get", "subclass"], [...(gare?.subclasses ?? [])], true, false],
      ["<", ["coalesce", ["get", "rank"], 0], rankLimitExpression()],
    ]);
  });

  it("ne mute pas les tables de lecture en construisant les couches", () => {
    const before = JSON.stringify([
      TRANSPORT_LINES,
      TRANSPORT_STOPS,
      AMENITY_CATEGORIES,
    ]);
    transportLayers();
    expect(
      JSON.stringify([TRANSPORT_LINES, TRANSPORT_STOPS, AMENITY_CATEGORIES]),
    ).toBe(before);
    // Les filtres reçoivent une copie : les geler ici ne doit rien casser.
    expect(Object.isFrozen(AMENITY_CATEGORIES[0]?.classes)).toBe(false);
  });
});

describe("régulation de densité", () => {
  it("desserre le seuil de rang à mesure qu'on zoome", () => {
    const limits = RANK_LIMIT_STOPS.map(([, limit]) => limit);
    const zooms = RANK_LIMIT_STOPS.map(([zoom]) => zoom);

    for (let i = 1; i < limits.length; i += 1) {
      // La source plafonne à z14 : sans desserrement, un quartier vu à z18
      // resterait aussi vide qu'à z14.
      expect(zooms[i]).toBeGreaterThan(zooms[i - 1] as number);
      expect(limits[i]).toBeGreaterThan(limits[i - 1] as number);
    }
    expect(zooms[0]).toBe(NEIGHBOURHOOD_MIN_ZOOM);
  });

  it("produit une expression `step` bien formée", () => {
    expect(rankLimitExpression()).toEqual([
      "step",
      ["zoom"],
      RANK_LIMIT_STOPS[0]?.[1],
      ...RANK_LIMIT_STOPS.slice(1).flatMap(([zoom, limit]) => [zoom, limit]),
    ]);
    // Trois paliers : une sortie par défaut, puis deux paires zoom/valeur.
    expect(rankLimitExpression()).toHaveLength(3 + 2 * 2);
  });

  it("garde visibles les objets sans rang plutôt que de les exclure", () => {
    // Une absence de classement ne doit pas valoir exclusion : le `coalesce`
    // ramène ces objets à 0, donc sous n'importe quel seuil.
    const filter = layerById("transports-stop-arret").filter as unknown[];
    expect(filter[2]).toEqual([
      "<",
      ["coalesce", ["get", "rank"], 0],
      rankLimitExpression(),
    ]);
  });
});
