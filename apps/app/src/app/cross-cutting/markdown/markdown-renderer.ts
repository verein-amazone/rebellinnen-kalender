import { DOCUMENT, Injectable, inject } from '@angular/core';
import DOMPurify, { type Config } from 'dompurify';
import { Marked, type Token, type TokenizerAndRendererExtension } from 'marked';

/**
 * Internal wrapper around the `marked` package. This is the only place `marked`
 * types and APIs are used; feature code must depend on this renderer (or the
 * MarkdownContentComponent) rather than importing `marked` directly.
 *
 * `marked` produces HTML from the Markdown; DOMPurify then reduces that HTML to a
 * strict, declarative allow-list. We never build HTML strings by hand and never
 * use `bypassSecurityTrustHtml`. The MarkdownContentComponent binds the result
 * through `[innerHTML]`, so Angular's sanitizer runs as a second layer.
 *
 * A web link leaves the app - the system browser on native, a new tab on the web - so the sanitized
 * result marks it as such, like every other external link in the app: `target="_blank"` and a
 * visually hidden „, öffnet in einem neuen Fenster“. That happens after sanitizing, on the DOM
 * DOMPurify returns, so the allow-list itself stays as strict as the Markdown needs.
 */

/** Elements that make up the supported Markdown subset; `div` only ever comes from a callout. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'em',
  'strong',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'h2',
  'h3',
  'div',
];

/** Only links may carry attributes, and only their `href`. */
const ALLOWED_ATTR = ['href'];

/** A link that leaves the app; `mailto:` hands over to the mail app and needs no new window. */
const EXTERNAL_HREF = /^https?:/i;

/**
 * Allow `http:` / `https:`, `mailto:` (the OS hands it to the mail app) plus scheme-less links
 * (relative paths and anchors); reject every other scheme such as `javascript:` or `data:`. This is
 * the default DOMPurify URI pattern with the other built-in schemes removed.
 */
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

const SANITIZE_CONFIG: Config = { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP };

/** A callout's opening line, GitHub's alert syntax: `> [!NOTE]`, then the quoted body below it. */
const CALLOUT = /^ {0,3}> ?\[!NOTE\][ \t]*\n((?: {0,3}>.*(?:\n|$))+)/;

/**
 * A highlighted block for what a reader must not miss, written as a GitHub alert. Rendered as a
 * plain `<div>`: it is emphasis, not a quotation, so it must not become a `<blockquote>`, and the
 * styling needs no class - `.rk-markdown-content > div` is only ever a callout.
 */
const calloutExtension: TokenizerAndRendererExtension = {
  name: 'callout',
  level: 'block',
  start: (src) => /^ {0,3}> ?\[!NOTE\]/m.exec(src)?.index,
  tokenizer(src) {
    const match = CALLOUT.exec(src);
    if (match === null) {
      return undefined;
    }
    const body = match[1].replace(/^ {0,3}> ?/gm, '');
    return { type: 'callout', raw: match[0], tokens: this.lexer.blockTokens(body, []) };
  },
  renderer(token) {
    return `<div>${this.parser.parse(token.tokens ?? [])}</div>\n`;
  },
};

@Injectable({ providedIn: 'root' })
export class MarkdownRenderer {
  private readonly document = inject(DOCUMENT);

  private readonly marked = new Marked({
    gfm: true,
    breaks: false,
    extensions: [calloutExtension],
    // Raw HTML in the source is dropped before sanitizing, so every allowed tag - the callout's
    // `div` included - can only come from Markdown syntax. The text between the tags stays.
    renderer: { html: () => '' },
  });

  /**
   * Convert Markdown to sanitized, semantic HTML restricted to the supported
   * subset. The output is always a plain string that is safe to bind through
   * Angular's `[innerHTML]`.
   */
  render(markdown: string): string {
    if (!markdown) {
      return '';
    }

    const rawHtml = this.marked.parse(markdown, { async: false });
    const fragment = DOMPurify.sanitize(rawHtml, { ...SANITIZE_CONFIG, RETURN_DOM_FRAGMENT: true });
    for (const link of fragment.querySelectorAll('a')) {
      if (EXTERNAL_HREF.test(link.getAttribute('href') ?? '')) {
        this.markExternal(link);
      }
    }

    const container = this.document.createElement('div');
    container.append(fragment);
    return container.innerHTML;
  }

  private markExternal(link: HTMLAnchorElement): void {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const hint = this.document.createElement('span');
    hint.className = 'sr-only';
    hint.textContent = ', öffnet in einem neuen Fenster';
    link.append(hint);
  }

  /**
   * The readable text of a Markdown document, without its syntax - what a search index should see.
   * Link targets and image sources are left out; their labels are kept. Blocks are separated by a
   * space so the last word of one paragraph never runs into the first of the next.
   */
  toPlainText(markdown: string): string {
    if (!markdown) {
      return '';
    }

    return plainText(this.marked.lexer(markdown)).replace(/\s+/g, ' ').trim();
  }
}

/** Leaf text of a token tree: a token with children contributes its children, any other its text. */
function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens) && token.tokens.length > 0) {
        return plainText(token.tokens);
      }
      if (token.type === 'list') {
        return plainText(token.items as Token[]);
      }
      return 'text' in token && typeof token.text === 'string' ? token.text : '';
    })
    .join(' ');
}
