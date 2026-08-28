import packageJson from '../../../../package.json' with { type: 'json' };

import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
  it('matches package.json, which semantic-release is the only thing to bump', () => {
    // Regenerate with `node scripts/generate-app-version.mjs` (the `prebuild`/`prestart` hook) if
    // this fails - the generated constant has gone stale.
    expect(APP_VERSION).toBe(packageJson.version);
  });
});
