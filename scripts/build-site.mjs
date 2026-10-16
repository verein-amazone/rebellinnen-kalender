#!/usr/bin/env node
// Builds the public website at https://kalender.amazone.or.at into `dist/site/`: a one-page
// introduction with the store links, `/download` (the target of the printed QR codes, which sends
// a phone straight to its store), the privacy policy, the terms of use and the imprint, and a 404
// page. `.github/workflows/pages.yml` publishes the folder; `pnpm build:site` runs this script.
//
// Nothing on the site is written twice. The legal pages are rendered from the Markdown the app
// bundles (`public/legal/*.md`), and the copy comes from the store listing Verein Amazone approved
// (`fastlane/metadata/de-DE/`), so the app, the stores and the website cannot say different
// things. The store addresses live in `site/site.config.json`; `null` means the listing is not
// public yet, and the site then says „Bald verfügbar“ instead of linking to it.
//
// The pages load nothing from anywhere else - no font, script, image or stylesheet from a third
// party - and set no cookies. The only script is `/download/download.js`.
//
// SITE_CONFIG and SITE_OUT override the config file and the output folder; the website's own
// Playwright suite builds a second copy with test store addresses that way.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { Marked } from 'marked';

const ROOT = join(import.meta.dirname, '..');
const SITE = join(ROOT, 'site');
const OUT = resolve(ROOT, process.env.SITE_OUT ?? join('dist', 'site'));
const METADATA = join(ROOT, 'fastlane', 'metadata', 'de-DE');

const config = JSON.parse(
  readFileSync(resolve(ROOT, process.env.SITE_CONFIG ?? join(SITE, 'site.config.json')), 'utf8'),
);
const ORIGIN = `https://${config.domain}`;

const APP_NAME = readText(join(METADATA, 'name.txt'));
const SUBTITLE = readText(join(METADATA, 'subtitle.txt'));
const PROMOTIONAL = readText(join(METADATA, 'promotional_text.txt'));
const DESCRIPTION = parseDescription(readText(join(METADATA, 'description.txt')));

/** The legal texts, in the order the footer lists them. */
const LEGAL_PAGES = [
  { file: 'datenschutz.md', title: 'Datenschutz', directory: 'datenschutz' },
  {
    file: 'nutzungsbedingungen.md',
    title: 'Nutzungsbedingungen',
    directory: 'nutzungsbedingungen',
  },
  { file: 'impressum.md', title: 'Impressum', directory: 'impressum' },
];

/** The description's sections the landing page shows next to a screen, in page order. */
const FEATURES = [
  {
    section: 'DEIN KALENDER',
    title: 'Dein Kalender',
    screen: 'kalender',
    alt: 'Die Wochenansicht der App: der Internationale Frauentag aus den Rebell*innen Terminen, darunter eigene Termine aus „Mein Kalender“.',
  },
  {
    section: 'REBELL*INNEN UND WISSEN',
    title: 'Rebell*innen und Wissen',
    screen: 'rebellin',
    alt: 'Das Porträt von Ada Lovelace in der App, mit einem Zitat und ihrer Geschichte.',
  },
  {
    section: 'ANLAUFSTELLEN',
    title: 'Anlaufstellen',
    screen: 'anlaufstellen',
    alt: 'Die Anlaufstellen in der App: Rat auf Draht, Telefonseelsorge und Kindernotruf, jeweils mit Knopf zum Anrufen oder Chatten.',
  },
];

/** Sections shown as text only, below the screens. */
const EXTRAS = [
  { section: 'NICHT VERGESSEN', title: 'Nicht vergessen' },
  {
    section: 'MACH DIR DIE APP, WIE SIE DIR GEFÄLLT',
    title: 'Mach dir die App, wie sie dir gefällt',
  },
];

const marked = new Marked({ gfm: true, breaks: false });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

