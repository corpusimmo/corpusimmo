import { describe, expect, it, vi } from "vitest";

import {
  GTFS_LAYER_IDS,
  GTFS_LINES_SOURCE_ID,
  GTFS_LINE_BADGE_LAYER,
  GTFS_LINE_CASING_LAYER,
  GTFS_LINE_LAYER,
  GTFS_STOPS_SOURCE_ID,
  GTFS_STOP_LAYER,
  gtfsLayers,
  installGtfsLayers,
  setGtfsVisibility,
} from "./transports-gtfs";

type Spec = Record<string, unknown>;

const specs = () => gtfsLayers() as unknown as Spec[];
const byId = (id: string) => specs().find((l) => l.id === id) as Spec;

/**
 * Ce que ces tests gardent, ce n'est pas le rendu — c'est le contrat de
 * lecture. Une ligne doit sortir à SA couleur officielle et non à une couleur
 * du style : si quelqu'un remplaçait un jour `["get", "couleur"]` par une
 * teinte littérale, la carte resterait belle et deviendrait fausse. C'est
 * exactement ce qu'aucune relecture visuelle ne rattrape.
 */
describe("lignes de tram et métro issues des GTFS", () => {
  it("prend la couleur de chaque ligne dans la donnée, jamais dans le style", () => {
    const ligne = byId(GTFS_LINE_LAYER);
    expect((ligne.paint as Spec)["line-color"]).toEqual(["get", "couleur"]);

    const pastille = byId(GTFS_LINE_BADGE_LAYER);
    expect((pastille.paint as Spec)["text-color"]).toEqual(["get", "couleurTexte"]);
    // Le fond de la pastille EST le halo : le perdre rendrait le numéro
    // illisible sur un fond de carte clair.
    expect((pastille.paint as Spec)["text-halo-color"]).toEqual(["get", "couleur"]);

    const arret = byId(GTFS_STOP_LAYER);
    expect((arret.paint as Spec)["circle-stroke-color"]).toEqual(["get", "couleur"]);
  });

  it("affiche le numéro de ligne, et lui seul", () => {
    const layout = byId(GTFS_LINE_BADGE_LAYER).layout as Spec;
    expect(layout["text-field"]).toEqual(["get", "ref"]);
    expect(layout["symbol-placement"]).toBe("line");
  });

  it("garde le halo sous la limite que MapLibre applique aux glyphes", () => {
    // Un halo de plus d'un quart du corps du texte est rogné par le moteur :
    // la pastille apparaîtrait tronquée d'un côté.
    const pastille = byId(GTFS_LINE_BADGE_LAYER);
    const taille = (pastille.layout as Spec)["text-size"] as number;
    const halo = (pastille.paint as Spec)["text-halo-width"] as number;
    expect(halo).toBeGreaterThan(0);
    expect(halo).toBeLessThanOrEqual(taille / 4);
  });

  it("pose le liseré sous le trait coloré et la pastille en dernier", () => {
    // L'ordre du tableau EST l'ordre de dessin : un liseré posé après le trait
    // effacerait la couleur qu'il est censé détacher du fond.
    expect(specs().map((l) => l.id)).toEqual([...GTFS_LAYER_IDS]);
    expect(GTFS_LAYER_IDS[0]).toBe(GTFS_LINE_CASING_LAYER);
    expect(GTFS_LAYER_IDS[GTFS_LAYER_IDS.length - 1]).toBe(GTFS_LINE_BADGE_LAYER);

    // Le liseré doit être plus épais que le trait à CHAQUE palier de zoom,
    // sinon il cesse de déborder et le trait perd son détourage.
    const stops = (id: string) => {
      const expr = (byId(id).paint as Spec)["line-width"] as unknown[];
      return expr.slice(3).filter((_, i) => i % 2 === 1) as number[];
    };
    const casing = stops(GTFS_LINE_CASING_LAYER);
    const ligne = stops(GTFS_LINE_LAYER);
    expect(casing).toHaveLength(ligne.length);
    casing.forEach((w, i) => expect(w).toBeGreaterThan(ligne[i] as number));
  });

  it("n'enferme jamais `zoom` ailleurs qu'en entrée d'une interpolation", () => {
    // MapLibre rejette le style ENTIER si `["zoom"]` apparaît autrement qu'en
    // entrée directe d'un `interpolate` ou d'un `step`. TypeScript ne voit
    // rien, la carte reste blanche, et la console ne dit pas pourquoi.
    const verifier = (noeud: unknown, entreeAutorisee: boolean): void => {
      if (!Array.isArray(noeud)) return;
      if (noeud[0] === "zoom") {
        expect(entreeAutorisee).toBe(true);
        return;
      }
      const interpole = noeud[0] === "interpolate" || noeud[0] === "step";
      noeud.forEach((enfant, i) =>
        // L'entrée est le 3ᵉ terme d'un `interpolate`, le 2ᵉ d'un `step`.
        verifier(enfant, interpole && i === (noeud[0] === "step" ? 1 : 2)),
      );
    };
    for (const layer of specs()) {
      verifier(layer.paint, false);
      verifier(layer.layout, false);
    }
  });

  it("naît éteint, et branché sur les deux sources attendues", () => {
    for (const layer of specs()) {
      expect(layer.layout).toMatchObject({ visibility: "none" });
    }
    const sources = specs().map((l) => l.source);
    expect(sources).toEqual([
      GTFS_LINES_SOURCE_ID,
      GTFS_LINES_SOURCE_ID,
      GTFS_STOPS_SOURCE_ID,
      GTFS_LINES_SOURCE_ID,
    ]);
  });

  it("retient arrêts et pastilles jusqu'à un zoom où le tracé est déplié", () => {
    // À l'échelle d'une région, un réseau de tram tient dans un centimètre :
    // ses points et ses numéros formeraient une tache qui masquerait le tracé.
    expect(byId(GTFS_LINE_CASING_LAYER).minzoom).toBeUndefined();
    expect(byId(GTFS_LINE_LAYER).minzoom).toBeUndefined();
    expect(byId(GTFS_STOP_LAYER).minzoom).toBe(byId(GTFS_LINE_BADGE_LAYER).minzoom);
    expect(byId(GTFS_STOP_LAYER).minzoom as number).toBeGreaterThan(9);
  });
});

