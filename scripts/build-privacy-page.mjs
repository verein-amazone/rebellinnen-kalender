#!/usr/bin/env node
// Renders the bundled privacy policy (`public/legal/datenschutz.md`, shown in the app under
// Einstellungen → Datenschutz) to a static, self-contained page at `datenschutz/index.html` in the
// build output. Both stores need a privacy policy at a public web address, and the GitHub Pages
// deployment of `dev` (.github/workflows/pages.yml) publishes it at
// https://verein-amazone.github.io/rebellinnen-kalender/datenschutz/ - the URL in
// `fastlane/metadata/de-DE/privacy_url.txt` and the consoles (#79). One Markdown file feeds the
// app and the stores, so the two can never say different things.
//
// The page loads no script, no font and no stylesheet from anywhere: a store reviewer or a reader
// on a slow connection gets the text, and nobody's IP address goes to a third party for it. Run as
// the `postbuild` and `postbuild:pages` hook, after the build has written the output directory.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Marked } from 'marked';

const ROOT = join(import.meta.dirname, '..');
const source = join(ROOT, 'public', 'legal', 'datenschutz.md');
const outputRoot = join(ROOT, 'dist', 'rebellinnen-kalender', 'browser');
const destination = join(outputRoot, 'datenschutz', 'index.html');

if (!existsSync(outputRoot)) {
  console.error(`build-privacy-page: ${outputRoot} does not exist - run the build first.`);
  process.exit(1);
}

// The Markdown is this repository's own file, not user input, so it is rendered as is.
const body = new Marked({ gfm: true, breaks: false }).parse(readFileSync(source, 'utf8'), {
  async: false,
});

const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Datenschutz – Rebell*innen Kalender</title>
    <style>
      :root {
        color-scheme: light dark;
        --background: #ffffff;
        --text: #1d1b3a;
        --link: #2c2a8a;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --background: #14132b;
          --text: #f1f0fa;
          --link: #b9b6ff;
        }
      }
      body {
        margin: 0;
        background: var(--background);
        color: var(--text);
        font: 1.0625rem/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      main {
        max-width: 42rem;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      h1 {
        font-size: 1.75rem;
        line-height: 1.25;
      }
      h2 {
        font-size: 1.25rem;
        margin-top: 2rem;
      }
      a {
        color: var(--link);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Datenschutz – Rebell*innen Kalender</h1>
${body}
    </main>
  </body>
</html>
`;

mkdirSync(join(outputRoot, 'datenschutz'), { recursive: true });
writeFileSync(destination, html);
console.log(`build-privacy-page: wrote ${destination}`);
