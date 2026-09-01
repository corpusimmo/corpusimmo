/**
 * L'en-tête d'un fichier d'article, découpé et lu.
 *
 * POURQUOI un lecteur maison plutôt qu'une dépendance&nbsp;: le besoin tient en
 * trois formes (`clé: valeur`, `clé: [a, b]`, et la liste à tirets), sur des
 * fichiers que nous écrivons nous-mêmes. Ajouter un analyseur YAML complet
 * ferait entrer un format dont 95&nbsp;% des règles ne serviraient jamais, et
 * dont les surprises (le « problème norvégien », les ancres, les dates
 * implicites) coûteraient plus cher que ce qu'elles évitent.
 *
 * Ce module ne VALIDE rien&nbsp;: il rend des chaînes et des tableaux de
 * chaînes, tels qu'écrits. Le jugement appartient à `post.ts`, qui est le seul
 * endroit où l'on décide qu'un article est recevable.
 */

/** Ce qu'un en-tête sait produire&nbsp;: du texte, ou une liste de textes. */
export type FrontMatterValue = string | string[];
export type FrontMatterData = Record<string, FrontMatterValue>;

export interface FrontMatterFile {
  data: FrontMatterData;
  /** Le corps Markdown, en-tête retiré, sans les lignes vides de tête. */
  body: string;
}

const DELIMITER = /^---[ \t]*$/;

/** Retire les guillemets encadrants, droits ou français, s'ils enferment TOUTE la valeur. */
function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length < 2) return value;

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

/** `[a, b, "c, d"]` rendu sous forme de liste. Les entrées vides sont écartées. */
function parseInlineList(raw: string): string[] {
  const inner = raw.slice(1, -1);
  if (!inner.trim()) return [];

  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ",") {
      items.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current.trim());

  return items.filter((item) => item.length > 0);
}

/**
 * Sépare l'en-tête du corps.
 *
 * Un fichier sans en-tête n'est pas une erreur ici&nbsp;: il rend un en-tête
 * vide, et c'est la validation qui dira quelles clés manquent. Le message est
 * ainsi le même, qu'il manque une clé ou l'en-tête entier.
 */
export function splitFrontMatter(raw: string): FrontMatterFile {
  // Le BOM d'un éditeur Windows empêcherait la première ligne de valoir `---`.
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  if (lines.length === 0 || !DELIMITER.test(lines[0] ?? "")) {
    return { data: {}, body: text.trim() };
  }

  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (DELIMITER.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }

  // En-tête ouvert mais jamais refermé&nbsp;: tout le fichier serait avalé comme
  // en-tête. On préfère le traiter comme un fichier sans en-tête du tout.
  if (end === -1) return { data: {}, body: text.trim() };

  return {
    data: parseFrontMatter(lines.slice(1, end)),
    body: lines.slice(end + 1).join("\n").trim(),
  };
}

/** Lit les lignes d'un en-tête déjà délimité. */
export function parseFrontMatter(lines: string[]): FrontMatterData {
  const data: FrontMatterData = {};
  let listKey: string | null = null;

  for (const line of lines) {
    // Une ligne de liste appartient à la clé ouverte juste au-dessus.
    const listItem = /^[ \t]*-[ \t]+(.*)$/.exec(line);
    if (listItem && listKey) {
      const value = unquote(listItem[1] ?? "");
      const current = data[listKey];
      const list = Array.isArray(current) ? current : [];
      if (value) list.push(value);
      data[listKey] = list;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;
    const rawValue = trimmed.slice(separator + 1).trim();

    if (!rawValue) {
      // Une clé sans valeur ouvre une liste à tirets. Si rien ne suit, elle
      // restera un tableau vide, ce que la validation saura interpréter.
      data[key] = [];
      listKey = key;
      continue;
    }

    listKey = null;
    data[key] =
      rawValue.startsWith("[") && rawValue.endsWith("]")
        ? parseInlineList(rawValue)
        : unquote(rawValue);
  }

  return data;
}
