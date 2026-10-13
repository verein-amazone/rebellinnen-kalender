import { resource } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { valueOr } from './resource-value';

describe('valueOr', () => {
  it('returns the value of a resolved resource', async () => {
    const loaded = TestBed.runInInjectionContext(() =>
      resource({ loader: () => Promise.resolve(['a']) }),
    );
    await vi.waitFor(() => expect(loaded.status()).toBe('resolved'));

    expect(valueOr(loaded, [])).toEqual(['a']);
  });

  it('returns the fallback where value() would throw, in the error state', async () => {
    const failed = TestBed.runInInjectionContext(() =>
      resource<string[], unknown>({ loader: () => Promise.reject(new Error('database closed')) }),
    );
    await vi.waitFor(() => expect(failed.status()).toBe('error'));

    expect(() => failed.value()).toThrow();
    expect(valueOr(failed, [])).toEqual([]);
  });

  it('returns the fallback while the resource is still loading', () => {
    const pending = TestBed.runInInjectionContext(() =>
      resource({ loader: () => new Promise<string[]>(() => undefined) }),
    );

    expect(valueOr(pending, null)).toBeNull();
  });
});
