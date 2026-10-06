import { afterEach, describe, expect, it } from 'vitest';

import { assetUrl } from './asset-url';

/** `document.baseURI` follows the `<base>` element, which is what `--base-href` writes. */
function deployAt(href: string): void {
  const base = document.createElement('base');
  base.setAttribute('href', href);
  document.head.appendChild(base);
}

afterEach(() => {
  document.head.querySelectorAll('base').forEach((base) => base.remove());
});

describe('assetUrl', () => {
  it('resolves against the document root when the app is served from it', () => {
    expect(assetUrl('/content/catalog.json')).toBe('/content/catalog.json');
    expect(assetUrl('content/catalog.json')).toBe('/content/catalog.json');
  });

  it('resolves into the subdirectory the app is deployed under', () => {
    deployAt('/rebellinnen-kalender/pr-12/');

    expect(assetUrl('/content/catalog.json')).toBe(
      '/rebellinnen-kalender/pr-12/content/catalog.json',
    );
    expect(assetUrl('assets')).toBe('/rebellinnen-kalender/pr-12/assets');
  });

  it('never returns an absolute URL, so an [src] binding survives sanitization', () => {
    deployAt('/rebellinnen-kalender/');

    expect(assetUrl('/content/rebellinnen/ada.webp')).toBe(
      '/rebellinnen-kalender/content/rebellinnen/ada.webp',
    );
  });
});
