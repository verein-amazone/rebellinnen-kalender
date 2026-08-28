import { inject, Injectable } from '@angular/core';

import { APP_ICON_PLUGIN } from '@app/cross-cutting/plugins/app-icon.plugin';

/**
 * The device's launcher icon, wrapping `@capawesome/capacitor-app-icon` (see
 * `../plugins/app-icon.plugin.ts`).
 *
 * The icon names are the ones registered natively: the `activity-alias` names in
 * `android/app/src/main/AndroidManifest.xml` and the asset-catalog names in
 * `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`. Mapping the app's own icon ids onto them is the
 * interactor's job; this only strips the plugin's result wrappers.
 */
@Injectable({ providedIn: 'root' })
export class DeviceAppIcon {
  private readonly plugin = inject(APP_ICON_PLUGIN);

  /** False on devices that cannot change their launcher icon at all (older iOS devices). */
  async isAvailable(): Promise<boolean> {
    const { available } = await this.plugin.isAvailable();
    return available;
  }

  /** The active alternate icon's name, or `null` while the default icon is in use. */
  async getCurrentIcon(): Promise<string | null> {
    const { icon } = await this.plugin.getCurrentIcon();
    return icon;
  }

  async setIcon(name: string): Promise<void> {
    await this.plugin.setIcon({ icon: name });
  }

  async resetIcon(): Promise<void> {
    await this.plugin.resetIcon();
  }
}
