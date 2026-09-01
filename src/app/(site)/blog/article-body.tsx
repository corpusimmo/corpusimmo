/**
 * Le rendu d'un article, du bloc analysé au JSX.
 *
 * Aucun `dangerouslySetInnerHTML` ici, et c'est le point le plus important du
 * fichier. Le corps d'un article est un ARBRE de nœuds produit par notre propre
 * analyseur, et chaque nœud devient un élément React typé. Il n'existe donc
 * aucun chemin par lequel un fichier Markdown pourrait faire entrer une balise,
 * un attribut ou un script dans la page.
 *
 * La mise en forme reste au niveau des tokens du design system. Une classe
 * `prose` générique imposerait ses propres couleurs et ses propres graisses,
 * c'est-à-dire une seconde direction artistique à côté de celle de
 * `globals.css`.
 */

import Link from "next/link";

import type { InlineNode, MarkdownBlock } from "@/lib/blog";

/** Un lien sortant s'ouvre à côté&nbsp;; un lien interne reste dans la navigation client. */
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function InlineNodes({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.type}-${index}`;

        switch (node.type) {
          case "strong":
            return (
              <strong key={key} className="font-semibold text-ink">
                {node.value}
              </strong>
            );
          case "emphasis":
            return (
              <em key={key} className="italic">
                {node.value}
              </em>
            );
          case "code":
            return (
              <code
                key={key}
                className="rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
              >
                {node.value}
              </code>
            );
          case "link":
            return isExternal(node.href) ? (
              <a
                key={key}
                href={node.href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline decoration-accent-rule underline-offset-2 hover:text-accent-hover"
              >
                {node.value}
              </a>
            ) : (
              <Link
                key={key}
                href={node.href}
                className="text-accent underline decoration-accent-rule underline-offset-2 hover:text-accent-hover"
              >
                {node.value}
              </Link>
            );
          default:
            return <span key={key}>{node.value}</span>;
        }
      })}
    </>
  );
}

export function ArticleBody({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2
                key={key}
                className="mt-4 font-display text-2xl leading-snug text-ink first:mt-0"
              >
                <InlineNodes nodes={block.content} />
              </h2>
            ) : (
              <h3 key={key} className="mt-2 font-display text-xl leading-snug text-ink">
                <InlineNodes nodes={block.content} />
              </h3>
            );

          case "list":
            return block.ordered ? (
              <ol key={key} className="flex list-none flex-col gap-2.5">
                {block.items.map((item, itemIndex) => (
                  <li key={`item-${itemIndex}`} className="flex gap-3 text-ink-muted">
                    <span
                      aria-hidden="true"
                      className="tnum mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-accent"
                    >
                      {itemIndex + 1}.
                    </span>
                    <span className="leading-relaxed">
                      <InlineNodes nodes={item} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={key} className="flex list-none flex-col gap-2.5">
                {block.items.map((item, itemIndex) => (
                  <li key={`item-${itemIndex}`} className="flex gap-3 text-ink-muted">
                    <span
                      aria-hidden="true"
                      className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent-rule"
                    />
                    <span className="leading-relaxed">
                      <InlineNodes nodes={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-accent-rule bg-surface-2 py-3 pl-5 pr-4 font-display text-lg leading-relaxed text-ink"
              >
                <InlineNodes nodes={block.content} />
              </blockquote>
            );

          case "rule":
            return <hr key={key} className="border-t border-border-soft" />;

          default:
            return (
              <p key={key} className="leading-relaxed text-ink-muted">
                <InlineNodes nodes={block.content} />
              </p>
            );
        }
      })}
    </div>
  );
}
