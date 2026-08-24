import { TestBed } from '@angular/core/testing';

import {
  IcsSubscriptionInteractor,
  IcsSubscriptionNameInvalidError,
  IcsUrlInvalidError,
  type IcsRefreshOutcome,
} from '@app/interactors/calendar/ics-subscription.interactor';
import { SheetRef } from '@app/view/components/sheet/sheet-ref';

import { IcsSubscriptionAddDialog } from './ics-subscription-add.dialog';

interface AddResult {
  readonly subscriptionId: string;
  readonly outcome: IcsRefreshOutcome;
}

class FakeIcsSubscriptionInteractor {
  addResult: AddResult | Error = { subscriptionId: 'sub-1', outcome: 'updated' };
  lastCall: { name: string; url: string } | null = null;

  add(name: string, url: string): Promise<AddResult> {
    this.lastCall = { name, url };
    if (this.addResult instanceof Error) {
      return Promise.reject(this.addResult);
    }
    return Promise.resolve(this.addResult);
  }
}

async function setup() {
  const results: (AddResult | undefined)[] = [];
  const sheetRef = { close: (result?: AddResult) => results.push(result) };
  const interactor = new FakeIcsSubscriptionInteractor();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetRef, useValue: sheetRef },
      { provide: IcsSubscriptionInteractor, useValue: interactor },
    ],
  });

  const fixture = TestBed.createComponent(IcsSubscriptionAddDialog);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    results,
    interactor,
    nameInput: element.querySelector<HTMLInputElement>('#ics-subscription-name')!,
    urlInput: element.querySelector<HTMLInputElement>('#ics-subscription-url')!,
    form: element.querySelector('form')!,
    buttonNamed(text: string): HTMLButtonElement {
      const button = Array.from(element.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(text),
      );
      if (button === undefined) {
        throw new Error(`No button contains "${text}"`);
      }
      return button;
    },
    async type(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    async submit() {
      this.form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    },
  };
}

describe('IcsSubscriptionAddDialog', () => {
  it('blocks submission and shows an error when the name is empty, without calling add()', async () => {
    const dialog = await setup();
    await dialog.type(dialog.urlInput, 'https://example.org/cal.ics');

    await dialog.submit();

    expect(dialog.interactor.lastCall).toBeNull();
    expect(dialog.results).toEqual([]);
    const error = dialog.element.querySelector('#ics-subscription-name-error');
    expect(error?.textContent?.trim()).not.toBe('');
    expect(dialog.nameInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks submission and shows an error when the link is empty, without calling add()', async () => {
    const dialog = await setup();
    await dialog.type(dialog.nameInput, 'Schule');

    await dialog.submit();

    expect(dialog.interactor.lastCall).toBeNull();
    expect(dialog.results).toEqual([]);
    const error = dialog.element.querySelector('#ics-subscription-url-error');
    expect(error?.textContent?.trim()).not.toBe('');
    expect(dialog.urlInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('adds the subscription and closes with the result on success', async () => {
    const dialog = await setup();
    dialog.interactor.addResult = { subscriptionId: 'sub-42', outcome: 'updated' };
    await dialog.type(dialog.nameInput, 'Schule');
    await dialog.type(dialog.urlInput, 'https://example.org/cal.ics');

    await dialog.submit();

    expect(dialog.interactor.lastCall).toEqual({
      name: 'Schule',
      url: 'https://example.org/cal.ics',
    });
    expect(dialog.results).toEqual([{ subscriptionId: 'sub-42', outcome: 'updated' }]);
  });

  it('closes with the result even when the first refresh failed, since the calendar was still added', async () => {
    const dialog = await setup();
    dialog.interactor.addResult = { subscriptionId: 'sub-42', outcome: 'failed' };
    await dialog.type(dialog.nameInput, 'Schule');
    await dialog.type(dialog.urlInput, 'https://example.org/cal.ics');

    await dialog.submit();

    expect(dialog.results).toEqual([{ subscriptionId: 'sub-42', outcome: 'failed' }]);
  });

  it('shows an invalid-link error under the link field and keeps the sheet open', async () => {
    const dialog = await setup();
    dialog.interactor.addResult = new IcsUrlInvalidError('Der Link muss mit https beginnen.');
    await dialog.type(dialog.nameInput, 'Schule');
    await dialog.type(dialog.urlInput, 'http://example.org/cal.ics');

    await dialog.submit();

    expect(dialog.results).toEqual([]);
    const error = dialog.element.querySelector('#ics-subscription-url-error');
    expect(error?.textContent?.trim()).toBe('Der Link muss mit https beginnen.');
  });

  it('shows an invalid-name error under the name field and keeps the sheet open', async () => {
    const dialog = await setup();
    dialog.interactor.addResult = new IcsSubscriptionNameInvalidError();
    await dialog.type(dialog.nameInput, 'Schule');
    await dialog.type(dialog.urlInput, 'https://example.org/cal.ics');

    await dialog.submit();

    expect(dialog.results).toEqual([]);
    const error = dialog.element.querySelector('#ics-subscription-name-error');
    expect(error?.textContent?.trim()).not.toBe('');
  });

  it('shows a generic alert message for an unexpected error', async () => {
    const dialog = await setup();
    dialog.interactor.addResult = new Error('boom');
    await dialog.type(dialog.nameInput, 'Schule');
    await dialog.type(dialog.urlInput, 'https://example.org/cal.ics');

    await dialog.submit();

    expect(dialog.results).toEqual([]);
    const alert = dialog.element.querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).not.toBe('');
  });

  it('closes without a result when cancelled', async () => {
    const dialog = await setup();

    dialog.buttonNamed('Abbrechen').click();

    expect(dialog.results).toEqual([undefined]);
  });
});
