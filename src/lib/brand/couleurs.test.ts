import { describe, expect, it } from "vitest";

import {
  candidatsDepuisPixels,
  ecartTeinte,
  proposerCouleurs,
  rgbVersTsl,
} from "./couleurs";

/** `#1d4ed8` → `[29, 78, 216]`. */
function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Fabrique un tableau RGBA comme le rendrait `getImageData`, à partir d'une
 * liste de « tant de pixels de cette couleur ». Les tests décrivent ainsi la
 * COMPOSITION d'un logo sans avoir à dessiner quoi que ce soit.
 */
function pixels(
  taches: Array<{ hex: string; nombre: number; alpha?: number }>,
): Uint8ClampedArray {
  const total = taches.reduce((somme, t) => somme + t.nombre, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const { hex, nombre, alpha = 255 } of taches) {
    const [r, g, b] = rgb(hex);
    for (let n = 0; n < nombre; n += 1) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = alpha;
      i += 4;
    }
  }
  return data;
}

/** Le halo d'anticrénelage : la couleur fondue vers le blanc du fond. */
function versBlanc(hex: string, part: number): string {
  const [r, g, b] = rgb(hex);
  const melange = (c: number) =>
    Math.round(c + (255 - c) * part)
      .toString(16)
      .padStart(2, "0");
  return `#${melange(r)}${melange(g)}${melange(b)}`;
}

describe("conversion TSL", () => {
  it("laisse les gris sans teinte et sans saturation", () => {
    for (const gris of ["#000000", "#808080", "#ffffff"]) {
      const [r, g, b] = rgb(gris);
      expect(rgbVersTsl(r, g, b).saturation).toBe(0);
    }
  });

  it("referme le cercle des teintes", () => {
    // 350° et 10° sont deux rouges voisins : la soustraction naïve les
    // déclarerait à 340° l'un de l'autre et laisserait proposer deux rouges.
    expect(ecartTeinte(350, 10)).toBe(20);
    expect(ecartTeinte(10, 350)).toBe(20);
    expect(ecartTeinte(0, 180)).toBe(180);
  });
});

