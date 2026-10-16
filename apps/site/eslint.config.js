// @ts-check
import eslint from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // Build output and Astro's generated types are not ours to lint; public/ is copied as is.
  {
    ignores: ['dist/', 'dist-stores/', '.astro/', 'public/', 'playwright-report/', 'test-results/'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  // The website's counterpart to angular-eslint's template accessibility rules in the app.
  astro.configs['jsx-a11y-recommended'],
  // The config files run in Node. (public/download/download.js runs in the browser, but is ignored.)
  { files: ['*.{js,mjs,ts}'], languageOptions: { globals: globals.node } },
]);
