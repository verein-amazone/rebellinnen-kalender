import { stringHash } from './string-hash';

describe('stringHash', () => {
  it('is FNV-1a 32-bit', () => {
    // Reference values of the FNV-1a test suite.
    expect(stringHash('')).toBe(0x811c9dc5);
    expect(stringHash('a')).toBe(0xe40c292c);
    expect(stringHash('foobar')).toBe(0xbf9cf968);
  });

  it('continues a previous result, so input can be hashed piece by piece', () => {
    expect(stringHash('bar', stringHash('foo'))).toBe(stringHash('foobar'));
  });

  it('gives an independent hash for another seed', () => {
    expect(stringHash('foobar', 1)).not.toBe(stringHash('foobar'));
  });
});
