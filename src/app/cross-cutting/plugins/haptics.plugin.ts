import { InjectionToken } from '@angular/core';
import { Haptics } from '@capawesome/capacitor-haptics';

/** The haptics plugin. See ./README.md for why it is behind a token. */
export const HAPTICS_PLUGIN = new InjectionToken<typeof Haptics>('HAPTICS_PLUGIN', {
  providedIn: 'root',
  factory: () => Haptics,
});
