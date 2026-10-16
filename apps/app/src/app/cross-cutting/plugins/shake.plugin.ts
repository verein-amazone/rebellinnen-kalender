import { InjectionToken } from '@angular/core';
import { Shake } from '@capawesome/capacitor-shake';

/** The shake-gesture plugin. See ./README.md for why it is behind a token. */
export const SHAKE_PLUGIN = new InjectionToken<typeof Shake>('SHAKE_PLUGIN', {
  providedIn: 'root',
  factory: () => Shake,
});
