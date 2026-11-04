import { TestBed } from '@angular/core/testing';
import { EventDescriptionRenderer } from '@app/cross-cutting/rich-text/event-description-renderer';

describe('EventDescriptionRenderer', () => {
  let renderer: EventDescriptionRenderer;

  beforeEach(() => {
    renderer = TestBed.inject(EventDescriptionRenderer);
  });

  function html(description: string): string {
    return renderer.render(description);
  }

  describe('plain text', () => {
    it('keeps its line breaks', () => {
      expect(html('Treffpunkt beim Eingang.\nBitte pünktlich sein.')).toBe(
        'Treffpunkt beim Eingang.<br>Bitte pünktlich sein.',
      );
    });

    it('shows literal angle brackets as text, never as markup', () => {
      expect(html('Treffpunkt <Eingang Nord>, Alter < 18 und > 12')).toBe(
        'Treffpunkt &lt;Eingang Nord&gt;, Alter &lt; 18 und &gt; 12',
      );
    });

    it('treats a description with only unsupported tags as text', () => {
      expect(html('Bitte <name> eintragen <script>x</script>')).toBe(
        'Bitte &lt;name&gt; eintragen &lt;script&gt;x&lt;/script&gt;',
      );
    });
  });

  describe('links in the text', () => {
    it('links web addresses with a scheme or www, and e-mail addresses', () => {
      expect(
        html('Infos: https://example.org/a?b=1, www.example.org oder an n.kaufmann@amazone.or.at'),
      ).toBe(
        'Infos: <a href="https://example.org/a?b=1">https://example.org/a?b=1</a>, <a href="http://www.example.org">www.example.org</a> oder an <a href="mailto:n.kaufmann@amazone.or.at">n.kaufmann@amazone.or.at</a>',
      );
    });

    it('leaves bare domains and abbreviations as text', () => {
      expect(html('Siehe amazone.or.at, z.B. morgen.')).toBe('Siehe amazone.or.at, z.B. morgen.');
    });

    it('links addresses in the text of an HTML description, but not inside an existing link', () => {
      expect(
        html(
          '<a href="https://www.notion.so/a">https://www.notion.so/a</a><br>Join: https://meet.google.com/abc-defg-hij',
        ),
      ).toBe(
        '<a href="https://www.notion.so/a">https://www.notion.so/a</a><br>Join: <a href="https://meet.google.com/abc-defg-hij">https://meet.google.com/abc-defg-hij</a>',
      );
    });
  });

  describe('Google Calendar formatting', () => {
    it('keeps bold, italic, underline and links', () => {
      const result = html(
        '<b>Fett</b> <i>kursiv</i> <u>unterstrichen</u> <a href="https://example.org/">Link</a>',
      );
      expect(result).toBe(
        '<b>Fett</b> <i>kursiv</i> <u>unterstrichen</u> <a href="https://example.org/">Link</a>',
      );
    });

    it('keeps numbered and bulleted lists', () => {
      const result = html('<ol><li>eins</li><li>zwei</li></ol><ul><li>Punkt</li></ul>');
      expect(result).toBe('<ol><li>eins</li><li>zwei</li></ol><ul><li>Punkt</li></ul>');
    });

    it('detects HTML with the vendor flag absent, and with Google’s wrapper element', () => {
      expect(html('<html-blob>Zeile<br>nächste</html-blob>')).toBe('Zeile<br>nächste');
    });

    it('turns the newlines of an appended plain-text block into line breaks', () => {
      const result = html(
        '<a href="https://www.notion.so/example">Notizen</a>\n\n-::~:~::~:~:-\nJoin with Google Meet: https://meet.google.com/abc-defg-hij\n-::~:~::~:~:-',
      );
      expect(result).toBe(
        '<a href="https://www.notion.so/example">Notizen</a><br><br>-::~:~::~:~:-<br>Join with Google Meet: <a href="https://meet.google.com/abc-defg-hij">https://meet.google.com/abc-defg-hij</a><br>-::~:~::~:~:-',
      );
    });

    it('does not add blank lines around elements that break the line anyway', () => {
      expect(html('<b>Titel</b><br>\nText\n<ul>\n<li>eins</li>\n</ul>\nEnde')).toBe(
        '<b>Titel</b><br>Text<ul><li>eins</li></ul>Ende',
      );
    });
  });

  describe('the public Amazone calendar (Google Calendar), as of November 2026', () => {
    it('renders the registration reminder with its bold line and list, without empty paragraphs', () => {
      expect(
        html(
          '<b>Heute noch schnell anmelden und den Rebell*innen Kalender 2027/28 mitgestalten! </b><br><br>Wie, wann, wo...?<br><p></p><ul><li>Drei Online-Workshops im März</li><li>Für alle ab 12 Jahren</li></ul><p></p>',
        ),
      ).toBe(
        '<b>Heute noch schnell anmelden und den Rebell*innen Kalender 2027/28 mitgestalten! </b><br><br>Wie, wann, wo...?<br><ul><li>Drei Online-Workshops im März</li><li>Für alle ab 12 Jahren</li></ul>',
      );
    });

    it('keeps the link to a PDF in an otherwise plain description', () => {
      expect(
        html(
          'Am 11. Oktober ist Weltmädchen*tag! <br>Orte findest du zum Beispiel hier: <a href="https://cms.amazone.or.at/media/pages/projekte/rebell-innen-kalender/landkarte.pdf">landkarte.pdf</a>',
        ),
      ).toBe(
        'Am 11. Oktober ist Weltmädchen*tag! <br>Orte findest du zum Beispiel hier: <a href="https://cms.amazone.or.at/media/pages/projekte/rebell-innen-kalender/landkarte.pdf">landkarte.pdf</a>',
      );
    });

    it('leaves a description without markup as its text', () => {
      const text =
        'IDAHOBIT steht für den 17. Mai als Internationalen Tag gegen Homo-, Bi-, Inter-, Trans- und Asexuellenfeindlichkeit.';
      expect(html(text)).toBe(text);
    });
  });

  describe('sanitizing', () => {
    it('removes scripts, event handlers and embedded content', () => {
      const result = html(
        '<b onclick="alert(1)">fett</b><script>alert(1)</script><iframe src="https://evil.example"></iframe><object data="x"></object><img src="x" onerror="alert(1)">',
      );
      expect(result).toBe('<b>fett</b>');
    });

    it('drops dangerous and app-relative link targets but keeps the text', () => {
      const result = html(
        '<a href="javascript:alert(1)">eins</a> <a href="data:text/html,x">zwei</a> <a href="/settings">drei</a>',
      );
      expect(result).toBe('<a>eins</a> <a>zwei</a> <a>drei</a>');
    });

    it('keeps mail and phone links', () => {
      expect(
        html('<a href="mailto:hallo@example.org">Mail</a> <a href="tel:+431234">Anrufen</a>'),
      ).toBe('<a href="mailto:hallo@example.org">Mail</a> <a href="tel:+431234">Anrufen</a>');
    });

    it('drops styles and classes, and unwraps unsupported elements', () => {
      expect(html('<span style="color:red" class="x"><b>Text</b></span>')).toBe('<b>Text</b>');
    });

    it('degrades malformed HTML gracefully', () => {
      expect(html('<b>offen <i>verschachtelt</b> Rest')).toBe(
        '<b>offen <i>verschachtelt</i></b><i> Rest</i>',
      );
    });
  });
});
