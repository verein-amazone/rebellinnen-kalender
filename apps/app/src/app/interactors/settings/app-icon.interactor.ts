import { inject, Injectable } from '@angular/core';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { DeviceAppIcon } from '@app/cross-cutting/infrastructure/app-icon';
import type { ChoiceOption } from '@app/interactors/choice-option';

export const APP_ICON_IDS = [
  'cool-cat-nacht',
  'cool-cat-lila',
  'cool-cat-hell',
  'sam-orange',
  'sam-tuerkis',
  'sam-hell',
] as const;
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
  'cool-cat-nacht': null,
  'cool-cat-lila': 'CoolCatLila',
  'cool-cat-hell': 'CoolCatHell',
  'sam-orange': 'SamOrange',
  'sam-tuerkis': 'SamTuerkis',
  'sam-hell': 'SamHell',
};

const DEFAULT_ICON: AppIconId = 'cool-cat-nacht';

/**
 * What the choice does, in Verein Amazone's words, plus what happens after the icon is picked where
 * that needs saying. iOS puts up its own confirmation, which explains itself; Android swaps the icon
 * lazily, which would otherwise look like the choice did not work.
 *
 * Android's wording also covers the `web` case, which never renders this - the screen offers no
 * choice at all where `available` is false.
 */
const CHANGE_NOTICES: Record<'ios' | 'other', string> = {
  ios:
    'Wähle das App-Symbol aus, das dir am besten gefällt. Es wird auf deinem Startbildschirm ' +
    'angezeigt.',
  other:
    'Wähle das App-Symbol aus, das dir am besten gefällt. Es wird auf deinem Startbildschirm ' +
    'angezeigt. Auf manchen Geräten wird es erst getauscht, nachdem du die App einmal ganz ' +
    'geschlossen hast.',
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
    option('cool-cat-nacht', 'Leo dunkel'),
    option('cool-cat-lila', 'Leo lila'),
    option('cool-cat-hell', 'Leo hell'),
    option('sam-orange', 'Sam orange'),
    option('sam-tuerkis', 'Sam türkis'),
    option('sam-hell', 'Sam hell'),
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

function option(id: AppIconId, label: string): AppIconOption {
  return { id, label, description: null, previewUrl: `app-icons/${id}.webp` };
}

/**
 * An unknown name is treated as the default: it can only come from an older or newer build whose
 * aliases differ, and offering no selected option at all would leave the radio group empty.
 */
function idOfNativeName(name: string | null): AppIconId {
  const match = APP_ICON_IDS.find((id) => NATIVE_NAMES[id] === name);
  return match ?? DEFAULT_ICON;
}
