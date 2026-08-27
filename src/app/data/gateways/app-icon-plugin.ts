import { InjectionToken } from '@angular/core';
import { AppIcon } from '@capawesome/capacitor-app-icon';

/**
 * The app-icon plugin behind a token, so the gateway spec can substitute a hand-written stub and
 * the plugin never has to exist under jsdom.
 */
export const APP_ICON_PLUGIN = new InjectionToken<typeof AppIcon>('APP_ICON_PLUGIN', {
  providedIn: 'root',
  factory: () => AppIcon,
});
