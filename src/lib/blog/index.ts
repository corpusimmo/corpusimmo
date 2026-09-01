/**
 * Le journal, en une seule porte d'entrée.
 *
 * Les pages importent d'ici et jamais d'un fichier interne&nbsp;: le découpage
 * en lecture, validation, sélection et rendu doit pouvoir bouger sans qu'une
 * page s'en aperçoive.
 */

export { blogCategories, blogCategoryLabel, blogCategoryIds, isBlogCategory } from "./taxonomy";
export type { BlogCategory } from "./taxonomy";

export { blogDateTime, blogRssDate, formatBlogDate } from "./format";

export { parseMarkdown, parseInline, plainText, frenchSpacing } from "./markdown";
export type { InlineNode, MarkdownBlock } from "./markdown";

export { countWords, readingMinutes, WORDS_PER_MINUTE } from "./reading-time";

export { BlogContentError, parseBlogPost, slugFromFileName } from "./post";

export {
  byCategory,
  byTag,
  draftsOnly,
  publishedOnly,
  relatedTo,
  sitemapEntriesFor,
  sortPosts,
  tagCounts,
} from "./select";

export {
  BLOG_CONTENT_DIR,
  allBlogPosts,
  blogSitemapEntries,
  draftsAreVisible,
  findVisibleBlogPost,
  hasPublishedBlogPosts,
  loadBlogPosts,
  publishedBlogPosts,
  resetBlogCache,
  visibleBlogPosts,
} from "./registry";

export { blogRssFeed, escapeXml } from "./rss";
export type { BlogRssInput } from "./rss";

export { BLOG_IS_PUBLIC, blogRobots } from "./visibility";
export type { BlogRobots } from "./visibility";
