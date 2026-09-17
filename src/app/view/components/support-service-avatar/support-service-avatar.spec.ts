import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SupportServiceAvatar } from './support-service-avatar';

@Component({
  imports: [SupportServiceAvatar],
  template: `<app-support-service-avatar [icon]="icon()" [logoPath]="logoPath()" />`,
})
class Host {
  readonly icon = input.required<string>();
  readonly logoPath = input<string | null>(null);
}

async function setup(
  icon: string,
  logoPath: string | null = null,
): Promise<{ element: HTMLElement; fixture: ReturnType<typeof TestBed.createComponent<Host>> }> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('icon', icon);
  fixture.componentRef.setInput('logoPath', logoPath);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, fixture };
}

describe('SupportServiceAvatar', () => {
  it('is decorative: it is aria-hidden, since the service is always named in text nearby', async () => {
    const { element } = await setup('🧠');

    const visual = element.querySelector('[aria-hidden="true"]');
    expect(visual).not.toBeNull();
    expect(visual?.textContent?.trim()).toBe('🧠');
  });

  it('draws the emoji plain, with no frame or tint behind it', async () => {
    const { element } = await setup('🧠');

    expect(element.querySelector('img')).toBeNull();
    const visual = element.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(visual?.className).not.toContain('border');
    expect(visual?.getAttribute('style')).toBeNull();
  });

  it('shows the logo image when logoPath is set', async () => {
    const { element } = await setup('🧠', '/support-services/logos/rat-auf-draht.webp');

    const img = element.querySelector<HTMLImageElement>('img');
    expect(img?.getAttribute('src')).toBe('/support-services/logos/rat-auf-draht.webp');
  });

  it('falls back to the emoji when the logo image fails to load', async () => {
    const { element, fixture } = await setup('🧠', '/support-services/logos/rat-auf-draht.webp');

    const img = element.querySelector<HTMLImageElement>('img');
    img?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('🧠');
  });
});
