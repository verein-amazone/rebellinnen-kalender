import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { SupportServiceView } from '@app/interactors/support-services/support-service.vm';

import { SupportServiceCardBlock } from './support-service-card.block';

function service(overrides: Partial<SupportServiceView> = {}): SupportServiceView {
  return {
    id: 'rat-auf-draht',
    region: 'online',
    name: 'Rat auf Draht',
    teaser: 'Beratung für Kinder und Jugendliche',
    crisis: false,
    icon: '🧠',
    color: '#E92F2A',
    logoPath: null,
    actions: [
      { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
      {
        type: 'chat',
        label: 'Chat',
        uri: 'https://www.rataufdraht.at/chatberatung',
        displayValue: null,
      },
    ],
    ...overrides,
  };
}

@Component({
  imports: [SupportServiceCardBlock],
  template: `<app-support-service-card [service]="service()" />`,
})
class Host {
  readonly service = input.required<SupportServiceView>();
}

async function setup(service: SupportServiceView): Promise<HTMLElement> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('service', service);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
}

describe('SupportServiceCardBlock', () => {
  it('shows the name and teaser', async () => {
    const element = await setup(service());

    expect(element.textContent).toContain('Rat auf Draht');
    expect(element.textContent).toContain('Beratung für Kinder und Jugendliche');
  });

  it('renders a phone action exactly as authored, including a short number unchanged', async () => {
    const element = await setup(
      service({
        actions: [{ type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' }],
      }),
    );

    const link = element.querySelector<HTMLAnchorElement>('a[href="tel:147"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBeNull();
    expect(link?.getAttribute('aria-label')).toBe('Rat auf Draht: Anrufen (147)');
    expect(link?.textContent).toContain('147');
  });

  it('renders a phone action with a full international number as authored', async () => {
    const element = await setup(
      service({
        actions: [
          {
            type: 'phone',
            label: 'Anrufen',
            uri: 'tel:+43800222555',
            displayValue: '0800 222 555',
          },
        ],
      }),
    );

    const link = element.querySelector<HTMLAnchorElement>('a[href="tel:+43800222555"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('0800 222 555');
  });

  it('renders an sms action with its own label, not a call action', async () => {
    const element = await setup(
      service({
        actions: [
          {
            type: 'sms',
            label: 'SMS senden',
            uri: 'sms:0800133133',
            displayValue: '0800 133 133',
          },
        ],
      }),
    );

    const link = element.querySelector<HTMLAnchorElement>('a[href="sms:0800133133"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('SMS senden');
    expect(link?.textContent).toContain('0800 133 133');
    expect(element.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('renders a website/chat action that opens externally and names the service', async () => {
    const element = await setup(
      service({
        actions: [
          { type: 'website', label: 'Webseite', uri: 'https://example.org', displayValue: null },
        ],
      }),
    );

    const link = element.querySelector<HTMLAnchorElement>('a[href="https://example.org"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('aria-label')).toBe('Rat auf Draht: Webseite');
  });

  it('renders no action row when there are no actions', async () => {
    const element = await setup(service({ actions: [] }));

    expect(element.querySelector('a')).toBeNull();
  });

  it('shows a crisis marker with an explicit text label when crisis is true', async () => {
    const element = await setup(service({ crisis: true }));

    expect(element.textContent).toMatch(/Krisenhotline/i);
  });

  it('shows no crisis marker when crisis is false', async () => {
    const element = await setup(service({ crisis: false }));

    expect(element.textContent).not.toMatch(/Krisenhotline/i);
  });

  it('renders the service avatar with its icon and colour', async () => {
    const element = await setup(service({ icon: '🧠', color: '#E92F2A' }));

    expect(element.querySelector('app-support-service-avatar')).not.toBeNull();
    expect(element.textContent).toContain('🧠');
  });
});
