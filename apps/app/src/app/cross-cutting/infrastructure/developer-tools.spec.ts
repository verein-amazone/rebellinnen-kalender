import { isPrereleaseVersion } from './developer-tools';

describe('isPrereleaseVersion', () => {
  it('recognises the prereleases semantic-release cuts from dev', () => {
    expect(isPrereleaseVersion('1.0.0-rc.22')).toBe(true);
    expect(isPrereleaseVersion('1.2.3-rc.1')).toBe(true);
  });

  it('treats a release from main as a store build', () => {
    expect(isPrereleaseVersion('1.0.0')).toBe(false);
    expect(isPrereleaseVersion('12.4.10')).toBe(false);
  });

  it('ignores build metadata, which is not a prerelease', () => {
    expect(isPrereleaseVersion('1.0.0+build.7')).toBe(false);
  });
});
