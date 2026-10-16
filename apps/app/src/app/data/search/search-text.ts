/**
 * How text is prepared for the full-text indexes (`content_search`, `support_service_search`, see
 * `021-search-index.ts`) and how a query is turned into an FTS5 `MATCH` expression.
 *
 * Both sides go through {@link foldForSearch}, so a query matches exactly when its folded form is
 * part of the folded text. The indexes use the `trigram` tokenizer, which matches any run of three
 * or more characters - inside a word too, which German compounds need (`beratung` finds
 * `Mädchenberatungsstelle`).
 */

/** Below this, a term cannot match: the trigram index has nothing shorter to look up. */
export const MIN_TERM_LENGTH = 3;

/**
 * The comparable form of a text: lowercase, without diacritics (`ä` → `a`, `é` → `e`), `ß` as
 * `ss`, without the characters German writes inside a word to gender it (`Rebell*innen`,
 * `Mädchen:treff`, `Schüler_innen` all read as one word), and with every other punctuation mark
 * turned into a space, so `Queer-Treffs` matches `queer treffs`.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/(?<=\p{L})[*:_·](?=\p{L})/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The `MATCH` expression for what the user typed, or `null` when it holds no term long enough to
 * look up - the caller then shows the unfiltered list.
 *
 * Every term must match (`frauen tirol` finds a service in Tirol for women), in any column and in
 * any order. Terms shorter than {@link MIN_TERM_LENGTH} are dropped rather than failing the whole
 * query. Each term is an FTS5 string literal, so nothing the user types is read as query syntax.
 */
export function toFtsMatch(query: string): string | null {
  const terms = foldForSearch(query)
    .split(' ')
    .filter((term) => term.length >= MIN_TERM_LENGTH);

  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(' AND ');
}
