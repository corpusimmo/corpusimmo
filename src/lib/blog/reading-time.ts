/**
 * Le temps de lecture, calculé et non déclaré.
 *
 * Il est CALCULÉ pour une raison simple&nbsp;: un chiffre saisi à la main dans
 * un en-tête devient faux à la première relecture qui allonge l'article, et
 * personne ne le corrige jamais. Un chiffre dérivé du texte, lui, ne peut pas
 * mentir.
 *
 * 200 mots par minute est la vitesse de lecture attentive couramment retenue
 * pour du français informatif. Elle est basse à dessein&nbsp;: mieux vaut
 * annoncer sept minutes et en prendre cinq que l'inverse.
 */

import { plainText } from "./markdown";

export const WORDS_PER_MINUTE = 200;

/** Le nombre de mots réellement lus, marques Markdown et URL retirées. */
export function countWords(source: string): number {
  const text = plainText(source);
  if (!text) return 0;
  return text.split(/[\s\u00A0]+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * Le temps de lecture en minutes, arrondi au-dessus.
 *
 * Jamais zéro&nbsp;: un article qui annoncerait « 0 min de lecture » ferait
 * douter du reste de la page. Le plancher est une minute, même pour une brève.
 */
export function readingMinutes(source: string): number {
  const words = countWords(source);
  if (words === 0) return 1;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
