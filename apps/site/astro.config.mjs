// @ts-check
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

/**
 * The domain and the store addresses (site.config.json). `null` for a store means its listing is not
 * public yet, and the pages say „Bald verfügbar“ instead of linking it. `SITE_CONFIG` swaps in
 * another file: `pnpm test:site` builds a second copy with test store addresses to cover the store
 * buttons and the `/download` redirect, and `SITE_OUT` writes that copy somewhere else.
 * `releaseDate` (`YYYY-MM-DD`) adds „Ab … verfügbar“ under the store buttons; `null` leaves it out.
 *
 * @type {{ domain: string, appStoreUrl: string | null, playStoreUrl: string | null, releaseDate: string | null }}
 */
const config = JSON.parse(readFileSync(process.env['SITE_CONFIG'] ?? 'site.config.json', 'utf8'));

/**
 * GitHub Pages serves the site under the custom domain only while a CNAME file is in the published
 * branch, and the publish job replaces that branch with every run - so the build writes it.
 *
 * @returns {import('astro').AstroIntegration}
 */
function cname() {
  return {
    name: 'cname',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await writeFile(fileURLToPath(new URL('CNAME', dir)), `${config.domain}\n`);
      },
    },
  };
}

/**
 * The fonts are OFL-licensed, which asks for the licence to travel with them. The build emits the
 * font files themselves as hashed `_astro/` assets (fonts.css refers to them); this publishes their
 * licence texts and notice under /fonts/.
 *
 * @returns {import('astro').AstroIntegration}
 */
function fontLicences() {
  const files = ['NOTICE.md', 'Inter-OFL-1.1.txt', 'Fredoka-OFL-1.1.txt'];
  return {
    name: 'font-licences',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const target = new URL('fonts/', dir);
        await mkdir(target, { recursive: true });
        for (const file of files) {
          const source = fileURLToPath(import.meta.resolve(`@amazone/design-system/fonts/${file}`));
          await copyFile(source, fileURLToPath(new URL(file, target)));
        }
      },
    },
  };
}

export default defineConfig({
  site: `https://${config.domain}`,
  output: 'static',
  outDir: process.env['SITE_OUT'] ?? './dist',
  // Every page is a folder with an index.html (`/datenschutz/`), and links always end in a slash, so
  // GitHub Pages never answers with a redirect first.
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // The pages send a Content-Security-Policy that allows styles and scripts from this origin only
    // (src/layouts/BaseLayout.astro). An inlined stylesheet would be blocked by it.
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
  integrations: [cname(), fontLicences()],
  vite: {
    plugins: [tailwindcss()],
    // The store addresses, for the store buttons and the `data-*` attributes /download reads.
    define: {
      __STORES__: JSON.stringify({
        appStore: config.appStoreUrl,
        playStore: config.playStoreUrl,
      }),
      __RELEASE_DATE__: JSON.stringify(config.releaseDate ?? null),
    },
    build: {
      // Never as a `data:` URL: the policy allows images and fonts from this origin only.
      assetsInlineLimit: 0,
    },
  },
});
