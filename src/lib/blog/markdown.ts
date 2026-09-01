/**
 * Le Markdown des articles, réduit à ce qu'un article a le droit d'utiliser.
 *
 * POURQUOI un analyseur maison. MDX n'est pas installé, et une bibliothèque de
 * rendu Markdown ferait entrer HTML arbitraire et coloration syntaxique pour
 * six formes de texte. Ici, la grammaire tient en une page&nbsp;: titres de
 * niveau 2 et 3, paragraphes, listes, citations, filets. Rien d'autre ne
 * s'écrit, donc rien d'autre n'est rendu.
 *
 * SÛRETÉ. La sortie est un ARBRE de nœuds, jamais une chaîne HTML. Le composant
 * de rendu construit du JSX à partir de cet arbre, si bien qu'aucun article ne
 * peut injecter de balise&nbsp;: il n'existe pas de chemin entre le fichier et
 * `dangerouslySetInnerHTML`. Les liens sont en plus filtrés par schéma, pour
 * qu'un `javascript:` collé par erreur ne devienne pas un lien actif.
 *
 * TYPOGRAPHIE. L'espace insécable avant les ponctuations doubles est posée ICI,
 * à la lecture, et non à la rédaction. Un auteur qui écrit une espace normale
 * dans son fichier obtient malgré tout la ponctuation française correcte, et
 * personne n'a besoin de savoir taper une insécable dans un éditeur.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3; content: InlineNode[] }
  | { type: "paragraph"; content: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "quote"; content: InlineNode[] }
  | { type: "rule" };

/** Les seuls schémas de lien qu'un article peut produire. */
const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:)/i;

/**
 * L'espacement français, appliqué au texte visible seulement.
 *
 * La ponctuation double ne prend une insécable que si elle est SUIVIE d'une fin
 * de mot&nbsp;: sans cette condition, le « : » d'une adresse `https://` serait
 * disloqué. Les guillemets français prennent la leur des deux côtés.
 */
export function frenchSpacing(text: string): string {
  // \u00A0 est écrit en échappement plutôt qu'en caractère&nbsp;: une insécable
  // littérale dans une source est invisible, donc impossible à relire.
  return text
    .replace(/([^\s\u00A0])[ \u00A0]?([;:!?])(?=[\s\u00A0]|$)/g, "$1\u00A0$2")
    .replace(/«[ \u00A0]?/g, "«\u00A0")
    .replace(/[ \u00A0]?»/g, "\u00A0»");
}

function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href.trim());
}

/** Découpe une ligne en nœuds. Les marques ne s'imbriquent pas&nbsp;: un gras dans un lien reste du texte. */
export function parseInline(raw: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";

  function flush() {
    if (!buffer) return;
    nodes.push({ type: "text", value: frenchSpacing(buffer) });
    buffer = "";
  }

  let index = 0;
  while (index < raw.length) {
    const char = raw[index];

    if (char === "`") {
      const end = raw.indexOf("`", index + 1);
      if (end > index + 1) {
        flush();
        // Pas de `frenchSpacing` dans du code&nbsp;: on y montre des caractères,
        // pas de la prose.
        nodes.push({ type: "code", value: raw.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (char === "[") {
      const labelEnd = raw.indexOf("](", index);
      const hrefEnd = labelEnd === -1 ? -1 : raw.indexOf(")", labelEnd + 2);
      if (labelEnd > index && hrefEnd > labelEnd) {
        const label = raw.slice(index + 1, labelEnd);
        const href = raw.slice(labelEnd + 2, hrefEnd).trim();
        flush();
        if (isSafeHref(href)) {
          nodes.push({ type: "link", value: frenchSpacing(label), href });
        } else {
          // Un lien au schéma refusé ne disparaît pas&nbsp;: son libellé reste
          // lisible, seul le lien tombe.
          nodes.push({ type: "text", value: frenchSpacing(label) });
        }
        index = hrefEnd + 1;
        continue;
      }
    }

    if (char === "*" && raw[index + 1] === "*") {
      const end = raw.indexOf("**", index + 2);
      if (end > index + 2) {
        flush();
        nodes.push({ type: "strong", value: frenchSpacing(raw.slice(index + 2, end)) });
        index = end + 2;
        continue;
      }
    }

    if (char === "*") {
      const end = raw.indexOf("*", index + 1);
      if (end > index + 1) {
        flush();
        nodes.push({ type: "emphasis", value: frenchSpacing(raw.slice(index + 1, end)) });
        index = end + 1;
        continue;
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return nodes;
}

const HEADING = /^(#{1,6})[ \t]+(.*)$/;
const UNORDERED = /^[-*][ \t]+(.*)$/;
const ORDERED = /^\d+[.)][ \t]+(.*)$/;
const QUOTE = /^>[ \t]?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;

/**
 * Le corps d'un article, rendu en blocs.
 *
 * Un titre de niveau 1 est ramené au niveau 2. Le `h1` de la page est le titre
 * déclaré dans l'en-tête&nbsp;: en laisser un second surgir du corps casserait
 * la hiérarchie du document, pour les lecteurs d'écran comme pour les moteurs.
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  function closeParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  }

  function closeQuote() {
    if (quote.length === 0) return;
    blocks.push({ type: "quote", content: parseInline(quote.join(" ")) });
    quote = [];
  }

  function closeList() {
    if (!list) return;
    blocks.push({
      type: "list",
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  }

  function closeAll() {
    closeParagraph();
    closeQuote();
    closeList();
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeAll();
      continue;
    }

    if (RULE.test(trimmed)) {
      closeAll();
      blocks.push({ type: "rule" });
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      closeAll();
      const depth = (heading[1] ?? "#").length;
      blocks.push({
        type: "heading",
        level: depth <= 2 ? 2 : 3,
        content: parseInline(heading[2] ?? ""),
      });
      continue;
    }

    const quoted = QUOTE.exec(trimmed);
    if (quoted) {
      closeParagraph();
      closeList();
      quote.push((quoted[1] ?? "").trim());
      continue;
    }

    const ordered = ORDERED.exec(trimmed);
    const unordered = ordered ? null : UNORDERED.exec(trimmed);
    if (ordered || unordered) {
      closeParagraph();
      closeQuote();
      const item = (ordered?.[1] ?? unordered?.[1] ?? "").trim();
      const wantsOrdered = Boolean(ordered);
      // Changer de type de liste en cours de route en ouvre une nouvelle
      // plutôt que de mélanger puces et numéros dans le même bloc.
      if (list && list.ordered !== wantsOrdered) closeList();
      if (!list) list = { ordered: wantsOrdered, items: [] };
      list.items.push(item);
      continue;
    }

    closeQuote();
    closeList();
    paragraph.push(trimmed);
  }

  closeAll();
  return blocks;
}

/**
 * Le texte nu d'un corps Markdown&nbsp;: ce que quelqu'un lit réellement.
 *
 * Sert au décompte des mots. Les URL sont retirées, les marques aussi&nbsp;:
 * compter `](https://…)` comme des mots gonflerait le temps de lecture de
 * l'article le mieux sourcé, ce qui serait l'exact contraire du but.
 */
export function plainText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*(?:[-*][ \t]+|\d+[.)][ \t]+)/gm, "")
    .replace(/[*_]{1,2}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
