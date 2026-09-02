import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import {
  AssetTypeIcon,
  ConfidenceBand,
  DeveloperBalance,
  MethodDiagram,
  RadiusEscalation,
  WaultDiagram,
  WeightingDiagram,
  assetTypeIconLabels,
  assetTypeIcons,
  type AssetIconName,
} from "./index";

/**
 * Ces tests ne vérifient pas des pixels : ils verrouillent les quatre
 * promesses de la bibliothèque, celles qu’une retouche pressée casserait sans
 * qu’on s’en aperçoive à l’œil.
 */

const DIAGRAMS = [
  { name: "MethodDiagram", Component: MethodDiagram },
  { name: "RadiusEscalation", Component: RadiusEscalation },
  { name: "WeightingDiagram", Component: WeightingDiagram },
  { name: "ConfidenceBand", Component: ConfidenceBand },
  { name: "DeveloperBalance", Component: DeveloperBalance },
  { name: "WaultDiagram", Component: WaultDiagram },
] as const;

const ICON_NAMES = Object.keys(assetTypeIcons) as AssetIconName[];

describe.each(DIAGRAMS)("$name", ({ Component }) => {
  it("s’annonce comme une image nommée, et décrite", () => {
    const { container } = render(<Component />);

    // Deux cadres, une même promesse : soit le SVG porte le nom (`role="img"`
    // + `<desc>`), soit la figure hybride le porte (`role="group"` + un
    // paragraphe masqué). Dans les deux cas, un lecteur d’écran reçoit un nom
    // court et une description longue.
    const named = container.querySelector('svg[role="img"], figure[role="group"]');
    expect(named).not.toBeNull();
    expect(named?.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(20);

    const description =
      named?.tagName === "svg"
        ? named.querySelector("desc")?.textContent
        : named?.querySelector(":scope > p.sr-only")?.textContent;
    expect(description?.length ?? 0).toBeGreaterThan(80);
  });

  it("est fluide : un viewBox, une largeur en pourcentage, aucune largeur en pixels", () => {
    const { container } = render(<Component />);
    // Les flèches de liaison entre étapes sont des glyphes à taille fixe,
    // pas des dessins : elles sont exclues par leur `role`-moins-`viewBox` 12.
    const drawings = Array.from(container.querySelectorAll("svg")).filter(
      (svg) => svg.getAttribute("viewBox") !== "0 0 12 12",
    );
    expect(drawings.length).toBeGreaterThan(0);

    for (const svg of drawings) {
      expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
      expect(svg.getAttribute("width")).toBe("100%");
      expect(svg.getAttribute("height")).toBeNull();
    }
  });

  it("n’écrit aucune couleur en dur : tout passe par les tokens", () => {
    const { container } = render(<Component />);
    const markup = container.innerHTML;

    expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(markup).not.toMatch(/rgba?\(/i);
    expect(markup).not.toMatch(/\bhsla?\(/i);
  });

  it("n’émet aucun id : deux schémas peuvent cohabiter sur une page", () => {
    const { container } = render(<Component />);

    expect(container.querySelectorAll("[id]")).toHaveLength(0);
    expect(container.querySelectorAll("defs, marker, linearGradient")).toHaveLength(0);
  });

  it("n’utilise jamais de tiret cadratin dans un texte visible", () => {
    const { container } = render(<Component />);

    // Consigne éditoriale du projet : le cadratin est proscrit partout où un
    // humain lit. Les légendes des schémas ne font pas exception.
    expect(container.textContent).not.toContain("—");
  });

  it("laisse retirer sa légende", () => {
    const withCaption = render(<Component />);
    expect(withCaption.container.querySelector("figcaption")).not.toBeNull();

    const withoutCaption = render(<Component caption={false} />);
    expect(withoutCaption.container.querySelector("figcaption")).toBeNull();
  });
});

describe("AssetTypeIcons", () => {
  it("couvre exactement les typologies libellées", () => {
    expect(ICON_NAMES.sort()).toEqual(
      (Object.keys(assetTypeIconLabels) as AssetIconName[]).sort(),
    );
  });

  it.each(ICON_NAMES)("%s est décorative tant qu’on ne la nomme pas", (name) => {
    const { container } = render(<AssetTypeIcon name={name} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(svg?.querySelector("title")).toBeNull();
  });

  it.each(ICON_NAMES)("%s devient une image nommée quand on la nomme", (name) => {
    const { container } = render(<AssetTypeIcon name={name} label={assetTypeIconLabels[name]} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
    expect(svg?.querySelector("title")?.textContent).toBe(assetTypeIconLabels[name]);
  });

  it.each(ICON_NAMES)("%s tient sur la grille de 32 et prend la couleur du texte", (name) => {
    const { container } = render(<AssetTypeIcon name={name} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    // 2 unités sur 32 = 1,5 px à 24 px, le poids de lucide en strokeWidth 1,5.
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("laisse régler le poids du trait pour épouser un autre jeu d’icônes", () => {
    const { container } = render(<AssetTypeIcon name="house" strokeWidth={2.67} />);

    expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2.67");
  });

  it("laisse remplacer la taille par défaut", () => {
    const { container } = render(<AssetTypeIcon name="parking" className="size-10" />);

    expect(container.querySelector("svg")?.getAttribute("class")).toContain("size-10");
    expect(container.querySelector("svg")?.getAttribute("class")).not.toContain("size-6");
  });
});
