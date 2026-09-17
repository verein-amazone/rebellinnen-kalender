import { describe, expect, it } from 'vitest';

import { safeInAppUrl } from './in-app-url';

describe('safeInAppUrl', () => {
  it('keeps a route of this app, query string included', () => {
    expect(safeInAppUrl('/today')).toBe('/today');
    expect(safeInAppUrl('/calendar?view=week&day=2026-09-18')).toBe(
      '/calendar?view=week&day=2026-09-18',
    );
  });

  it('rejects anything that could leave the app', () => {
    expect(safeInAppUrl('//example.com')).toBeNull();
    expect(safeInAppUrl('https://example.com')).toBeNull();
    expect(safeInAppUrl('/\\example.com')).toBeNull();
    expect(safeInAppUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects a relative path, whitespace and an absent value', () => {
    expect(safeInAppUrl('today')).toBeNull();
    expect(safeInAppUrl('/to day')).toBeNull();
    expect(safeInAppUrl('')).toBeNull();
    expect(safeInAppUrl(null)).toBeNull();
    expect(safeInAppUrl(undefined)).toBeNull();
  });
});
