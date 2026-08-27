const WORDS_PER_MINUTE = 200;

/**
 * Estimated reading time label for a Markdown body - word count over an average adult reading
 * speed, rounded up to whole minutes. Markdown syntax characters (`#`, `*`, `-`, `[]()`) are cheap
 * to read and contribute negligible noise to a word-count estimate, so the raw source is counted
 * as-is rather than stripped first.
 */
export function estimateReadingTime(markdown: string): string {
  const wordCount = markdown.trim().length === 0 ? 0 : markdown.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
  return `${minutes} Min. Lesezeit`;
}
