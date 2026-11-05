import { Injectable } from '@angular/core';
import DOMPurify, { type Config } from 'dompurify';
import { find as findLinks } from 'linkifyjs';

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
 * Turns an imported event description into safe HTML. The description itself stays as it was
 * imported; the HTML is derived from it each time it is shown.
 *
 * RFC 5545 defines `DESCRIPTION` as plain text, but Google Calendar writes HTML into it, with or
 * without the vendor flag `X-MOZ-GOOGLE-HTML-DESCRIPTION`, and device calendars may return the same
 * HTML. So the format is detected from the content: a description counts as HTML only when it
 * contains one of the formatting elements above. Text such as `Treffpunkt <Eingang Nord>` stays text
 * and becomes a text node, never markup.
 *
 * HTML is parsed by the browser and reduced by DOMPurify to the allow-list above - never by regular
 * expressions. Then, for both formats, line breaks are kept and web addresses and e-mail addresses in
 * the text become links (`linkifyjs` finds them; the links are built as DOM nodes). The finished HTML
 * passes DOMPurify once more, and is bound through `[innerHTML]`, so Angular's sanitizer runs as a
 * further layer.
 */
@Injectable({ providedIn: 'root' })
export class EventDescriptionRenderer {
  render(description: string): string {
    const fragment = looksLikeHtml(description)
      ? DOMPurify.sanitize(description, { ...SANITIZE_CONFIG, RETURN_DOM_FRAGMENT: true })
      : textFragment(description);
    removeEmptyBlocks(fragment);
    preserveLineBreaks(fragment);
    linkify(fragment);

    const container = document.createElement('div');
    container.append(fragment);
    return DOMPurify.sanitize(container.innerHTML, SANITIZE_CONFIG).trim();
  }
}

function textFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(text);
  return fragment;
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

/**
 * Web addresses with a scheme or `www.`, and e-mail addresses. A bare domain (`amazone.or.at`) is
 * left as text: in running text too many things look like one.
 */
function isLinkable(link: { readonly type: string; readonly value: string }): boolean {
  return (
    link.type === 'email' || (link.type === 'url' && /^(?:https?:\/\/|www\.)/i.test(link.value))
  );
}

/** Turns the addresses in every text node outside an existing link into links. */
function linkify(root: Node): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest('a')) {
      textNodes.push(node);
    }
  }

  for (const node of textNodes) {
    const links = findLinks(node.data).filter(isLinkable);
    if (links.length === 0) {
      continue;
    }
    const parts: (string | HTMLAnchorElement)[] = [];
    let index = 0;
    for (const link of links) {
      parts.push(node.data.slice(index, link.start));
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.value;
      parts.push(anchor);
      index = link.end;
    }
    parts.push(node.data.slice(index));
    node.replaceWith(...parts.filter((part) => part !== ''));
  }
}
