import { Injectable } from '@angular/core';
import DOMPurify, { type Config } from 'dompurify';
import { Marked } from 'marked';

/**
 * Internal wrapper around the `marked` package. This is the only place `marked`
 * types and APIs are used; feature code must depend on this renderer (or the
 * MarkdownContentComponent) rather than importing `marked` directly.
 *
 * `marked` produces HTML from the Markdown; DOMPurify then reduces that HTML to a
 * strict, declarative allow-list. We never build HTML strings by hand and never
 * use `bypassSecurityTrustHtml`. The MarkdownContentComponent binds the result
 * through `[innerHTML]`, so Angular's sanitizer runs as a second layer.
 */

/** Elements that make up the supported Markdown subset. */
const ALLOWED_TAGS = ['p', 'br', 'em', 'strong', 'ul', 'ol', 'li', 'blockquote', 'a', 'h2', 'h3'];

/** Only links may carry attributes, and only their `href`. */
const ALLOWED_ATTR = ['href'];

/**
 * Allow `http:` / `https:` plus scheme-less links (relative paths and anchors);
 * reject every other scheme such as `javascript:`, `data:` or `mailto:`. This is
 * the default DOMPurify URI pattern with the extra built-in schemes removed.
 */
const ALLOWED_URI_REGEXP = /^(?:https?:|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

const SANITIZE_CONFIG: Config = { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP };

@Injectable({ providedIn: 'root' })
export class MarkdownRenderer {
  private readonly marked = new Marked({ gfm: true, breaks: false });

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
    return DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
  }
}
