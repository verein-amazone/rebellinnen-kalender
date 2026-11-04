import { Injectable } from '@angular/core';
import DOMPurify, { type Config } from 'dompurify';

/**
 * The presentation of an imported event description. The description itself stays as it was
 * imported; this is derived from it each time it is shown.
 */
export type EventDescriptionContent =
  | { readonly format: 'plain-text'; readonly text: string }
  | { readonly format: 'html'; readonly html: string };

/**
 * Elements a calendar's description editor produces: Google Calendar's bold, italic, underline,
 * lists and links, plus the paragraphs and line breaks of Outlook and others. Everything else is
 * removed and its text kept (DOMPurify's default).
 */
const ALLOWED_TAGS = ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a'];

/** Only links may carry attributes, and only their `href`. */
const ALLOWED_ATTR = ['href'];

/**
 * Web, mail and phone links only. Unlike curated Markdown, a scheme-less link is rejected as well: an
 * imported relative path would resolve against the app's own origin.
 */
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:)/i;

const SANITIZE_CONFIG: Config = { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP };

/** Elements whose presence makes a description HTML rather than text with stray angle brackets. */
const FORMATTING_TAGS = new Set(ALLOWED_TAGS.map((tag) => tag.toUpperCase()));

/** Elements that start a new line on their own, so a newline next to them is not a second break. */
const BLOCK_TAGS = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI']);

/**
 * Turns an imported event description into something safe to show. RFC 5545 defines `DESCRIPTION`
 * as plain text, but Google Calendar writes HTML into it, with or without the vendor flag
 * `X-MOZ-GOOGLE-HTML-DESCRIPTION`, and device calendars may return the same HTML. So the format is
 * detected from the content: a description counts as HTML only when it contains one of the
 * formatting elements above. Text such as `Treffpunkt <Eingang Nord>` stays plain text.
 *
 * HTML is parsed by the browser and reduced by DOMPurify to the allow-list above - never by regular
 * expressions. The result is bound through `[innerHTML]`, so Angular's sanitizer runs as a second
 * layer.
 */
@Injectable({ providedIn: 'root' })
export class EventDescriptionRenderer {
  render(description: string): EventDescriptionContent {
    if (!looksLikeHtml(description)) {
      return { format: 'plain-text', text: description };
    }

    const fragment = DOMPurify.sanitize(description, {
      ...SANITIZE_CONFIG,
      RETURN_DOM_FRAGMENT: true,
    });
    removeEmptyBlocks(fragment);
    preserveLineBreaks(fragment);
    const container = document.createElement('div');
    container.append(fragment);
    return { format: 'html', html: container.innerHTML.trim() };
  }
}

/**
 * Google's editor leaves empty paragraphs around lists (`<br><p></p><ul>…</ul><p></p>`), which would
 * otherwise each add a paragraph gap. A blank line the author typed is a `<br>` and stays.
 */
function removeEmptyBlocks(root: DocumentFragment): void {
  for (const block of root.querySelectorAll('p, div')) {
    if (block.textContent?.trim() === '' && block.querySelector('br') === null) {
      block.remove();
    }
  }
}

function looksLikeHtml(description: string): boolean {
  if (!description.includes('<')) {
    return false;
  }
  const body = new DOMParser().parseFromString(description, 'text/html').body;
  return [...body.querySelectorAll('*')].some((element) => FORMATTING_TAGS.has(element.tagName));
}

/**
 * Keeps the text's own line breaks. Google appends plain-text blocks - the Meet details, for one -
 * to an HTML description, and their newlines would otherwise collapse into spaces. A newline right
 * next to an element that breaks the line anyway is dropped instead, so it does not add a blank line.
 */
function preserveLineBreaks(root: Node): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const node of textNodes) {
    let text = node.data;
    if (
      breaksLine(node.previousSibling) ||
      (!node.previousSibling && breaksLine(node.parentNode))
    ) {
      text = text.replace(/^[ \t]*\r?\n/, '');
    }
    if (breaksLine(node.nextSibling) || (!node.nextSibling && breaksLine(node.parentNode))) {
      text = text.replace(/\r?\n[ \t]*$/, '');
    }
    if (text.trim() === '' && (breaksLine(node.previousSibling) || breaksLine(node.nextSibling))) {
      node.remove();
      continue;
    }

    const lines = text.split(/\r?\n/);
    if (lines.length === 1) {
      node.data = text;
      continue;
    }
    node.replaceWith(
      ...lines.flatMap((line, index) =>
        index === 0 ? [line] : [document.createElement('br'), line],
      ),
    );
  }
}

function breaksLine(node: Node | null): boolean {
  return node instanceof Element && BLOCK_TAGS.has(node.tagName);
}
