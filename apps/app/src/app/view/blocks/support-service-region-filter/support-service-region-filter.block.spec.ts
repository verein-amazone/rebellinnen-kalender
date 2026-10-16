import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { SupportServiceRegion } from '@app/interactors/support-services/support-service.vm';

import { SupportServiceRegionFilterBlock } from './support-service-region-filter.block';

function region(overrides: Partial<SupportServiceRegion> = {}): SupportServiceRegion {
  return { id: 'online', label: 'Online & Telefon', ...overrides };
}

@Component({
  imports: [SupportServiceRegionFilterBlock],
  template: `
    <app-support-service-region-filter
      [regions]="regions()"
      [selectedRegionId]="selectedRegionId()"
      (regionSelected)="selectedIds.push($event)"
    />
  `,
})
class Host {
  readonly regions = input.required<readonly SupportServiceRegion[]>();
  readonly selectedRegionId = input.required<string>();
  readonly selectedIds: string[] = [];
}

async function setup(
  regions: readonly SupportServiceRegion[],
  selectedRegionId: string,
): Promise<{ element: HTMLElement; host: Host }> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('regions', regions);
  fixture.componentRef.setInput('selectedRegionId', selectedRegionId);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

describe('SupportServiceRegionFilterBlock', () => {
  it('renders one radio button per region, naming it', async () => {
    const { element } = await setup(
      [
        region({ id: 'online', label: 'Online & Telefon' }),
        region({ id: 'vorarlberg', label: 'Vorarlberg' }),
      ],
      'online',
    );

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('Online & Telefon');
    expect(buttons[1].textContent).toContain('Vorarlberg');
  });

  it('marks the selected region as checked and the rest as not checked', async () => {
    const { element } = await setup(
      [region({ id: 'online' }), region({ id: 'vorarlberg', label: 'Vorarlberg' })],
      'vorarlberg',
    );

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
  });

  it('exposes a radiogroup role', async () => {
    const { element } = await setup([region()], 'online');

    expect(element.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(element.querySelector('button[role="radio"]')).not.toBeNull();
  });

  it('emits the region id when a chip is clicked', async () => {
    const { element, host } = await setup(
      [region({ id: 'online' }), region({ id: 'vorarlberg', label: 'Vorarlberg' })],
      'online',
    );

    const buttons = Array.from(element.querySelectorAll('button'));
    buttons[1].click();

    expect(host.selectedIds).toEqual(['vorarlberg']);
  });
});