copy(join(SITE, 'site.css'), 'site.css');
copy(join(SITE, 'download.js'), 'download/download.js');
copy(join(SITE, 'assets'), 'assets');
copy(join(ROOT, 'src', 'styles', 'fonts'), 'fonts');
// The fonts are OFL-licensed, which asks for the licence to travel with them.
copy(join(ROOT, 'licenses', 'texts', 'Fredoka-OFL-1.1.txt'), 'fonts/Fredoka-OFL-1.1.txt');
copy(join(ROOT, 'licenses', 'texts', 'Inter-OFL-1.1.txt'), 'fonts/Inter-OFL-1.1.txt');
copy(join(ROOT, 'public', 'favicon.ico'), 'favicon.ico');
copy(join(ROOT, 'site', 'apple-touch-icon.png'), 'apple-touch-icon.png');
// The Play feature graphic doubles as the preview image when the link is shared.
copy(
  join(ROOT, 'fastlane', 'metadata', 'android', 'de-DE', 'images', 'featureGraphic.png'),
  'assets/share.png',
);

write('index.html', landingPage());
write('download/index.html', downloadPage());
for (const legal of LEGAL_PAGES) {
  write(`${legal.directory}/index.html`, legalPage(legal));
}
write('404.html', notFoundPage());
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
write('sitemap.xml', sitemap());
// GitHub Pages serves the site under this name only while the file is in the published branch.
write('CNAME', `${config.domain}\n`);

console.log(`build-site: wrote ${OUT}`);

// ---------- Pages ----------

function landingPage() {
  const intro = DESCRIPTION.intro[0];
  const [introHeading, ...introRest] = splitFirstSentence(intro);

  return layout({
    title: `${APP_NAME} – ${SUBTITLE}`,
    description: PROMOTIONAL,
    path: '/',
    body: `
<main id="inhalt">
  <section class="wrap hero" aria-labelledby="app-name">
    <div class="hero-copy">
      <img class="hero-icon" src="/assets/icon.webp" alt="" width="256" height="256">
      <h1 class="brand" id="app-name">${escape(APP_NAME)}</h1>
      <p class="tagline">${escape(SUBTITLE)}</p>
      <p class="promise">${escape(promiseLine())}</p>
      ${storeButtons()}
    </div>
    <div class="phone hero-phone">
      <img src="/assets/screens/heute.webp" width="600" height="1304" alt="Der Heute-Bildschirm der App: ein Gruß, ein Porträt von Clara Zetkin und die Termine des Tages.">
    </div>
  </section>

  <section class="wrap intro" aria-labelledby="mehr">
    <h2 id="mehr">${escape(introHeading)}</h2>
    <p>${escape(introRest.join(' '))}</p>
  </section>

  <div class="wrap features">
${FEATURES.map(
  (feature, index) => `    <section class="feature" aria-labelledby="feature-${index}">
      <div class="feature-copy">
        <h3 id="feature-${index}">${escape(feature.title)}</h3>
        ${paragraphs(DESCRIPTION.sections.get(feature.section))}
      </div>
      <div class="phone settle">
        <img src="/assets/screens/${feature.screen}.webp" width="600" height="1304" loading="lazy" alt="${escape(feature.alt)}">
      </div>
    </section>`,
).join('\n')}
  </div>

  <div class="wrap extras">
${EXTRAS.map(
  (extra) => `    <section>
      <h3>${escape(extra.title)}</h3>
      ${paragraphs(DESCRIPTION.sections.get(extra.section))}
    </section>`,
).join('\n')}
  </div>

  <section class="on-navy privacy" aria-labelledby="daten">
    <div class="wrap">
      <h2 id="daten">Deine Daten bleiben bei dir</h2>
      <ul class="without">
        <li><span>Ohne</span> Konto</li>
        <li><span>Ohne</span> Tracking</li>
        <li><span>Auch ohne</span> Internet</li>
      </ul>
      ${paragraphs(withoutAdvertisingClaim(DESCRIPTION.sections.get('DEINE DATEN BLEIBEN BEI DIR')))}
      <p class="links">
        <a href="/datenschutz/">Datenschutzerklärung lesen</a>
        <a href="https://github.com/verein-amazone/rebellinnen-kalender">Offener Quellcode auf GitHub</a>
      </p>
    </div>
  </section>

  <section class="wrap origin" aria-labelledby="wer">
    <h2 id="wer">Gemeinsam mit Jugendlichen erarbeitet</h2>
    ${paragraphs(DESCRIPTION.intro.slice(1))}
    ${paragraphs(
      DESCRIPTION.closing.filter((paragraph) => !paragraph.includes('#grlpwr')),
      { link: true },
    )}
    <div class="get">
      <h2>Hol dir die App</h2>
      ${storeButtons()}
    </div>
  </section>
</main>`,
  });
}

