import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { classifySwipe, HorizontalSwipeDirective } from './horizontal-swipe.directive';

@Component({
  imports: [HorizontalSwipeDirective],
  template: `<div
    appHorizontalSwipe
    (swipeLeft)="directions().push('left')"
    (swipeRight)="directions().push('right')"
  >
    Raster
  </div>`,
})
class Host {
  readonly directions = signal<string[]>([]);
}

function pointerEvent(
  type: string,
  init: { x: number; y: number; pointerId?: number; isPrimary?: boolean },
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x,
    clientY: init.y,
    pointerId: init.pointerId ?? 1,
    isPrimary: init.isPrimary ?? true,
    button: 0,
  });
}

async function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();

  const element = (fixture.nativeElement as HTMLElement).querySelector('div')!;

  // Attached rather than bound in the template: this stands in for whatever the swiping element
  // contains (day buttons, in the calendar), which is what the click suppression protects.
  const clicks: string[] = [];
  element.addEventListener('click', () => clicks.push('click'));

  return {
    element,
    directions: () => fixture.componentInstance.directions(),
    clicks: () => clicks,
    async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
      element.dispatchEvent(pointerEvent('pointerdown', from));
      element.dispatchEvent(pointerEvent('pointerup', to));
      await fixture.whenStable();
    },
  };
}

describe('classifySwipe', () => {
  it('ignores a movement too short to be anything but a tap', () => {
    expect(classifySwipe(30, 0)).toBeNull();
  });

  it('ignores a movement that is mostly vertical - that is a scroll', () => {
    expect(classifySwipe(-60, 40)).toBeNull();
  });

  it('reads a long, flat movement as a swipe in its direction', () => {
    expect(classifySwipe(-120, 10)).toBe('left');
    expect(classifySwipe(120, -10)).toBe('right');
  });
});

describe('HorizontalSwipeDirective', () => {
  it('reports a swipe to the left and to the right', async () => {
    const page = await setup();

    await page.drag({ x: 200, y: 100 }, { x: 60, y: 108 });
    await page.drag({ x: 60, y: 100 }, { x: 200, y: 96 });

    expect(page.directions()).toEqual(['left', 'right']);
  });

  it('stays out of the way of a vertical scroll', async () => {
    const page = await setup();

    await page.drag({ x: 200, y: 100 }, { x: 190, y: 260 });

    expect(page.directions()).toEqual([]);
  });

  it('gives up when a second finger joins, so pinch-zoom is never hijacked', async () => {
    const page = await setup();

    page.element.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 100 }));
    page.element.dispatchEvent(
      pointerEvent('pointerdown', { x: 260, y: 140, pointerId: 2, isPrimary: false }),
    );
    page.element.dispatchEvent(pointerEvent('pointerup', { x: 60, y: 100 }));

    expect(page.directions()).toEqual([]);
  });

  it('gives up when the browser cancels the gesture, e.g. once scrolling takes over', async () => {
    const page = await setup();

    page.element.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 100 }));
    page.element.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    page.element.dispatchEvent(pointerEvent('pointerup', { x: 60, y: 100 }));

    expect(page.directions()).toEqual([]);
  });

  it('swallows the click a mouse drag produces, so the swipe does not also select a day', async () => {
    const page = await setup();

    await page.drag({ x: 200, y: 100 }, { x: 60, y: 100 });
    page.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(page.directions()).toEqual(['left']);
    expect(page.clicks()).toEqual([]);
  });

  it('leaves a plain tap alone', async () => {
    const page = await setup();

    await page.drag({ x: 200, y: 100 }, { x: 202, y: 101 });
    page.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(page.directions()).toEqual([]);
    expect(page.clicks()).toEqual(['click']);
  });
});
