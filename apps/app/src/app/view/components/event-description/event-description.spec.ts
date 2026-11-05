import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventDescriptionComponent } from '@app/view/components/event-description/event-description';

describe('EventDescriptionComponent', () => {
  let fixture: ComponentFixture<EventDescriptionComponent>;

  function render(description: string): HTMLElement {
    fixture.componentRef.setInput('description', description);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(EventDescriptionComponent);
  });

  it('shows plain text as text, with its line breaks and its addresses as links', () => {
    const container = render('Treffpunkt <Eingang Nord>\nhttps://example.org').querySelector(
      '.rk-event-description',
    );
    expect(container?.querySelector('br')).not.toBeNull();
    expect(container?.textContent).toBe('Treffpunkt <Eingang Nord>https://example.org');
    expect(container?.querySelector('a')?.getAttribute('href')).toBe('https://example.org');
  });

  it('shows a formatted description with its formatting', () => {
    const el = render('<b>Fett</b><ul><li>Punkt</li></ul><a href="https://example.org/">Link</a>');
    const container = el.querySelector('.rk-event-description');
    expect(container?.querySelector('b')?.textContent).toBe('Fett');
    expect(container?.querySelector('ul li')?.textContent).toBe('Punkt');
    expect(container?.querySelector('a')?.getAttribute('href')).toBe('https://example.org/');
  });

  it('never renders active content', () => {
    const el = render('<b>ok</b><script>window.__pwned = true;</script><img src=x onerror="1">');
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.innerHTML.toLowerCase()).not.toContain('onerror');
  });
});
