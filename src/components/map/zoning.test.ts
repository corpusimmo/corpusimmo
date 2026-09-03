import { describe, expect, it } from "vitest";

import {
  ZONING_CATEGORIES,
  ZONING_LAYER_IDS,
  zoningLayers,
} from "./zoning";

/**
 * Ce que ces tests gardent, ce n'est pas le rendu — c'est le contrat de
 * lecture : une couleur par affectation, aucune classe OSM réclamée par deux
 * catégories, et des couches qui naissent éteintes.
 */
describe("zonage", () => {
  it("donne un identifiant et une couleur distincts à chaque affectation", () => {
    const ids = ZONING_CATEGORIES.map((c) => c.id);
    const colors = ZONING_CATEGORIES.map((c) => c.color);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(colors).size).toBe(colors.length);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("n'attribue jamais la même classe OSM à deux affectations", () => {
    // Deux couches qui réclameraient `industrial` peindraient la même emprise
    // deux fois : la légende annoncerait alors une couleur que la carte ne
    // montre pas, celle du dessous.
    const seen = new Map<string, string>();
    for (const category of ZONING_CATEGORIES) {
      for (const value of category.classes) {
        const key = `${category.sourceLayer}/${value}`;
        expect(seen.get(key)).toBeUndefined();
        seen.set(key, category.id);
      }
    }
  });

  it("couvre les quatre familles attendues d'un zonage", () => {
    const ids = ZONING_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "habitation",
        "tertiaire",
        "industriel",
        "agricole",
      ]),
    );
  });

  it("produit une couche par affectation, éteinte et dans l'ordre de la légende", () => {
    const layers = zoningLayers();

    expect(layers).toHaveLength(ZONING_CATEGORIES.length);
    expect(layers.map((l) => l.id)).toEqual([...ZONING_LAYER_IDS]);

    layers.forEach((layer, i) => {
      const category = ZONING_CATEGORIES[i];
      expect(layer.type).toBe("fill");
      expect(layer.layout).toMatchObject({ visibility: "none" });
      expect(layer).toMatchObject({
        "source-layer": category?.sourceLayer,
        paint: { "fill-color": category?.color },
      });
    });
  });

  it("filtre sur la classe de la tuile, sans muter la table des catégories", () => {
    const [first] = zoningLayers();
    const category = ZONING_CATEGORIES[0];

    // `LayerSpecification` est une union : le fond n'a pas de `filter`, donc
    // le compilateur refuse l'accès direct. On lit la couche comme le document
    // JSON qu'elle est.
    const spec = first as unknown as Record<string, unknown>;
    expect(spec.filter).toEqual([
      "match",
      ["get", "class"],
      [...(category?.classes ?? [])],
      true,
      false,
    ]);
    // Le filtre reçoit une copie : le geler ici ne doit rien casser ailleurs.
    expect(Object.isFrozen(category?.classes)).toBe(false);
  });
});
