import { InjectionToken } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';

/**
 * The native HTTP client. Part of `@capacitor/core` rather than its own package, but a plugin like
 * any other: no web implementation worth testing against, and unmockable as a bare import. See
 * ./README.md.
 */
export const CAPACITOR_HTTP = new InjectionToken<typeof CapacitorHttp>('CAPACITOR_HTTP', {
  providedIn: 'root',
  factory: () => CapacitorHttp,
});
