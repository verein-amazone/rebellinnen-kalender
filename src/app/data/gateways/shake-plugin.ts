import { InjectionToken } from '@angular/core';
import { Shake } from '@capawesome/capacitor-shake';

/**
 * The shake plugin behind a token, so the gateway spec can substitute a hand-written stub and the
 * plugin never has to exist under jsdom.
 */
export const SHAKE_PLUGIN = new InjectionToken<typeof Shake>('SHAKE_PLUGIN', {
  providedIn: 'root',
  factory: () => Shake,
});
