import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE MODULE D'IMAGE SOCIALE NE DOIT RIEN LIRE SUR LE DISQUE À L'IMPORT.
 *
 * Ce n'est pas une préférence de style, c'est la panne la plus coûteuse
 * qu'ait connue ce dépôt, et elle était invisible en local.
 *
 * Pour résoudre les métadonnées d'une page, Next charge le module
 * `opengraph-image` voisin afin d'en lire la taille et le type. Sur une page
 * PRÉ-RENDUE, cela se passe à la construction, où tout le dépôt est présent.
 * Sur une page rendue À LA DEMANDE, cela se passe dans la fonction déployée,
 * où seuls les fichiers tracés existent, et `og-fond.jpg` n'est tracé que
 * pour les routes d'image. Une lecture au chargement du module levait donc
 * ENOENT en production, sur TOUTE page dynamique : le rendu des métadonnées
 * échouait en silence, la page partait sans `<title>`, et l'écran d'erreur
 * prenait la main à l'hydratation alors que le contenu était bien là. C'est
 * ce qui a rendu la connexion et l'espace membre inatteignables.
 *
 * POURQUOI LIRE LE TEXTE PLUTÔT QU'ÉPROUVER LE COMPORTEMENT. La version
 * évidente de ce test remplace `node:fs` par une version explosive et importe
 * le module. Elle a été écrite, et elle ne détecte rien : Vitest laisse
 * `node:fs` hors de son graphe pour un module transformé, et le faux n'est
 * jamais consulté. Un test qui passe quelle que soit la faute est pire que
 * pas de test. On lit donc le fichier.
 *
 * LA RÈGLE. Toute ligne qui appelle `readFileSync` doit être INDENTÉE, c'est
 * à dire se trouver dans un bloc. Une lecture au chargement du module commence
 * nécessairement en colonne zéro, que la valeur tienne sur une ligne ou que
 * l'appel s'étale sur plusieurs. C'est grossier, et c'est exact pour ce qu'on
 * surveille.
 */
describe("le module d'image sociale", () => {
  it("ne lit aucun fichier au chargement du module", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/seo/og-image.tsx"),
      "utf8",
    );

    const fautives = source
      .split("\n")
      .map((ligne, index) => ({ ligne, numero: index + 1 }))
      .filter(
        ({ ligne }) =>
          ligne.includes("readFileSync(") && !/^\s/.test(ligne),
      );

    expect(
      fautives,
      `lecture de fichier au chargement du module, ligne ${fautives
        .map((f) => f.numero)
        .join(", ")} : voir l'en-tête de ce test`,
    ).toEqual([]);
  });
});
