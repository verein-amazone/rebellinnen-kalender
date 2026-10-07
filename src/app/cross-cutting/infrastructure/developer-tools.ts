import { InjectionToken, isDevMode } from '@angular/core';

import { APP_VERSION } from './app-version';

/**
 * Whether a version is a prerelease in the semver sense, such as `1.0.0-rc.22`. semantic-release
 * cuts those from `dev` (`.releaserc.json`), and only a release from `main` has no suffix.
 */
export function isPrereleaseVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+-/.test(version);
}

/**
 * Whether this build shows the developer tools: the „Entwicklung“ section in Settings, with the
 * full content catalog and the data reset (#119).
 *
 * A store build is cut from a release tag on `main`, so it carries a plain version and hides them.
 * Every prerelease from `dev` - TestFlight, Play internal testing, the web demo - and `ng serve`
 * keep them, because that is where they are used. A token rather than a constant, so a spec can
 * render either kind of build.
 */
export const DEVELOPER_TOOLS_ENABLED = new InjectionToken<boolean>('DEVELOPER_TOOLS_ENABLED', {
  providedIn: 'root',
  factory: () => isDevMode() || isPrereleaseVersion(APP_VERSION),
});
