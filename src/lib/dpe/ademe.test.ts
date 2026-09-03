import { describe, expect, it } from "vitest";

import { labelRange, soleLabel, summarise } from "./ademe";

function line(label: string, area?: number, date?: string, ges?: string) {
  return {
    adresse_ban: "6 Allée Brancas 44000 Nantes",
    etiquette_dpe: label,
    etiquette_ges: ges ?? null,
    surface_habitable_logement: area ?? null,
    date_etablissement_dpe: date ?? null,
    type_batiment: "appartement",
  };
}

describe("lecture des diagnostics ADEME", () => {
  it("se tait quand il n'y a rien d'exploitable", () => {
    expect(summarise([])).toBeNull();
    // Une ligne sans étiquette valable n'est pas un diagnostic.
    expect(summarise([line("X", 60)])).toBeNull();
  });

  it("compte la répartition des étiquettes de l'immeuble", () => {
    const reading = summarise([
      line("F", 23.2),
      line("C", 22.1),
      line("G", 20.5),
      line("C", 61),
    ]);

    expect(reading?.count).toBe(4);
    expect(reading?.distribution.C).toBe(2);
    expect(reading?.distribution.F).toBe(1);
    expect(reading?.distribution.A).toBe(0);
  });

  it("rapproche par la surface quand un seul diagnostic correspond", () => {
    const reading = summarise(
      [line("D", 65, "2023-04-01", "C"), line("G", 22, "2024-01-01")],
      64,
    );

    expect(reading?.matched).toMatchObject({ label: "D", ges: "C", area: 65 });
  });

  it("refuse de rapprocher quand deux logements de même surface divergent", () => {
    // Le vrai piège : deux 65 m² dans le même immeuble, l'un en C, l'autre en
    // F. Nommer l'un des deux serait tirer à pile ou face, et c'est
    // exactement ce que fait un affichage naïf du premier résultat.
    const reading = summarise([line("C", 65), line("F", 64.5)], 65);

    expect(reading?.count).toBe(2);
    expect(reading?.matched).toBeNull();
  });

  it("tolère l'écart entre surface bâtie et surface habitable", () => {
    // `surface_reelle_bati` (DVF) et `surface_habitable_logement` (ADEME) ne
    // mesurent pas la même chose : 4 % d'écart doit encore apparier.
    expect(summarise([line("B", 96)], 100)?.matched?.label).toBe("B");
    // 20 % d'écart, en revanche, désigne un autre logement.
    expect(summarise([line("B", 80)], 100)?.matched).toBeNull();
  });

  it("retient le diagnostic le plus récent à étiquette égale", () => {
    const reading = summarise(
      [line("E", 70, "2021-06-01"), line("E", 70, "2025-02-01")],
      70,
    );

    expect(reading?.matched?.date).toBe("2025-02-01");
    expect(reading?.latestDate).toBe("2025-02-01");
  });

  it("ne décrit une fourchette que lorsqu'elle a un sens", () => {
    const mixed = summarise([line("B"), line("E"), line("G")])!;
    expect(labelRange(mixed)).toEqual({ best: "B", worst: "G" });
    expect(soleLabel(mixed)).toBeNull();

    // « de C à C » ne veut rien dire : l'appelant affiche l'étiquette seule.
    const homogeneous = summarise([line("C"), line("C")])!;
    expect(labelRange(homogeneous)).toBeNull();
    expect(soleLabel(homogeneous)).toBe("C");
  });
});
