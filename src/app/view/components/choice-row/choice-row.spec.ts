import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ChoiceRow } from './choice-row';

/**
 * A group of two options, the way a settings page uses them. Grouping is the browser's job - these
 * tests check that the markup lets it do that, not that we reimplemented it.
 */
@Component({
  imports: [ChoiceRow],
  template: `
    <fieldset>
      <legend>Farbthema wählen</legend>
      @for (option of options; track option.id) {
        <app-choice-row
          name="theme"
          [value]="option.id"
          [label]="option.label"
          [description]="option.description"
          [checked]="selected() === option.id"
          (selected)="onSelected($event)"
        />
      }
    </fieldset>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly options = [
    { id: 'amazone', label: 'Amazone', description: null },
    { id: 'nacht', label: 'Mitternacht', description: 'Dunkles Farbthema' },
  ];
  readonly selected = signal('amazone');
  readonly emitted: string[] = [];

  onSelected(value: string): void {
    this.emitted.push(value);
    this.selected.set(value);
  }
}

describe('ChoiceRow', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    return { fixture, element, inputs };
  }

  it('renders one native radio per option, all sharing a group name', async () => {
    const { inputs } = await setup();

    expect(inputs).toHaveLength(2);
    expect(inputs.every((input) => input.name === 'theme')).toBe(true);
  });

  it('names each option by its label, and folds the description into that name', async () => {
    const { element } = await setup();
    const labels = Array.from(element.querySelectorAll('label'));

    expect(labels[0].textContent?.trim()).toBe('Amazone');
    expect(labels[1].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Mitternacht Dunkles Farbthema',
    );
  });

  it('associates the control with its label implicitly, so the whole row is the target', async () => {
    const { element, inputs } = await setup();
    const labels = Array.from(element.querySelectorAll('label'));

    expect(labels[0].contains(inputs[0])).toBe(true);
    // An implicit association needs no `for`/`id` pair, and generating ids is what we avoid here.
    expect(labels[0].getAttribute('for')).toBeNull();
  });

  it('reflects `checked` onto the native control', async () => {
    const { inputs } = await setup();

    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(false);
  });

  it('emits the option value when the user picks it, and only one stays checked', async () => {
    const { fixture, inputs } = await setup();

    inputs[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.emitted).toEqual(['nacht']);
    expect(inputs[0].checked).toBe(false);
    expect(inputs[1].checked).toBe(true);
  });
});
