import { describe, expect, it } from 'vitest';

import { estimateReadingTime } from './reading-time';

describe('estimateReadingTime', () => {
  it('rounds up to at least one minute for a short body', () => {
    expect(estimateReadingTime('A few short words.')).toBe('1 Min. Lesezeit');
  });

  it('rounds up a longer body to whole minutes', () => {
    const words = Array.from({ length: 401 }, () => 'wort').join(' ');
    expect(estimateReadingTime(words)).toBe('3 Min. Lesezeit');
  });

  it('treats an empty body as one minute', () => {
    expect(estimateReadingTime('')).toBe('1 Min. Lesezeit');
  });
});
