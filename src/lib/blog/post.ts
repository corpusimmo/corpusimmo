/**
 * La frontière entre un fichier écrit à la main et un article publiable.
 *
 * Tout ce qui vient du disque est traité comme faillible. Un en-tête est écrit
 * par un humain, souvent tard, parfois copié depuis un autre article&nbsp;: il
 * manquera une clé, une date sera fausse, une rubrique aura été inventée.
 *
 * La règle est donc&nbsp;: on refuse TÔT et on le dit CLAIREMENT. Un article
 * incomplet fait échouer la lecture avec le nom du fichier et la clé fautive,
 * plutôt que de produire une page où le titre s'affiche « undefined » ou dont
 * la date de publication est « Invalid Date ». Un build rouge avec un message
 * exact coûte cinq minutes&nbsp;; une page en ligne avec une date absurde coûte
 * la confiance.
 *
 * Le défaut de `status` est `draft`, jamais `published`. Oublier la clé ne peut
 * donc pas publier quelque chose par accident&nbsp;: le silence vaut brouillon.
 */

import type { BlogAuthor, BlogPost, BlogStatus } from "@/types/blog";

import { splitFrontMatter, type FrontMatterData, type FrontMatterValue } from "./front-matter";
import { readingMinutes } from "./reading-time";
import { blogCategoryIds, isBlogCategory } from "./taxonomy";

/** Une erreur de CONTENU, pas de code. Elle nomme toujours le fichier fautif. */
export class BlogContentError extends Error {
  readonly file: string;

  constructor(file: string, message: string) {
    super(`Article « ${file} » : ${message}`);
    this.name = "BlogContentError";
    this.file = file;
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function asText(value: FrontMatterValue | undefined): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  // Une clé écrite en liste là où un texte est attendu&nbsp;: on prend la
  // première entrée plutôt que d'échouer sur une faute de frappe bénigne.
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return undefined;
}

function asList(value: FrontMatterValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function requireText(data: FrontMatterData, key: string, file: string): string {
  const value = asText(data[key]);
  if (!value) {
    throw new BlogContentError(file, `la clé « ${key} » est absente ou vide dans l'en-tête.`);
  }
  return value;
}

/**
 * Une date d'article est un JOUR, pas un instant.
 *
 * La comparaison porte sur la chaîne re-sérialisée&nbsp;: `2026-02-31` passe le
 * test de format, mais pas celui-ci, parce que JavaScript le glisserait
 * silencieusement au 3 mars.
 */
function requireDay(raw: string, key: string, file: string): string {
  if (!ISO_DAY.test(raw)) {
    throw new BlogContentError(
      file,
      `la clé « ${key} » doit être une date au format AAAA-MM-JJ (reçu « ${raw} »).`,
    );
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new BlogContentError(file, `la clé « ${key} » n'est pas une date réelle (${raw}).`);
  }
  return raw;
}

function requireStatus(raw: string | undefined, file: string): BlogStatus {
  if (raw === undefined) return "draft";
  if (raw === "draft" || raw === "published") return raw;
  throw new BlogContentError(
    file,
    `la clé « status » vaut « ${raw} », or seules « draft » et « published » existent.`,
  );
}

function requireSlug(raw: string, file: string): string {
  if (!SLUG.test(raw)) {
    throw new BlogContentError(
      file,
      `le slug « ${raw} » n'est pas utilisable dans une URL ` +
        `(minuscules, chiffres et tirets simples uniquement).`,
    );
  }
  return raw;
}

/** Une image sociale sert dans une balise Open Graph&nbsp;: elle doit être atteignable. */
function optionalImage(raw: string | undefined, file: string): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith("/") && !/^https?:\/\//i.test(raw)) {
    throw new BlogContentError(
      file,
      `la clé « socialImage » doit commencer par « / » ou « https:// » (reçu « ${raw} »).`,
    );
  }
  return raw;
}

/** Étiquettes&nbsp;: minuscules, dédoublonnées, ordre d'écriture conservé. */
function normaliseTags(values: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = value.toLocaleLowerCase("fr-FR");
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/**
 * Le nom de fichier fait foi pour le slug.
 *
 * Le déduire du fichier garantit qu'il n'existe jamais deux articles à la même
 * URL, et qu'un article se retrouve par son adresse. La clé `slug` de l'en-tête
 * reste possible pour renommer une URL sans renommer le fichier, ce qui arrive
 * quand un titre change après publication.
 */
export function slugFromFileName(fileName: string): string {
  return fileName.replace(/\.mdx?$/i, "");
}

export function parseBlogPost(fileName: string, raw: string): BlogPost {
  const { data, body } = splitFrontMatter(raw);

  const slug = requireSlug(asText(data["slug"]) ?? slugFromFileName(fileName), fileName);
  const title = requireText(data, "title", fileName);
  const excerpt = requireText(data, "excerpt", fileName);
  const category = requireText(data, "category", fileName);

  if (!isBlogCategory(category)) {
    throw new BlogContentError(
      fileName,
      `la rubrique « ${category} » n'existe pas. ` +
        `Rubriques disponibles : ${blogCategoryIds.join(", ")}.`,
    );
  }

  const publishedAt = requireDay(requireText(data, "publishedAt", fileName), "publishedAt", fileName);
  const updatedRaw = asText(data["updatedAt"]);
  const updatedAt = updatedRaw ? requireDay(updatedRaw, "updatedAt", fileName) : publishedAt;

  if (updatedAt < publishedAt) {
    throw new BlogContentError(
      fileName,
      `la mise à jour (${updatedAt}) précède la publication (${publishedAt}).`,
    );
  }

  if (!body.trim()) {
    throw new BlogContentError(fileName, "le corps de l'article est vide.");
  }

  const author: BlogAuthor = { name: requireText(data, "author", fileName) };
  const role = asText(data["authorRole"]);
  if (role) author.role = role;

  const post: BlogPost = {
    slug,
    title,
    excerpt,
    publishedAt,
    updatedAt,
    author,
    category,
    tags: normaliseTags(asList(data["tags"])),
    readingMinutes: readingMinutes(body),
    status: requireStatus(asText(data["status"]), fileName),
    // Un article qui se cite lui-même produirait un lien vers la page courante.
    related: asList(data["related"]).filter((entry) => entry !== slug),
    body,
    sourceFile: fileName,
  };

  const socialImage = optionalImage(asText(data["socialImage"]), fileName);
  if (socialImage) post.socialImage = socialImage;

  return post;
}
