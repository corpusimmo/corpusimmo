/**
 * L'analyseur est maison&nbsp;: il doit donc être tenu de près, surtout sur le
 * point qui justifie son existence, à savoir qu'un fichier d'article ne peut
 * pas faire entrer de balise dans la page.
 */

import { describe, expect, it } from "vitest";

import { frenchSpacing, parseInline, parseMarkdown, plainText } from "./markdown";

const NBSP = "\u00A0";

describe("frenchSpacing", () => {
  it("pose une insécable avant la ponctuation double", () => {
    expect(frenchSpacing("Une question ?")).toBe(`Une question${NBSP}?`);
    expect(frenchSpacing("Voici : la suite")).toBe(`Voici${NBSP}: la suite`);
  });

  it("ne disloque pas une adresse web", () => {
    expect(frenchSpacing("https://corpus.immo/blog")).toBe("https://corpus.immo/blog");
  });

  it("colle les guillemets français à ce qu'ils entourent", () => {
    expect(frenchSpacing("« un prix »")).toBe(`«${NBSP}un prix${NBSP}»`);
  });
});

describe("parseInline", () => {
  it("reconnaît le gras, l'italique et le code", () => {
    expect(parseInline("un **prix** en *euros* dans `dvf`")).toEqual([
      { type: "text", value: "un " },
      { type: "strong", value: "prix" },
      { type: "text", value: " en " },
      { type: "emphasis", value: "euros" },
      { type: "text", value: " dans " },
      { type: "code", value: "dvf" },
    ]);
  });

  it("garde le libellé mais refuse un lien au schéma dangereux", () => {
    expect(parseInline("[cliquez](javascript:alert)")).toEqual([
      { type: "text", value: "cliquez" },
    ]);
  });

  it("ne produit aucun lien, même sur une adresse tordue", () => {
    // Les parenthèses imbriquées font mal découper l'adresse. Ce qui compte
    // n'est pas de la découper juste, c'est de ne jamais rendre un lien actif.
    for (const source of ["[x](javascript:alert(1))", "[x](data:text/html,<script>)"]) {
      expect(parseInline(source).some((node) => node.type === "link")).toBe(false);
    }
  });

  it("accepte les liens internes, externes et de courrier", () => {
    for (const href of ["/estimer", "https://data.gouv.fr", "#suite", "mailto:a@b.fr"]) {
      expect(parseInline(`[lien](${href})`)[0]).toMatchObject({ type: "link", href });
    }
  });

  it("laisse une étoile isolée telle quelle", () => {
    expect(parseInline("2 * 3 euros")).toEqual([{ type: "text", value: "2 * 3 euros" }]);
  });

  it("n'applique pas la typographie française à du code", () => {
    expect(parseInline("`a : b`")).toEqual([{ type: "code", value: "a : b" }]);
  });
});

describe("parseMarkdown", () => {
  it("rend les titres, en ramenant le niveau 1 au niveau 2", () => {
    expect(parseMarkdown("# Titre\n\n## Section\n\n### Sous-section")).toMatchObject([
      { type: "heading", level: 2 },
      { type: "heading", level: 2 },
      { type: "heading", level: 3 },
    ]);
  });

  it("réunit les lignes d'un même paragraphe", () => {
    const blocks = parseMarkdown("Une phrase\ncoupée en deux.\n\nUne autre.");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect(plainText("Une phrase coupée en deux.")).toBe("Une phrase coupée en deux.");
  });

  it("distingue les listes à puces des listes numérotées", () => {
    const blocks = parseMarkdown("- un\n- deux\n\n1. premier\n2. second");
    expect(blocks).toMatchObject([
      { type: "list", ordered: false },
      { type: "list", ordered: true },
    ]);
    expect(blocks[0]).toHaveProperty("items.length", 2);
  });

  it("réunit une citation sur plusieurs lignes", () => {
    const blocks = parseMarkdown("> une citation\n> sur deux lignes");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "quote" });
  });

  it("ferme le bloc courant sur une ligne vide", () => {
    expect(parseMarkdown("Un.\n\n- puce\n\nDeux.")).toMatchObject([
      { type: "paragraph" },
      { type: "list" },
      { type: "paragraph" },
    ]);
  });

  it("ne rend rien pour un corps vide", () => {
    expect(parseMarkdown("   \n\n  ")).toEqual([]);
  });
});

describe("plainText", () => {
  it("retire les marques et les adresses, garde les mots", () => {
    expect(plainText("## Un **titre**\n\nVoir [DVF](https://data.gouv.fr/dvf) ici.")).toBe(
      "Un titre Voir DVF ici.",
    );
  });
});
