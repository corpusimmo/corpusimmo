import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  breadcrumbNode,
  itemListNode,
  jsonLdDocument,
  organizationNode,
  serializeJsonLd,
  webApplicationNode,
  webSiteNode,
} from "./json-ld";

describe("serializeJsonLd", () => {
  it("ne peut pas refermer la balise qui la contient", () => {
    // Le seul risque réel d'un JSON-LD : une chaîne contenant « </script> ».
    // `JSON.stringify` produit du JSON valide, et du HTML dangereux.
    const serialized = serializeJsonLd({
      "@type": "Thing",
      name: "</script><img src=x onerror=alert(1)>",
    });
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).toContain("\\u003c");
  });

  it("échappe aussi l'esperluette et les séparateurs de ligne Unicode", () => {
    // Les séparateurs sont écrits en échappement : un U+2028 littéral dans un
    // fichier source est invisible et se perd au premier copier-coller.
    const serialized = serializeJsonLd({
      "@type": "Thing",
      name: "a & b\u2028c\u2029d",
    });
    expect(serialized).toContain("\\u0026");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });

  it("reste du JSON strictement équivalent", () => {
    const node = { "@type": "Thing", name: "Prix & surface <m²>" } as const;
    const parsed: unknown = JSON.parse(serializeJsonLd(node));
    expect(parsed).toEqual(node);
  });
});

describe("jsonLdDocument", () => {
  it("aplatit un nœud unique et regroupe les autres dans un graphe", () => {
    const single = jsonLdDocument([organizationNode()]);
    expect(single["@context"]).toBe("https://schema.org");
    expect(single["@type"]).toBe("Organization");

    const many = jsonLdDocument([organizationNode(), webSiteNode()]);
    expect(Array.isArray(many["@graph"])).toBe(true);
  });
});

describe("les nœuds du site", () => {
  it("relie le site à son éditeur par identifiant, sans le redécrire", () => {
    expect(webSiteNode().publisher).toEqual({ "@id": ORGANIZATION_ID });
    expect(organizationNode()["@id"]).toBe(ORGANIZATION_ID);
    expect(webSiteNode()["@id"]).toBe(WEBSITE_ID);
  });

  it("ne déclare aucune recherche interne, faute d'en avoir une", () => {
    // Le champ de la bibliothèque d'outils filtre dix cartes dans le
    // navigateur : il n'existe aucune URL de résultats à donner à Google.
    expect(webSiteNode().potentialAction).toBeUndefined();
  });

  it("n'invente ni note, ni avis, ni coordonnées absentes du site", () => {
    const organization = organizationNode();
    expect(organization.aggregateRating).toBeUndefined();
    expect(organization.review).toBeUndefined();
    expect(organization.telephone).toBeUndefined();
    expect(organization.address).toBeUndefined();
  });

  it("pose toutes les URL en absolu, sur le domaine canonique", () => {
    const values = JSON.stringify([organizationNode(), webSiteNode()]);
    for (const url of values.match(/"https?:\/\/[^"]+"/g) ?? []) {
      expect(() => new URL(url.slice(1, -1))).not.toThrow();
    }
    expect(organizationNode().url).toMatch(/^https?:\/\//);
  });
});

describe("webApplicationNode", () => {
  const paid = webApplicationNode({
    name: "Calculateur de rentabilité locative",
    description: "Les trois rendements et le cash-flow mensuel.",
    path: "/outils/rentabilite-locative",
    category: "FinanceApplication",
  });

  it("annonce la gratuité, parce que rien n'est vendu", () => {
    expect(paid.offers).toMatchObject({ price: "0", priceCurrency: "EUR" });
  });

  it("ne déclare l'accès libre que là où il l'est vraiment", () => {
    // Les calculateurs demandent une connexion : la propriété est OMISE plutôt
    // que mise à `false`, `false` signalant un paywall qui n'existe pas.
    expect(paid.isAccessibleForFree).toBeUndefined();

    const open = webApplicationNode({
      name: "Carte des ventes",
      description: "Les mutations DVF, sur une carte.",
      path: "/carte",
      category: "BusinessApplication",
      accessibleForFree: true,
    });
    expect(open.isAccessibleForFree).toBe(true);
  });
});

describe("breadcrumbNode", () => {
  it("numérote les niveaux et donne des URL absolues", () => {
    const node = breadcrumbNode([
      { name: "Accueil", path: "/" },
      { name: "Outils", path: "/outils" },
      { name: "WAULT", path: "/outils/wault" },
    ]);
    const items = node.itemListElement;
    expect(Array.isArray(items)).toBe(true);
    const list = items as readonly { position: number; item: string }[];
    expect(list.map((entry) => entry.position)).toEqual([1, 2, 3]);
    for (const entry of list) {
      expect(entry.item).toMatch(/^https?:\/\//);
    }
  });
});

/**
 * LA FAQ QUI N'EXISTE PAS.
 *
 * `faqNode` est livré mais n'est utilisé nulle part, et ce test est là pour que
 * ça reste vrai tant qu'aucune page n'affiche de vraies questions-réponses.
 * Baliser une FAQ absente de l'écran est une infraction explicite aux règles de
 * Google, et la sanction porte sur le domaine entier, pas sur la page.
 *
 * Le jour où une page en affiche une, il faudra remplacer cette assertion par
 * la vérification que les couples balisés sont EXACTEMENT ceux rendus dans le
 * HTML, mot pour mot.
 */
describe("FAQPage", () => {
  it("n'est posé sur aucune page, faute de questions-réponses affichées", () => {
    const pages: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) pages.push(readFileSync(full, "utf8"));
      }
    };
    walk(join(process.cwd(), "src", "app"));

    expect(pages.length).toBeGreaterThan(0);
    expect(pages.filter((source) => source.includes("faqNode("))).toEqual([]);
    expect(pages.filter((source) => source.includes("FAQPage"))).toEqual([]);
  });
});

describe("itemListNode", () => {
  it("compte ce qu'il annonce", () => {
    const node = itemListNode("Deux outils", [
      { name: "A", path: "/outils/a", description: "a" },
      { name: "B", path: "/outils/b", description: "b" },
    ]);
    expect(node.numberOfItems).toBe(2);
  });
});
