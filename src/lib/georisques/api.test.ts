import { describe, expect, it } from "vitest";

import {
  severityRank,
  summariseRisks,
  type GeorisquesReport,
} from "./api";

/**
 * Les libellés utilisés ici sont ceux réellement rendus par l'API, relevés sur
 * Nantes, Paris, Lens, Feyzin et Chamonix. Les deux orthographes de l'inconnu
 * (« Risque Inconnu » et « Risque non Connu ») cohabitent bel et bien.
 */
function status(
  libelle: string,
  present: boolean,
  commune: string | null,
  adresse: string | null,
) {
  return {
    present,
    libelle,
    libelleStatutCommune: commune,
    libelleStatutAdresse: adresse,
    specifique: null,
  };
}

function report(
  naturels: Record<string, ReturnType<typeof status>>,
  technologiques: Record<string, ReturnType<typeof status>> = {},
): GeorisquesReport {
  return {
    adresse: { libelle: "6 Allée Brancas, 44000 Nantes" },
    commune: { libelle: "Nantes" },
    url: "https://www.georisques.gouv.fr/mes-risques/…",
    risquesNaturels: naturels,
    risquesTechnologiques: technologiques,
  };
}

describe("lecture des risques Géorisques", () => {
  it("se tait quand il n'y a rien à dire", () => {
    expect(summariseRisks(null)).toBeNull();
    expect(summariseRisks(undefined)).toBeNull();
    expect(summariseRisks(report({}))).toBeNull();
    // Un risque absent de la commune porte deux statuts nuls : rien à en tirer.
    expect(
      summariseRisks(report({ avalanche: status("Avalanche", false, null, null) })),
    ).toBeNull();
  });

  it("retient les risques établis à l'adresse, avec leur niveau", () => {
    const reading = summariseRisks(
      report(
        {
          inondation: status(
            "Inondation",
            true,
            "Risque Existant",
            "Risque Existant",
          ),
          retraitGonflementArgile: status(
            "Retrait gonflement des argiles",
            true,
            "Risque Existant - modéré",
            "Risque Existant - faible",
          ),
        },
        {
          pollutionSols: status(
            "Pollution des sols",
            true,
            "Risque Concerne",
            "Risque Concerne",
          ),
        },
      ),
    );

    expect(reading?.atAddress).toHaveLength(3);
    expect(reading?.unqualified).toHaveLength(0);
    expect(
      reading?.atAddress.find((r) => r.key === "retraitGonflementArgile"),
    ).toMatchObject({ level: "faible", family: "naturel" });
    expect(
      reading?.atAddress.find((r) => r.key === "pollutionSols"),
    ).toMatchObject({ level: null, family: "technologique" });
    expect(reading?.commune).toBe("Nantes");
  });

  it("ne confond jamais « non Concerne » avec « Concerne »", () => {
    // Le piège de sous-chaîne : « non Concerne » contient « Concerne », et
    // « non Connu » contient « Connu ». Relevé à Chamonix, où les ICPE
    // concernent la commune sans concerner l'adresse.
    const reading = summariseRisks(
      report(
        {},
        {
          icpe: status(
            "Installations industrielles classées (ICPE)",
            true,
            "Risque Concerne",
            "Risque non Concerne",
          ),
        },
      ),
    );

    // Écarté à l'adresse : ni annoncé comme établi, ni signalé comme inconnu.
    expect(reading).toBeNull();
  });

  it("range l'inconnu à part, sans le transformer en absence de risque", () => {
    // Relevé à Lens : le risque minier existe sur la commune, la donnée ne
    // descend pas à l'adresse. Le taire reviendrait à dire qu'il n'y en a pas.
    const reading = summariseRisks(
      report({
        risqueMinier: status(
          "Risques miniers",
          true,
          "Risque Existant",
          "Risque Inconnu",
        ),
        mouvementTerrain: status(
          "Mouvements de terrain",
          true,
          "Risque Existant",
          "Risque non Connu",
        ),
        seisme: status(
          "Séisme",
          true,
          "Risque Existant - faible",
          "Risque Existant - faible",
        ),
      }),
    );

    expect(reading?.atAddress.map((r) => r.key)).toEqual(["seisme"]);
    expect(reading?.unqualified.map((r) => r.key).sort()).toEqual([
      "mouvementTerrain",
      "risqueMinier",
    ]);
  });

  it("hérite du niveau de la commune pour un risque non qualifié", () => {
    const reading = summariseRisks(
      report({
        retraitGonflementArgile: status(
          "Retrait gonflement des argiles",
          true,
          "Risque Existant - important",
          "Risque non Connu",
        ),
      }),
    );

    expect(reading?.unqualified[0]).toMatchObject({ level: "important" });
  });

  it("traite un statut manquant ou inédit comme inconnu, jamais comme établi", () => {
    const reading = summariseRisks(
      report({
        radon: status("Radon", true, "Risque Existant - important", null),
        cyclone: status("Vent violent", true, "Risque Existant", "Statut Ubuesque"),
      }),
    );

    expect(reading?.atAddress).toHaveLength(0);
    expect(reading?.unqualified.map((r) => r.key).sort()).toEqual([
      "cyclone",
      "radon",
    ]);
  });

  it("classe les risques du plus fort au plus faible", () => {
    // Un risque établi sans niveau (l'inondation est binaire) passe devant
    // « faible » : l'API ne le gradue pas parce qu'il ne se gradue pas.
    const reading = summariseRisks(
      report({
        seisme: status("Séisme", true, "…", "Risque Existant - faible"),
        inondation: status("Inondation", true, "…", "Risque Existant"),
        radon: status("Radon", true, "…", "Risque Existant - important"),
        argile: status("Argiles", true, "…", "Risque Existant - modéré"),
      }),
    );

    expect(reading?.atAddress.map((r) => r.key)).toEqual([
      "radon",
      "argile",
      "inondation",
      "seisme",
    ]);
    // À poids égal, l'ordre est alphabétique et donc stable d'un appel à l'autre.
    expect(severityRank(reading!.atAddress[1]!)).toBe(
      severityRank(reading!.atAddress[2]!),
    );
  });

  it("compte les anciens sites industriels, et ignore un compte nul", () => {
    const nothing = report({});

    expect(summariseRisks(nothing, 52)?.formerIndustrialSites).toEqual({
      count: 52,
      radiusM: 500,
    });
    // Zéro site connu ne mérite pas une ligne : c'est le cas général en
    // campagne, et l'inventaire CASIAS n'est pas exhaustif.
    expect(summariseRisks(nothing, 0)).toBeNull();
    expect(summariseRisks(nothing, null)).toBeNull();
    // L'enrichissement seul suffit à rendre une lecture.
    expect(summariseRisks(nothing, 3)?.atAddress).toEqual([]);
  });

  it("survit à une réponse tronquée", () => {
    expect(summariseRisks({})).toBeNull();
    expect(
      summariseRisks({ risquesNaturels: null, risquesTechnologiques: null }, 4)
        ?.formerIndustrialSites?.count,
    ).toBe(4);
    const partial = summariseRisks(
      { risquesNaturels: { seisme: { present: true, libelleStatutAdresse: "Risque Existant" } } },
    );
    // Sans libellé, la clé technique fait office de nom : mieux qu'un vide.
    expect(partial?.atAddress[0]).toMatchObject({ key: "seisme", label: "seisme" });
    expect(partial?.address).toBeUndefined();
  });
});
