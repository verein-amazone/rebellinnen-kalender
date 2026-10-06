import { describe, expect, it } from 'vitest';

import { greetingLine, greetingText, selectGreeting } from './today-greeting';

describe('selectGreeting', () => {
  it('picks morning before noon', () => {
    expect(selectGreeting(0)).toBe('morning');
    expect(selectGreeting(11)).toBe('morning');
  });

  it('picks day from noon until the evening boundary', () => {
    expect(selectGreeting(12)).toBe('day');
    expect(selectGreeting(17)).toBe('day');
  });

  it('picks evening from 18:00 onward', () => {
    expect(selectGreeting(18)).toBe('evening');
    expect(selectGreeting(23)).toBe('evening');
  });
});

describe('greetingText', () => {
  it('returns the German greeting for each id', () => {
    expect(greetingText('morning')).toBe('Guten Morgen');
    expect(greetingText('day')).toBe('Hallo');
    expect(greetingText('evening')).toBe('Guten Abend');
  });
});

describe('greetingLine', () => {
  it('appends the name without a comma and closes with an exclamation mark', () => {
    expect(greetingLine('day', 'Nina')).toBe('Hallo Nina!');
  });

  it('closes with an exclamation mark when there is no name', () => {
    expect(greetingLine('evening', null)).toBe('Guten Abend!');
    expect(greetingLine('morning', '')).toBe('Guten Morgen!');
  });
});