/** Fausse carte : on n'observe que ce que le module DEMANDE à MapLibre. */
function fakeMap(existing: string[] = []) {
  const layers = new Set(existing);
  const sources = new Set<string>();
  const added: string[] = [];
  const visibility: Record<string, string> = {};
  return {
    added,
    sources,
    visibility,
    map: {
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      getSource: (id: string) => (sources.has(id) ? { id } : undefined),
      addSource: vi.fn((id: string) => {
        sources.add(id);
      }),
      addLayer: vi.fn((layer: { id: string }, before?: string) => {
        layers.add(layer.id);
        added.push(`${layer.id}${before ? `<${before}` : ""}`);
      }),
      setLayoutProperty: vi.fn((id: string, _prop: string, value: string) => {
        visibility[id] = value;
      }),
    } as unknown as Parameters<typeof installGtfsLayers>[0],
  };
}

describe("installation", () => {
  it("pose les deux sources et les couches sous l'overlay DVF", () => {
    const f = fakeMap(["dvf-points"]);
    expect(installGtfsLayers(f.map, "dvf-points")).toBe(true);

    expect([...f.sources]).toEqual([GTFS_LINES_SOURCE_ID, GTFS_STOPS_SOURCE_ID]);
    expect(f.added).toEqual(GTFS_LAYER_IDS.map((id) => `${id}<dvf-points`));
  });

  it("ignore un `beforeId` absent plutôt que de faire échouer la pose", () => {
    // Le calque DVF n'est pas encore installé au premier `styledata` : poser
    // avant une couche inconnue jetterait, et la carte resterait vide.
    const f = fakeMap();
    expect(installGtfsLayers(f.map, "couche-fantôme")).toBe(true);
    expect(f.added).toEqual([...GTFS_LAYER_IDS]);
  });

  it("est idempotente : un second passage ne redouble rien", () => {
    const f = fakeMap();
    installGtfsLayers(f.map);
    const apres = f.added.length;
    expect(installGtfsLayers(f.map)).toBe(true);
    expect(f.added).toHaveLength(apres);
  });

  it("bascule les arrêts et les pastilles, jamais le tracé schématique", () => {
    const f = fakeMap();
    installGtfsLayers(f.map);
    setGtfsVisibility(f.map, true);

    // Ce que le GTFS apporte et que les tuiles n'ont pas : les arrêts, les
    // numéros et les couleurs officielles.
    expect(f.visibility["transports-gtfs-arret"]).toBe("visible");
    expect(f.visibility["transports-gtfs-pastille"]).toBe("visible");

    // Le tracé, lui, reste éteint MÊME quand le calque est demandé : les
    // `shapes.txt` français vont d'arrêt à arrêt (médiane 344 m entre deux
    // points) et doubleraient le tracé des tuiles, qui suit la voie.
    expect(f.visibility["transports-gtfs-ligne"]).toBe("none");
    expect(f.visibility["transports-gtfs-liseré"]).toBe("none");

    setGtfsVisibility(f.map, false);
    for (const id of GTFS_LAYER_IDS) expect(f.visibility[id]).toBe("none");
  });

  it("ne touche à rien quand le style ne porte aucune de nos couches", () => {
    const f = fakeMap();
    setGtfsVisibility(f.map, true);
    expect(f.visibility).toEqual({});
  });
});
