import { IcsUrlInvalidError, normalizeIcsUrl, redactIcsUrl } from './ics-url';

describe('normalizeIcsUrl', () => {
  it('accepts https and rewrites webcal to https', () => {
    expect(normalizeIcsUrl('https://example.org/cal.ics', { allowInsecure: false })).toBe(
      'https://example.org/cal.ics',
    );
    expect(normalizeIcsUrl('webcal://example.org/cal.ics', { allowInsecure: false })).toBe(
      'https://example.org/cal.ics',
    );
  });

  it('rejects http without the explicit opt-in and allows it with one', () => {
    expect(() => normalizeIcsUrl('http://example.org/cal.ics', { allowInsecure: false })).toThrow(
      IcsUrlInvalidError,
    );
    expect(normalizeIcsUrl('http://example.org/cal.ics', { allowInsecure: true })).toBe(
      'http://example.org/cal.ics',
    );
  });

  it('rejects non-web schemes and garbage', () => {
    expect(() => normalizeIcsUrl('file:///etc/passwd', { allowInsecure: true })).toThrow(
      IcsUrlInvalidError,
    );
    expect(() => normalizeIcsUrl('kein link', { allowInsecure: true })).toThrow(IcsUrlInvalidError);
  });
});

describe('redactIcsUrl', () => {
  it('keeps the origin and only the tail of the path, hiding embedded tokens', () => {
    const redacted = redactIcsUrl('https://example.org/private/secret-token-abcdef/cal.ics');

    expect(redacted).toContain('https://example.org');
    expect(redacted).not.toContain('secret-token-abcdef');
    expect(redacted).toBe('https://example.org/….ics');
  });
});
