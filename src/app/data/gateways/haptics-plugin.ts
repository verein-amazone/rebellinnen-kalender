import { InjectionToken } from '@angular/core';
import { Haptics } from '@capawesome/capacitor-haptics';

/**
 * The haptics plugin behind a token, so the gateway spec can substitute a hand-written stub and the
 * plugin never has to exist under jsdom.
 */
export const HAPTICS_PLUGIN = new InjectionToken<typeof Haptics>('HAPTICS_PLUGIN', {
  providedIn: 'root',
  factory: () => Haptics,
});
