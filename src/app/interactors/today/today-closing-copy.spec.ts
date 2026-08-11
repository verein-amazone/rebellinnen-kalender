import { describe, expect, it } from 'vitest';

import { pickClosingCopy } from './today-closing-copy';

describe('pickClosingCopy', () => {
  it('returns the same variant for the same day and state on repeated calls', () => {
    const first = pickClosingCopy('nothing-planned.headline', '2026-08-11', 'nothing-planned');
    const second = pickClosingCopy('nothing-planned.headline', '2026-08-11', 'nothing-planned');

    expect(first).toBe(second);
  });

  it('varies the picked variant across different days for the same key and state', () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, offset) => {
        const day = `2026-08-${String(1 + offset).padStart(2, '0')}`;
        return pickClosingCopy('nothing-planned.headline', day, 'nothing-planned');
      }),
    );

    expect(picks.size).toBeGreaterThan(1);
  });

  it('throws for an unknown message key, since that is a programming error', () => {
    expect(() => pickClosingCopy('does-not-exist', '2026-08-11', 'nothing-planned')).toThrow();
  });
});
