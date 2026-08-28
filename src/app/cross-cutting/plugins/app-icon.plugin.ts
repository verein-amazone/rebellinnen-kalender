import { InjectionToken } from '@angular/core';
import { AppIcon } from '@capawesome/capacitor-app-icon';

/** The app-icon plugin. See ./README.md for why it is behind a token. */
export const APP_ICON_PLUGIN = new InjectionToken<typeof AppIcon>('APP_ICON_PLUGIN', {
  providedIn: 'root',
  factory: () => AppIcon,
});
