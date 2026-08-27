import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Which platform the app is running on.
 *
 * This is the only place `@capacitor/core` is used for platform detection, so the rest of the app
 * never has to know how the platform is determined.
 *
 * These are plain functions rather than an injectable service because they are needed while the
 * application providers are being assembled, before an injector exists.
 */
export type DevicePlatform = 'ios' | 'android' | 'web';

export function devicePlatform(): DevicePlatform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

/**
 * iOS renders the router's view transitions badly: instead of animating, the screen briefly dims
 * or flickers, because WKWebView repaints the whole page while snapshotting it. Skipping only the
 * animation is not enough - the snapshot is what causes the artefact - so the feature is left out
 * entirely there and navigation simply cuts to the new screen.
 */
export function supportsViewTransitions(): boolean {
  return devicePlatform() !== 'ios';
}

/**
 * The injectable form of `devicePlatform()`, for components that branch on the platform and need a
 * fake in tests - a plain function call can't be substituted through `TestBed`, unlike a provider.
 * Bootstrap-time code still calls `devicePlatform()` directly; this exists for everything after.
 */
@Injectable({ providedIn: 'root' })
export class DevicePlatformService {
  readonly platform: DevicePlatform = devicePlatform();
}
