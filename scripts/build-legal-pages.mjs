#!/usr/bin/env node
// Renders the bundled legal texts - the privacy policy (`public/legal/datenschutz.md`), the terms of
// use (`public/legal/nutzungsbedingungen.md`) and the imprint (`public/legal/impressum.md`), shown in
// the app under Einstellungen → App & Rechtliches - to static, self-contained pages in the build
// output. Both stores need a privacy policy at a public web address, and the GitHub Pages
// deployment of `dev` (.github/workflows/pages.yml) publishes them at
// https://kalender.amazone.or.at/datenschutz/ - the URL in `fastlane/metadata/de-DE/privacy_url.txt`
// and the consoles - /nutzungsbedingungen/ (#79) and /impressum/. Each page links the other two, so
// a store reviewer finds the imprint. One Markdown file per text feeds the app and the web, so the
// two can never say different things.
//
// The pages load no script, no font and no stylesheet from anywhere: a store reviewer or a reader
// on a slow connection gets the text, and nobody's IP address goes to a third party for it. Run as
// the `postbuild` and `postbuild:pages` hook, after the build has written the output directory.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Marked } from 'marked';

const ROOT = join(import.meta.dirname, '..');
const outputRoot = join(ROOT, 'dist', 'rebellinnen-kalender', 'browser');

/** Each text's Markdown file in `public/legal/`, its page title and its directory in the output. */
const PAGES = [
  { file: 'datenschutz.md', title: 'Datenschutz', directory: 'datenschutz' },
  {
    file: 'nutzungsbedingungen.md',
    title: 'Nutzungsbedingungen',
    directory: 'nutzungsbedingungen',
  },
  { file: 'impressum.md', title: 'Impressum', directory: 'impressum' },
];

if (!existsSync(outputRoot)) {
  console.error(`build-legal-pages: ${outputRoot} does not exist - run the build first.`);
  process.exit(1);
}

const marked = new Marked({ gfm: true, breaks: false });

for (const { file, title, directory } of PAGES) {
  // The Markdown is this repository's own file, not user input, so it is rendered as is.
  const body = marked.parse(readFileSync(join(ROOT, 'public', 'legal', file), 'utf8'), {
    async: false,
  });
  const destination = join(outputRoot, directory, 'index.html');

  mkdirSync(join(outputRoot, directory), { recursive: true });
  writeFileSync(destination, page(title, body, directory));
  console.log(`build-legal-pages: wrote ${destination}`);
}

function page(title, body, directory) {
  // Sibling pages, relative so a pull-request preview links its own copies.
  const links = PAGES.map((other) =>
    other.directory === directory
      ? `<a href="../${other.directory}/" aria-current="page">${other.title}</a>`
      : `<a href="../${other.directory}/">${other.title}</a>`,
  ).join(' · ');

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} – Rebell*innen Kalender</title>
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
      footer {
        margin-top: 3rem;
        padding-top: 1rem;
        border-top: 1px solid currentColor;
      }
      a[aria-current='page'] {
        color: inherit;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title} – Rebell*innen Kalender</h1>
${body}
      <footer>
        <nav aria-label="Rechtliches">${links}</nav>
      </footer>
    </main>
  </body>
</html>
`;
}