function downloadPage() {
  return layout({
    title: `${APP_NAME} laden`,
    description: `${APP_NAME} für dein Handy: im App Store und bei Google Play.`,
    path: '/download/',
    script: '/download/download.js',
    header: false,
    body: `
<main id="inhalt" class="wrap download">
  <img class="hero-icon" src="/assets/icon.webp" alt="" width="256" height="256">
  <h1 class="brand">${escape(APP_NAME)}</h1>
  <p class="tagline">${escape(SUBTITLE)}</p>
  ${storeButtons()}
  <p class="status" id="download-status" role="status"></p>
  <a class="more" href="/">Mehr über die App</a>
</main>`,
  });
}

function legalPage({ file, title, directory }) {
  // The Markdown is this repository's own file, not user input, so it is rendered as is.
  const html = marked.parse(readText(join(ROOT, 'public', 'legal', file)), { async: false });

  return layout({
    title: `${title} – ${APP_NAME}`,
    description: `${title} der ${APP_NAME} App von Verein Amazone.`,
    path: `/${directory}/`,
    body: `
<main id="inhalt" class="wrap page">
  <h1>${escape(title)}</h1>
  <article class="sheet">
${html}
  </article>
</main>`,
  });
}

function notFoundPage() {
  return layout({
    title: `Seite nicht gefunden – ${APP_NAME}`,
    description: PROMOTIONAL,
    path: null,
    body: `
<main id="inhalt" class="wrap page">
  <h1>Diese Seite gibt es nicht</h1>
  <p class="page-lead">Vielleicht hat sich die Adresse geändert. Auf der Startseite findest du die App und alle Rechtstexte.</p>
  <p><a class="more" href="/">Zur Startseite</a></p>
</main>`,
  });
}

function sitemap() {
  const paths = ['/', '/download/', ...LEGAL_PAGES.map(({ directory }) => `/${directory}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${ORIGIN}${path}</loc></url>`).join('\n')}
</urlset>
`;
}

// ---------- Shared parts ----------

function layout({ title, description, path, body, script = null, header = path !== '/' }) {
  // `path` is null for the 404 page, which is served for any missing address and has no canonical
  // one of its own.
  const canonical = path === null ? '' : `\n  <link rel="canonical" href="${ORIGIN}${path}">`;
  const stores = `data-app-store="${escape(config.appStoreUrl ?? '')}" data-play-store="${escape(config.playStoreUrl ?? '')}"`;

  return `<!doctype html>
<html lang="de" ${stores}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">${canonical}
  <meta name="theme-color" content="#7dbdbb">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="de_AT">
  <meta property="og:site_name" content="${escape(APP_NAME)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${ORIGIN}/assets/share.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/fredoka-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/site.css">${script === null ? '' : `\n  <script src="${script}" defer></script>`}
</head>
<body>
  <a class="skip-link" href="#inhalt">Zum Inhalt</a>${
    header
      ? `
  <header class="wrap site-header">
    <a class="home-link" href="/"><img src="/assets/icon.webp" alt="" width="256" height="256">${escape(APP_NAME)}</a>
  </header>`
      : ''
  }
${body}
${footer(path)}
</body>
</html>
`;
}

function footer(currentPath) {
  const funding = DESCRIPTION.closing.find((paragraph) => paragraph.includes('#grlpwr'));
  const links = [
    ...LEGAL_PAGES.map(({ title, directory }) => ({ title, href: `/${directory}/` })),
    { title: 'Verein Amazone', href: 'https://www.amazone.or.at/' },
  ];

  return `<footer class="on-navy site-footer">
  <div class="wrap footer-grid">
    <div>
      <nav class="footer-nav" aria-label="Rechtliches und Kontakt">
        <ul>
${links
  .map(
    ({ title, href }) =>
      `          <li><a href="${href}"${href === currentPath ? ' aria-current="page"' : ''}>${escape(title)}</a></li>`,
  )
  .join('\n')}
        </ul>
      </nav>
      <p class="footer-meta">© ${new Date().getFullYear()} Verein Amazone · Entwickelt von Independo GmbH</p>
    </div>
    <div class="funding">
      ${funding === undefined ? '' : `<p>${escape(funding)}</p>`}
      <div class="funding-logos">
        <img src="/assets/logos/eu-kofinanziert-neg.svg" width="1003" height="220" alt="Kofinanziert von der Europäischen Union">
        <img src="/assets/logos/peva-cerv-neg.webp" width="1024" height="274" alt="ProEuropean Values AT – CERV">
      </div>
    </div>
  </div>
</footer>`;
}

/** Both store buttons, or „Bald verfügbar“ for a store whose listing is not public yet. */
function storeButtons() {
  const buttons = [];
  if (config.appStoreUrl) {
    buttons.push(
      `<a class="store store-apple" href="${escape(config.appStoreUrl)}"><img src="/assets/badges/app-store-de.svg" width="120" height="40" alt="${escape(APP_NAME)} im App Store laden"></a>`,
    );
  }
  if (config.playStoreUrl) {
    buttons.push(
      `<a class="store store-google" href="${escape(config.playStoreUrl)}"><img src="/assets/badges/google-play-de.png" width="646" height="250" alt="${escape(APP_NAME)} bei Google Play laden"></a>`,
    );
  }

  const missing = [
    config.appStoreUrl ? null : 'im App Store',
    config.playStoreUrl ? null : 'bei Google Play',
  ].filter((store) => store !== null);
  if (missing.length > 0) {
    buttons.push(
      `<p class="soon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Bald verfügbar ${missing.join(' und ')}</p>`,
    );
  }

  return `<div class="stores">${buttons.join('')}</div>`;
}

