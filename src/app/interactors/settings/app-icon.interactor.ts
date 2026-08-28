import { inject, Injectable } from '@angular/core';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { DeviceAppIcon } from '@app/cross-cutting/infrastructure/app-icon';
import type { ChoiceOption } from '@app/interactors/choice-option';

export const APP_ICON_IDS = ['klassisch', 'pixel', 'nacht'] as const;
export type AppIconId = (typeof APP_ICON_IDS)[number];

/** A selectable app icon. The preview is the same artwork the launcher icon is generated from. */
export interface AppIconOption extends ChoiceOption<AppIconId> {
  readonly previewUrl: string;
}

export interface AppIconSnapshot {
  readonly available: boolean;
  readonly selected: AppIconId;
}

/**
 * The name each icon is registered under natively: the `activity-alias` name in
 * `AndroidManifest.xml` and the asset-catalog name in `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`.
 * The default icon has no name - it is the one `resetIcon()` returns to and the one
 * `getCurrentIcon()` reports as `null`.
 */
const NATIVE_NAMES: Record<AppIconId, string | null> = {
  klassisch: null,
  pixel: 'Pixel',
  nacht: 'Nacht',
};

const DEFAULT_ICON: AppIconId = 'klassisch';

/**
 * What happens after the icon is picked, which is different on each platform and is only ever true
 * of one of them: iOS puts up its own confirmation, Android swaps the icon lazily. Saying both at
 * once left every reader working out which half applied to them.
 *
 * Android's wording also covers the `web` case, which never renders this - the screen offers no
 * choice at all where `available` is false.
 */
const CHANGE_NOTICES: Record<'ios' | 'other', string> = {
  ios:
    'Das neue Symbol erscheint auf dem Startbildschirm. Du bestätigst die Änderung noch einmal ' +
    'in einem Hinweis des Systems.',
  other:
    'Das neue Symbol erscheint auf dem Startbildschirm. Auf manchen Geräten wird es erst ' +
    'getauscht, nachdem du die App einmal ganz geschlossen hast.',
};

/**
 * Reading and changing the app icon shown on the home screen (#9).
 *
 * There is no store behind this: the operating system owns which launcher icon is active, and it
 * can end up back on the default without the app noticing (a reinstall, or a user resetting the
 * app's data), so the selection is always read back through the plugin rather than mirrored into
 * `localStorage`.
 *
 * The interactor owns the option list including the German labels, so every screen offering the
 * choice says the same thing. Adding an icon means adding an entry here plus the generated assets
 * and native registration described in `scripts/generate-app-icons.mjs`.
 */
@Injectable({ providedIn: 'root' })
export class AppIconInteractor {
  private readonly gateway = inject(DeviceAppIcon);
  private readonly platform = inject(DevicePlatformService);

  readonly options: readonly AppIconOption[] = [
    {
      id: 'klassisch',
      label: 'Klassisch',
      description: null,
      previewUrl: 'app-icons/klassisch.webp',
    },
    { id: 'pixel', label: 'Pixel', description: null, previewUrl: 'app-icons/pixel.webp' },
    { id: 'nacht', label: 'Nacht', description: null, previewUrl: 'app-icons/nacht.webp' },
  ];

  /** What to expect after picking an icon here, in this device's terms - see `CHANGE_NOTICES`. */
  readonly changeNotice =
    this.platform.platform === 'ios' ? CHANGE_NOTICES.ios : CHANGE_NOTICES.other;

  /**
   * `available` is false in a browser tab and on iOS devices that do not support alternate icons;
   * in both cases the screen offers no choice at all.
   */
  async loadSnapshot(): Promise<AppIconSnapshot> {
    if (this.platform.platform === 'web') {
      return { available: false, selected: DEFAULT_ICON };
    }

    const available = await this.gateway.isAvailable();
    if (!available) {
      return { available: false, selected: DEFAULT_ICON };
    }

    const current = await this.gateway.getCurrentIcon();
    return { available: true, selected: idOfNativeName(current) };
  }

  async select(id: AppIconId): Promise<void> {
    const name = NATIVE_NAMES[id];
    if (name === null) {
      await this.gateway.resetIcon();
      return;
    }

    await this.gateway.setIcon(name);
  }

  /** The label of the given icon, for announcing the change. */
  labelOf(id: AppIconId): string {
    return this.options.find((option) => option.id === id)?.label ?? id;
  }
}

/**
 * An unknown name is treated as the default: it can only come from an older or newer build whose
 * aliases differ, and offering no selected option at all would leave the radio group empty.
 */
function idOfNativeName(name: string | null): AppIconId {
  const match = APP_ICON_IDS.find((id) => NATIVE_NAMES[id] === name);
  return match ?? DEFAULT_ICON;
}
