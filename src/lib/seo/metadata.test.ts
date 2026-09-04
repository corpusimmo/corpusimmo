import { describe, expect, it } from "vitest";

import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  canonicalUrl,
  pageMetadata,
  polishMetaText,
} from "./metadata";

const NBSP = " ";

describe("polishMetaText", () => {
  it("remplace le tiret cadratin par une virgule", () => {
    // La consigne éditoriale du propriétaire, appliquée mécaniquement : aucune
    // chaîne de métadonnée ne doit en contenir, y compris celles recopiées
    // depuis un texte écrit pour l'écran.
    expect(polishMetaText("Le taux affiché — pas le coût réel")).toBe(
      "Le taux affiché, pas le coût réel",
    );
    expect(polishMetaText("Un cas – un autre")).toBe("Un cas, un autre");
  });

  it("ne produit jamais deux virgules de suite", () => {
    expect(polishMetaText("assurance, dossier et garantie — pas le taux")).toBe(
      "assurance, dossier et garantie, pas le taux",
    );
    expect(polishMetaText("a, — b")).toBe("a, b");
  });

  it("pose une espace insécable devant la ponctuation double", () => {
    expect(polishMetaText("Trois régimes : le premier")).toBe(`Trois régimes${NBSP}: le premier`);
    expect(polishMetaText("Combien vaut ce bien ?")).toBe(`Combien vaut ce bien${NBSP}?`);
    expect(polishMetaText("un point ; puis l'autre")).toBe(`un point${NBSP}; puis l'autre`);
  });

  it("laisse les deux-points sans espace tranquilles", () => {
    // « https://corpus.immo » ne doit pas devenir « https ://… ».
    expect(polishMetaText("https://corpus.immo")).toBe("https://corpus.immo");
  });
});

describe("canonicalUrl", () => {
  it("produit une URL absolue sur l'apex", () => {
    expect(canonicalUrl("/outils")).toMatch(/^https?:\/\/[^/]+\/outils$/);
    expect(canonicalUrl("/")).toMatch(/\/$/);
    expect(canonicalUrl("/observatoire")).not.toContain("www.");
  });
});

describe("pageMetadata", () => {
  const meta = pageMetadata({
    title: "Estimer un bien immobilier",
    description: "Une description écrite pour une personne, et pas pour un moteur.",
    path: "/estimer",
  });

  it("pose la canonique en relatif, résolue par `metadataBase`", () => {
    expect(meta.alternates?.canonical).toBe("/estimer");
  });

  it("remplit l'Open Graph en entier", () => {
    const og = meta.openGraph;
    expect(og).toBeDefined();
    // `type` n'est présent que sur les variantes discriminées d'OpenGraph :
    // la vérification passe par l'objet brut pour rester lisible.
    expect(og && "type" in og ? og.type : undefined).toBe("website");
    expect(og?.locale).toBe("fr_FR");
    expect(og?.siteName).toBeTruthy();
    expect(og?.url).toMatch(/^https?:\/\//);
    expect(og?.title).toContain("CorpusImmo");
    expect(og?.description).toBeTruthy();
  });

  it("remplit la carte Twitter", () => {
    const twitter = meta.twitter;
    expect(twitter).toBeDefined();
    // `card` n'existe que sur les variantes discriminées de `Twitter` : on
    // interroge l'objet brut plutôt que d'élargir le type de la fabrique.
    expect(twitter && "card" in twitter ? twitter.card : undefined).toBe("summary_large_image");
    expect(twitter?.title).toBeTruthy();
    expect(twitter?.description).toBeTruthy();
  });

  it("ne déclare aucune image, pour laisser la convention de fichier opérer", () => {
    // Déclarer `openGraph.images` ici désactiverait silencieusement
    // `opengraph-image.tsx` : Next ne fusionne l'image générée que si la page
    // n'en propose pas.
    expect(meta.openGraph && "images" in meta.openGraph).toBe(false);
    expect(meta.twitter && "images" in meta.twitter).toBe(false);
  });

  it("sait sortir une page de l'index sans couper le suivi des liens", () => {
    const hidden = pageMetadata({
      title: "Comparables retenus",
      description: "Un écran de service.",
      path: "/observatoire/comparables",
      index: false,
    });
    expect(hidden.robots).toEqual({ index: false, follow: true });
  });

  it("court-circuite le gabarit de titre quand on le lui demande", () => {
    const home = pageMetadata({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      path: "/",
      absoluteTitle: true,
    });
    expect(home.title).toEqual({ absolute: SITE_TITLE });
  });
});

describe("les textes de la marque", () => {
  it("tiennent dans ce qu'un résultat de recherche affiche", () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(140);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(170);
  });

  it("ne contiennent aucun tiret cadratin", () => {
    expect(SITE_TITLE).not.toMatch(/[—–]/);
    expect(SITE_DESCRIPTION).not.toMatch(/[—–]/);
  });
});
