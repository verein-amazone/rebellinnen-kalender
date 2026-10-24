import { TestBed } from '@angular/core/testing';
import { MarkdownRenderer } from '@app/cross-cutting/markdown/markdown-renderer';

describe('MarkdownRenderer', () => {
  let renderer: MarkdownRenderer;

  beforeEach(() => {
    renderer = TestBed.inject(MarkdownRenderer);
  });

  describe('allowed Markdown', () => {
    it('renders paragraphs with emphasis and strong emphasis', () => {
      const html = renderer.render('This is *emphasis* and **strong**.');
      expect(html).toContain('<p>');
      expect(html).toContain('<em>emphasis</em>');
      expect(html).toContain('<strong>strong</strong>');
    });

    it('renders level-two and level-three headings semantically', () => {
      const html = renderer.render('## Section\n\n### Subsection');
      expect(html).toContain('<h2>Section</h2>');
      expect(html).toContain('<h3>Subsection</h3>');
    });

    it('renders unordered and ordered lists', () => {
      const unordered = renderer.render('- one\n- two');
      expect(unordered).toContain('<ul>');
      expect(unordered).toContain('<li>one</li>');

      const ordered = renderer.render('1. first\n2. second');
      expect(ordered).toContain('<ol>');
      expect(ordered).toContain('<li>first</li>');
    });

    it('renders block quotes', () => {
      const html = renderer.render('> quoted line');
      expect(html).toContain('<blockquote>');
      expect(html).toContain('quoted line');
    });

    it('renders a callout as a highlighted block rather than a quotation', () => {
      const html = renderer.render('> [!NOTE]\n> **Mitmachen!**\n> Melde dich an.\n\nWeiter.');
      expect(html).toContain('<div><p><strong>Mitmachen!</strong>\nMelde dich an.</p>\n</div>');
      expect(html).not.toContain('<blockquote>');
      expect(html).not.toContain('[!NOTE]');
      expect(html).toContain('<p>Weiter.</p>');
    });

    it('still renders a plain block quote after a callout', () => {
      const html = renderer.render('> [!NOTE]\n> Wichtig.\n\n> Zitat.');
      expect(html).toContain('<div><p>Wichtig.</p>\n</div>');
      expect(html).toContain('<blockquote>');
    });

    it('renders mailto links, subject and body included', () => {
      const html = renderer.render('[schreib uns](mailto:hallo@example.org?subject=Hallo%20du)');
      expect(html).toContain(
        '<a href="mailto:hallo@example.org?subject=Hallo%20du">schreib uns</a>',
      );
    });

    it('renders https and http links', () => {
      const https = renderer.render('[secure](https://example.org/path)');
      expect(https).toContain('<a href="https://example.org/path">secure</a>');

      const http = renderer.render('[plain](http://example.org)');
      expect(http).toContain('<a href="http://example.org">plain</a>');
    });
  });

  describe('unsupported headings', () => {
    it('does not emit level-one headings', () => {
      const html = renderer.render('# Title');
      expect(html).not.toContain('<h1');
      expect(html).toContain('Title');
    });

    it('does not emit headings below level three', () => {
      const html = renderer.render('#### Deep');
      expect(html).not.toContain('<h4');
      expect(html).toContain('Deep');
    });
  });

  describe('security', () => {
    it('removes raw HTML tags but keeps their text', () => {
      const html = renderer.render('A <b>bold</b> word');
      expect(html).not.toContain('<b>');
      expect(html).toContain('bold');
    });

    it('drops a raw div, so only a callout can produce one', () => {
      const html = renderer.render('<div>not a callout</div>\n\nA <div>inline</div> div');
      expect(html).not.toContain('<div>');
      expect(html).toContain('inline');
    });

    it('removes script tags entirely', () => {
      const html = renderer.render('before\n\n<script>alert(1)</script>\n\nafter');
      expect(html.toLowerCase()).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
    });

    it('rejects javascript: links and keeps only the link text', () => {
      const html = renderer.render('[click me](javascript:alert(1))');
      expect(html.toLowerCase()).not.toContain('javascript:');
      expect(html).not.toContain('href');
      expect(html).toContain('click me');
    });

    it('rejects other unsafe protocols such as data:', () => {
      const html = renderer.render('[x](data:text/html;base64,PHN2Zz4=)');
      expect(html).not.toContain('href');
      expect(html).toContain('x');
    });
  });

  describe('unsupported elements', () => {
    it('removes Markdown images', () => {
      const html = renderer.render('![alt text](https://example.org/pic.png)');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('pic.png');
    });

    it('removes fenced code blocks', () => {
      const html = renderer.render('```js\nconst x = 1;\n```');
      expect(html).not.toContain('<pre');
      expect(html).not.toContain('<code');
    });

    it('removes tables', () => {
      const html = renderer.render('| a | b |\n| - | - |\n| 1 | 2 |');
      expect(html).not.toContain('<table');
    });
  });

  describe('edge cases', () => {
    it('returns an empty string for empty input', () => {
      expect(renderer.render('')).toBe('');
    });

    it('does not throw on malformed input', () => {
      expect(() => renderer.render('**unterminated [broken](')).not.toThrow();
      expect(typeof renderer.render('**unterminated [broken](')).toBe('string');
    });
  });

  describe('toPlainText', () => {
    it('keeps the words and drops the syntax', () => {
      expect(
        renderer.toPlainText(
          '## Phasen\n\n**Menstruation**  \nDie *erste* Phase.\n\n- eins\n- zwei & drei',
        ),
      ).toBe('Phasen Menstruation Die erste Phase. eins zwei & drei');
    });

    it('keeps a link label and leaves out its target', () => {
      expect(renderer.toPlainText('Mehr bei [Amazone](https://www.amazone.or.at/).')).toBe(
        'Mehr bei Amazone .',
      );
    });

    it('returns an empty string for empty input', () => {
      expect(renderer.toPlainText('')).toBe('');
    });
  });
});
