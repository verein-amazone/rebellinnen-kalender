import { afterEach, describe, expect, it } from 'vitest';

import { deploymentSlug, scopedStorageName } from './deployment-scope';

/** `document.baseURI` follows the `<base>` element, which is what `--base-href` writes. */
function deployAt(href: string): void {
  const base = document.createElement('base');
  base.setAttribute('href', href);
  document.head.appendChild(base);
}

afterEach(() => {
  document.head.querySelectorAll('base').forEach((base) => base.remove());
});

describe('deploymentSlug', () => {
  it('is empty at the server root, so nothing is namespaced on a device or in the e2e suite', () => {
    expect(deploymentSlug()).toBe('');
    expect(scopedStorageName('rebellinnen-kalender')).toBe('rebellinnen-kalender');
  });

  it('names the subdirectory the deployment is served from', () => {
    deployAt('/rebellinnen-kalender/');

    expect(deploymentSlug()).toBe('rebellinnen-kalender');
    expect(scopedStorageName('rk.appearance')).toBe('rk.appearance@rebellinnen-kalender');
  });

  it('separates a pull-request preview from the demo site it shares an origin with', () => {
    deployAt('/rebellinnen-kalender/pr-12/');

    expect(deploymentSlug()).toBe('rebellinnen-kalender-pr-12');
    expect(scopedStorageName('rebellinnen-kalender')).toBe(
      'rebellinnen-kalender@rebellinnen-kalender-pr-12',
    );
  });
});
