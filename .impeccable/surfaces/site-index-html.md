---
version: 1
slug: 'site-index-html'
primary_target: 'apps/site/src/pages/index.astro'
related_targets: ['apps/site/src/pages/download.astro', 'apps/site/src/layouts/BaseLayout.astro']
---

# Surface brief: kalender.amazone.or.at (public website)

Scope: the one-page landing (`/`), the QR target `/download`, and the legal pages (`/datenschutz/`, `/nutzungsbedingungen/`, `/impressum/`), all built by Astro from `apps/site` into `apps/site/dist/`. Visitor mode: Persuade (landing, download); Read (legal pages).

Audience and job: teens arriving by QR code on a phone install the app in seconds; adults who recommend it (youth workers, teachers, parents) confirm it is safe - no account, no tracking, offline, from Verein Amazone. Action: the store badge for their phone. Proof: real app screens, the approved store copy, open source, Amazone as publisher, EU/PEVA funding. Constraints: copy only from approved store texts; no third-party requests, no cookies; works without JS (only `/download` uses a script); touch-first, WCAG 2.2 AA; store URLs may be null until release (then „Bald verfügbar“).

Unresolved: App Store ID, public Play URL, Amazone and PEVA logo files, exact EU funding statement.

## Direction contract

THESIS: The app persuades for itself. Real screens, shown big and crisp, carry the page; the category default it refuses is an abstract hero illustration with a feature-icon grid.

OWN-WORLD: The app's Amazone theme at page scale: teal #7dbdbb ground with the navy dotted notebook grid, navy #15195f text and bands, cream #fffdf6 cards with 10px radius, signal red #de2c27 only for the one primary action, orange #f28a2e as a sparing highlight. Fredoka for display, Inter for body. Screens sit in a simple navy device outline, flat, no glossy mockup.

STORY: The visitor sees what the app is (a feminist calendar), sees it working, learns it keeps everything on the phone, and taps their store.

FIRST VIEWPORT: Phone: icon (72px) and „Rebell*innen“ in Fredoka at the top, subtitle „Dein feministischer Kalender“, the promotional line, the store badge row, then the Heute screen rising from the bottom edge, cropped by the fold. Desktop: copy and badges left (5 cols), a tall Heute screen right (5 cols), dotted teal behind both.

FORM: Phone stage, position 4 of 7 on the ranked list; seed key 292c6afd. Below the fold: three feature rows alternating screen and text (Kalender, Rebell*innen und Wissen, Anlaufstellen), a navy privacy band („Deine Daten bleiben bei dir“), footer with legal links, Amazone and funding. Signature interaction: the screens settle into place on scroll (transform only, off under reduced motion).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

REFINED (2026-10-16, polish pass after the move to Astro): copy and screens sit side by side from 48rem (portrait tablet) instead of 60rem; the phone frame has a 0.6rem bezel and sizes itself to the screenshot, so no screen is cropped; „Bald verfügbar“ is a status (icon in a ring, two lines of display type) rather than a white pill that looked like a button; the legal pages with six or more sections get a section list (collapsed „Inhalt“ on the phone, sticky column on desktop); the favicon is rounded. The site's type scale and tiers are documented in DESIGN.md („Website“).
