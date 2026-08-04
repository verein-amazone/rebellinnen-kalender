import { DOCUMENT, inject, Injectable } from '@angular/core';

/**
 * Applies the appearance selection to the document root.
 *
 * The token layer in `src/styles/theme.css` reacts to `data-theme`, `data-text-size` and
 * `data-motion` on `<html>`. This is the only place that writes them.
 *
 * The value `system` means "no override": the attribute is removed so the device setting applies.
 * Values are passed as plain strings, so this stays independent of the preference types.
 */
@Injectable({ providedIn: 'root' })
export class DocumentAppearance {
  private readonly document = inject(DOCUMENT);

  apply(appearance: { theme: string; textSize: string; motion: string }): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', appearance.theme);
    this.set(root, 'data-text-size', appearance.textSize);
    this.set(root, 'data-motion', appearance.motion);
  }

  private set(root: HTMLElement, attribute: string, value: string): void {
    if (value === 'system') {
      root.removeAttribute(attribute);
      return;
    }
    root.setAttribute(attribute, value);
  }
}
