import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';

describe('MarkdownContentComponent', () => {
  let fixture: ComponentFixture<MarkdownContentComponent>;

  function render(markdown: string): HTMLElement {
    fixture.componentRef.setInput('markdown', markdown);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(MarkdownContentComponent);
  });

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the supported Markdown subset as semantic HTML', () => {
    const el = render('## Heading\n\n- item');
    expect(el.querySelector('h2')?.textContent).toContain('Heading');
    expect(el.querySelector('li')?.textContent).toContain('item');
  });

  it('does not render script content (Angular sanitization is not bypassed)', () => {
    const el = render('safe text\n\n<script>window.__pwned = true;</script>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML.toLowerCase()).not.toContain('<script');
  });

  it('strips the href from unsafe links but keeps the text', () => {
    const el = render('[go](javascript:alert(1))');
    expect(el.querySelector('a')?.getAttribute('href')).toBeFalsy();
    expect(el.textContent).toContain('go');
  });
});