/** The promotional text, without the subtitle it starts with, as the line under the subtitle. */
function promiseLine() {
  return PROMOTIONAL.startsWith(SUBTITLE) ? PROMOTIONAL.slice(SUBTITLE.length).trim() : PROMOTIONAL;
}

// ---------- Helpers ----------

/**
 * The store description, split into its untitled opening paragraphs, its titled sections (a line
 * in capitals followed by text) and the untitled paragraphs after the last section.
 */
function parseDescription(text) {
  const intro = [];
  const sections = new Map();
  const closing = [];
  let lastSection = null;

  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    const first = lines[0].trim();
    if (lines.length > 1 && first === first.toUpperCase() && /[A-ZÄÖÜ]/.test(first)) {
      lastSection = first;
      sections.set(
        first,
        lines.slice(1).map((line) => line.trim()),
      );
    } else if (lastSection === null) {
      intro.push(block.trim());
    } else {
      closing.push(block.trim());
    }
  }

  return { intro, sections, closing };
}

/**
 * The website makes no claim about advertising, although the store description does: Verein Amazone
 * asked for it to be left out here. Fails the build when the store wording changes, so the two are
 * reconciled by hand rather than the claim slipping back in.
 */
function withoutAdvertisingClaim(texts) {
  const claim = 'ohne Konto, ohne Werbung und ohne Tracking';
  if (texts === undefined || !texts.some((text) => text.includes(claim))) {
    throw new Error(`build-site: the description no longer says "${claim}"; check the privacy band`);
  }
  return texts.map((text) => text.replace(claim, 'ohne Konto und ohne Tracking'));
}

function paragraphs(texts, { link = false } = {}) {
  if (texts === undefined) {
    throw new Error('build-site: a description section the page needs is missing');
  }
  return texts
    .map((text) => `<p>${link ? linkify(escape(text)) : escape(text)}</p>`)
    .join('\n    ');
}

/** Turns the bare `www.…` and `github.com/…` addresses the store text uses into links. */
function linkify(html) {
  return html.replace(
    /\b((?:www\.|github\.com\/)[^\s<]+[^\s<.,;:!?])/g,
    (address) => `<a href="https://${address}">${address}</a>`,
  );
}

function splitFirstSentence(text) {
  const match = /^(.+?[.!?])\s+(.*)$/s.exec(text);
  return match === null ? [text] : [match[1].replace(/\.$/, ''), match[2]];
}

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function readText(path) {
  return readFileSync(path, 'utf8').trim();
}

function copy(source, target) {
  if (!existsSync(source)) {
    throw new Error(`build-site: ${source} is missing`);
  }
  const destination = join(OUT, target);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function write(target, content) {
  const destination = join(OUT, target);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}