describe("extraction des couleurs d'un logo", () => {
  it("ne compte pas les pixels transparents", () => {
    // Le piège du PNG : le vide autour du logo porte souvent des canaux RGB
    // quelconques. Ici du rouge vif invisible, très majoritaire en nombre.
    const lecture = candidatsDepuisPixels(
      pixels([
        { hex: "#ff0000", nombre: 900, alpha: 0 },
        { hex: "#1d4ed8", nombre: 100 },
      ]),
    );

    expect(lecture.pixelsOpaques).toBe(100);
    expect(lecture.candidats).toHaveLength(1);
    expect(lecture.candidats[0]!.hex).toBe("#1d4ed8");
  });

  it("ignore aussi le contour à demi transparent", () => {
    // Un alpha intermédiaire est du crénelage de bord : sa couleur est déjà
    // diluée, la retenir reviendrait à inventer une nuance.
    const lecture = candidatsDepuisPixels(
      pixels([{ hex: "#1d4ed8", nombre: 50, alpha: 120 }]),
    );

    expect(lecture.pixelsOpaques).toBe(0);
    expect(lecture.candidats).toEqual([]);
  });

  it("se tait sur un logo noir et blanc", () => {
    // Le résultat vrai est « aucune couleur de marque ». Proposer du gris
    // poserait en silence une charte fausse, ce qui est pire que rien.
    const proposition = proposerCouleurs(
      pixels([
        { hex: "#ffffff", nombre: 500 },
        { hex: "#000000", nombre: 400 },
        { hex: "#767676", nombre: 100 },
      ]),
    );

    expect(proposition.pixelsOpaques).toBe(1000);
    expect(proposition.pixelsColores).toBe(0);
    expect(proposition.principale).toBeNull();
    expect(proposition.secondaire).toBeNull();
  });

  it("écarte le blanc cassé, que la seule saturation laisserait passer", () => {
    // #f2f2ff affiche une saturation TSL de 1,00 pour treize points d'écart
    // entre canaux : c'est l'instabilité de la formule près du blanc, et c'est
    // la raison d'être de la borne de clarté.
    const [r, g, b] = rgb("#f2f2ff");
    expect(rgbVersTsl(r, g, b).saturation).toBeGreaterThan(0.9);

    const lecture = candidatsDepuisPixels(
      pixels([{ hex: "#f2f2ff", nombre: 300 }]),
    );
    expect(lecture.candidats).toEqual([]);
  });

  it("regroupe l'anticrénelage avec la couleur qui l'a produit", () => {
    // Neuf nuances intermédiaires, toutes distinctes, contre un seul bleu : un
    // comptage des valeurs exactes en ferait neuf couleurs candidates.
    const halo = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
      hex: versBlanc("#1d4ed8", n / 12),
      nombre: 20,
    }));

    const lecture = candidatsDepuisPixels(
      pixels([{ hex: "#1d4ed8", nombre: 100 }, ...halo]),
    );

    expect(lecture.candidats).toHaveLength(1);
    // Et le représentant est la matière, pas la moyenne du dégradé.
    expect(lecture.candidats[0]!.hex).toBe("#1d4ed8");
    expect(lecture.candidats[0]!.part).toBe(1);
  });

  it("retient une couleur minoritaire mais franche", () => {
    // 4 % de la surface pour l'accent magenta, 96 % pour un vert sourd. Le
    // classement par la seule surface donnerait le vert, qui n'est ici qu'un
    // fond de forme.
    const proposition = proposerCouleurs(
      pixels([
        { hex: "#5f7a4a", nombre: 960 },
        { hex: "#d81b9b", nombre: 40 },
      ]),
    );

    expect(proposition.principale).toBe("#d81b9b");
    expect(proposition.secondaire).toBe("#5f7a4a");
  });

  it("n'inverse pas le classement à saturation comparable", () => {
    // Le contrepoint du test précédent : la tempérance de la surface ne doit
    // pas faire gagner n'importe quel pixel isolé. À vivacité voisine, c'est
    // l'aplat qui l'emporte.
    const proposition = proposerCouleurs(
      pixels([
        { hex: "#1d4ed8", nombre: 960 },
        { hex: "#d81b9b", nombre: 40 },
      ]),
    );

    expect(proposition.principale).toBe("#1d4ed8");
  });

  it("refuse de proposer deux nuances de la même couleur", () => {
    // Le marine et le ciel sont le même bleu pour qui remplit un formulaire de
    // charte. La seconde proposition doit changer de famille, quitte à être
    // moins fréquente.
    const proposition = proposerCouleurs(
      pixels([
        { hex: "#1d4ed8", nombre: 600 },
        { hex: "#2e86d8", nombre: 300 },
        { hex: "#16a34a", nombre: 100 },
      ]),
    );

    expect(proposition.principale).toBe("#1d4ed8");
    expect(proposition.secondaire).toBe("#16a34a");
    // Le bleu clair reste visible dans les candidats : l'utilisateur peut
    // toujours le choisir lui-même, on ne le lui propose simplement pas.
    expect(proposition.candidats.map((c) => c.hex)).toContain("#2e86d8");
  });

  it("ne propose pas de seconde couleur sur un logo monochrome", () => {
    const proposition = proposerCouleurs(
      pixels([
        { hex: "#1d4ed8", nombre: 500 },
        { hex: "#2e86d8", nombre: 200 },
        { hex: "#ffffff", nombre: 300 },
      ]),
    );

    expect(proposition.principale).toBe("#1d4ed8");
    expect(proposition.secondaire).toBeNull();
  });

  it("rend le même résultat quel que soit l'ordre des pixels", () => {
    // Sans ce tri total, l'utilisateur verrait ses couleurs changer d'un
    // rechargement à l'autre, et les tests ci-dessus ne vaudraient rien.
    const composition = [
      { hex: "#1d4ed8", nombre: 300 },
      { hex: "#16a34a", nombre: 300 },
      { hex: "#d81b9b", nombre: 300 },
      { hex: "#ffffff", nombre: 100 },
    ];
    const inverse = [...composition].reverse();

    const a = proposerCouleurs(pixels(composition));
    const b = proposerCouleurs(pixels(composition));
    const c = proposerCouleurs(pixels(inverse));

    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("rend des hexadécimaux normalisés et des parts qui font un tout", () => {
    const lecture = candidatsDepuisPixels(
      pixels([
        { hex: "#1D4ED8", nombre: 250 },
        { hex: "#16A34A", nombre: 250 },
      ]),
    );

    for (const candidat of lecture.candidats) {
      expect(candidat.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    const somme = lecture.candidats.reduce((s, c) => s + c.part, 0);
    expect(somme).toBeCloseTo(1, 10);
  });

  it("ne bronche pas sur un tableau vide", () => {
    const proposition = proposerCouleurs(new Uint8ClampedArray(0));
    expect(proposition).toMatchObject({
      principale: null,
      secondaire: null,
      candidats: [],
      pixelsOpaques: 0,
      pixelsColores: 0,
    });
  });
});
