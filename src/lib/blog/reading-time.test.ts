/**
 * Un temps de lecture faux est pire qu'absent&nbsp;: il fait douter du reste de
 * la page. On vérifie donc les deux bornes, le plancher et le décompte réel.
 */

import { describe, expect, it } from "vitest";

import { countWords, readingMinutes, WORDS_PER_MINUTE } from "./reading-time";

describe("countWords", () => {
  it("compte les mots du texte, pas les marques", () => {
    expect(countWords("Un **prix** au *m²*")).toBe(4);
  });

  it("ne compte pas l'adresse d'un lien", () => {
    // « Voir les données. » : trois mots, quelle que soit la longueur de l'URL.
    expect(countWords("Voir [les données](https://www.data.gouv.fr/fr/datasets/dvf).")).toBe(3);
  });

  it("ignore la ponctuation isolée", () => {
    expect(countWords("Trois mots ici . ; :")).toBe(3);
  });

  it("rend zéro sur un corps vide", () => {
    expect(countWords("   \n\n")).toBe(0);
  });
});

describe("readingMinutes", () => {
  it("arrondit au-dessus", () => {
    expect(readingMinutes("mot ".repeat(WORDS_PER_MINUTE + 1))).toBe(2);
    expect(readingMinutes("mot ".repeat(WORDS_PER_MINUTE * 4))).toBe(4);
  });

  it("n'annonce jamais moins d'une minute", () => {
    expect(readingMinutes("Trois mots seulement.")).toBe(1);
    expect(readingMinutes("")).toBe(1);
  });
});
