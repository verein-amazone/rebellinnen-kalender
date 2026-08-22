import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SupportServiceAvatar } from './support-service-avatar';

@Component({
  imports: [SupportServiceAvatar],
  template: `<app-support-service-avatar
    [icon]="icon()"
    [color]="color()"
    [logoPath]="logoPath()"
  />`,
})
class Host {
  readonly icon = input.required<string>();
  readonly color = input.required<string>();
  readonly logoPath = input<string | null>(null);
}

async function setup(
  icon: string,
  color: string,
  logoPath: string | null = null,
): Promise<{ element: HTMLElement; fixture: ReturnType<typeof TestBed.createComponent<Host>> }> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('icon', icon);
  fixture.componentRef.setInput('color', color);
  fixture.componentRef.setInput('logoPath', logoPath);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, fixture };
}

describe('SupportServiceAvatar', () => {
  it('is decorative: the badge is aria-hidden, since the service is always named in text nearby', async () => {
    const { element } = await setup('🧠', '#E92F2A');

    const badge = element.querySelector('[aria-hidden="true"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('🧠');
  });

  it('shows the icon on a tinted badge using the given colour when there is no logoPath', async () => {
    const { element } = await setup('🧠', '#E92F2A');

    expect(element.querySelector('img')).toBeNull();
    const badge = element.querySelector<HTMLElement>('.rk-service-badge');
    expect(badge?.style.getPropertyValue('--badge-color')).toBe('#E92F2A');
  });

  it('shows the logo image when logoPath is set', async () => {
    const { element } = await setup('🧠', '#E92F2A', '/support-services/logos/rat-auf-draht.webp');

    const img = element.querySelector<HTMLImageElement>('img');
    expect(img?.getAttribute('src')).toBe('/support-services/logos/rat-auf-draht.webp');
    expect(element.querySelector('.rk-service-badge')).toBeNull();
  });

  it('falls back to the icon badge when the logo image fails to load', async () => {
    const { element, fixture } = await setup(
      '🧠',
      '#E92F2A',
      '/support-services/logos/rat-auf-draht.webp',
    );

    const img = element.querySelector<HTMLImageElement>('img');
    img?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.rk-service-badge')).not.toBeNull();
  });
});
