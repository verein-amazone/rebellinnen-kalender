import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { ContentItemKind } from '@app/interactors/daily-content/content-item.vm';

import { ContentKindFilterBlock, type ContentKindFilterOption } from './content-kind-filter.block';

const KINDS: readonly ContentKindFilterOption[] = [
  { id: 'wissensimpulse', label: 'Wissen & Impulse', count: 3 },
  { id: 'rebellin', label: 'Rebell*in', count: 1 },
];

@Component({
  imports: [ContentKindFilterBlock],
  template: `
    <app-content-kind-filter
      [kinds]="kinds()"
      [hiddenIds]="hiddenIds()"
      (toggled)="toggledIds.push($event)"
    />
  `,
})
class Host {
  readonly kinds = input.required<readonly ContentKindFilterOption[]>();
  readonly hiddenIds = input.required<ReadonlySet<ContentItemKind>>();
  readonly toggledIds: ContentItemKind[] = [];
}

async function setup(
  hiddenIds: ReadonlySet<ContentItemKind> = new Set(),
): Promise<{ element: HTMLElement; host: Host }> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('kinds', KINDS);
  fixture.componentRef.setInput('hiddenIds', hiddenIds);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

describe('ContentKindFilterBlock', () => {
  it('renders one toggle button per content type, with its count', async () => {
    const { element } = await setup();

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('Wissen & Impulse');
    expect(buttons[0].textContent).toContain('3');
    expect(buttons[1].textContent).toContain('Rebell*in');
  });

  it('shows every type as pressed when nothing is hidden', async () => {
    const { element } = await setup();

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'true']);
  });

  it('signals a switched-off type by aria-pressed, the missing check icon and the greyed chip', async () => {
    const { element } = await setup(new Set<ContentItemKind>(['rebellin']));

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].querySelector('svg')).not.toBeNull();
    expect(buttons[0].classList).not.toContain('opacity-55');

    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].querySelector('svg')).toBeNull();
    expect(buttons[1].classList).toContain('opacity-55');
  });

  it('emits the content type when its chip is clicked', async () => {
    const { element, host } = await setup();

    element.querySelector('button')?.click();

    expect(host.toggledIds).toEqual(['wissensimpulse']);
  });

  it('uses the group role, since the types toggle independently rather than excluding each other', async () => {
    const { element } = await setup();

    expect(element.querySelector('[role="group"]')).not.toBeNull();
    expect(element.querySelector('[role="radiogroup"]')).toBeNull();
  });
});
