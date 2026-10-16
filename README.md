<p align="center">
  <img src="./docs/images/app-icon.png" alt="Rebell*innen app icon: Cool Cat, a cat with a headscarf and sunglasses, drawn in white on navy" width="240">
</p>

# Rebell\*innen Kalender

The Rebell\*innen Kalender is developed together with [Verein Amazone](https://www.amazone.or.at/),
workshop participants and [Independo](https://independo.app/) as a digital version of the existing
[Rebell\*innen Kalender](https://www.amazone.or.at/projekte/rebell-innen-kalender).

This repository is the central place for planning, discussion and development of the first version.

Developed by Independo GmbH on behalf of Verein Amazone.

## Status

Version 1 is feature-complete and in pre-release testing: release candidates (`1.0.0-rc.N`) reach
testers through TestFlight and Play internal testing, and 1.0.0 is planned for both stores.

- [V1 scope and known limitations](./docs/v1-scope.md) - what the first version does, what it
  deliberately leaves out, and what does not work yet.
- [Release notes](./docs/release-notes/) for the public releases; [CHANGELOG.md](./CHANGELOG.md)
  for every version.
- [Release process](./docs/release.md) and the [pre-release QA checklist](./docs/qa-checklist.md).

## What is it about?

The first version is meant to be a simple, everyday calendar app that works **without login and
without its own server infrastructure**. The initial focus is on:

- A today view / start screen
- Personal appointments and basic calendar features
- Curated content from the Rebell\*innen / Amazone context
- A simple checklist
- Customization and accessibility
- Sharing individual appointments or content through existing channels

Some ideas from the workshops remain important but are likely later expansion paths, for example
friend lists, real shared calendars, chat, automatic location search, or automatic news feeds.

## Supported products

iOS and Android are the products that ship. There is deliberately no SSR, no backend and no cloud
synchronization.

| Property           | Value                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| App ID (bundle ID) | `at.or.amazone.rebellinnenkalender`                                                                           |
| Display name       | `Rebell*innen`                                                                                                |
| Minimum iOS        | 16.4                                                                                                          |
| Minimum Android    | API 26 (Android 8.0)                                                                                          |
| Minimum WebView    | Safari 16.4, Chrome 108 ([why](./docs/architecture/frontend-architecture.md#supported-browsers-and-webviews)) |

### Website

The app has a small website on Verein Amazone's domain, `https://kalender.amazone.or.at/`: an
introduction with the store links, `/download` (the target of the printed QR codes, which sends a
phone straight to its store) and the privacy policy, terms of use and imprint. It is a static
[Astro](https://astro.build/) site in [`apps/site`](./apps/site/), styled with Tailwind on the app's
own design tokens and rendering the same legal texts the app bundles, and published from `dev` by
[.github/workflows/pages.yml](./.github/workflows/pages.yml). See
[docs/store-listing.md](./docs/store-listing.md#website) for how it is put together.

```bash
pnpm build:site  # Build the website to apps/site/dist
pnpm test:site   # Build it, plus a copy with test store links, and run its Playwright suite
pnpm --filter @amazone/site dev  # Serve it locally with live reload
```

The browser build of the app itself is not published. It exists for local development and the e2e
suite.

## Repository layout

A [pnpm workspace](https://pnpm.io/workspaces): two apps and the packages they share. Run every
command from the repository root; the root scripts (`pnpm build`, `pnpm e2e`, `pnpm build:site`, …)
delegate to the right package.

| Path                                                  | What it is                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`apps/app`](./apps/app/)                             | `@amazone/app` - the Angular + Capacitor app with its native projects, fastlane and store assets, and scripts |
| [`apps/site`](./apps/site/)                           | `@amazone/site` - the website (Astro + Tailwind)                                                              |
| [`packages/design-system`](./packages/design-system/) | `@amazone/design-system` - design tokens, colour themes, custom variants and the webfonts                     |
| [`packages/legal`](./packages/legal/)                 | `@amazone/legal` - privacy policy, terms of use and imprint as Markdown                                       |
| [`docs`](./docs/)                                     | Architecture, release, store and content documentation for the whole repository                               |

The root `package.json` holds the release version (semantic-release bumps it, and the app's version
scripts read it) and the repository-wide tooling: Prettier, commitlint and semantic-release. Versions
that several packages share are pinned once in the `catalog:` of
[`pnpm-workspace.yaml`](./pnpm-workspace.yaml), and every TypeScript project extends
[`tsconfig.base.json`](./tsconfig.base.json).

## Architecture

The application follows a layered architecture with the dependency direction
**View/Presenters → Interactors → Data**. Before changing application code, read:

- [Frontend architecture](./docs/architecture/frontend-architecture.md)
- [Data & persistence](./docs/architecture/data-persistence.md)
- [Agent instructions](./AGENTS.md)

Adding or editing a curated Wissensimpulse/Rebell\*in item (catalog entry, image conversion,
licensing)? See [docs/content-authoring.md](./docs/content-authoring.md), and
[docs/content-images.md](./docs/content-images.md) for what to ask an image contributor for.

Where the app icon above comes from, how the native assets are generated and how to add another
icon? See [docs/app-icon.md](./docs/app-icon.md).

## Tech stack

- [Angular](https://angular.dev) 22 - standalone, zoneless, strict, signals-first
- [Capacitor](https://capacitorjs.com) 8 - native iOS and Android
- [Tailwind CSS](https://tailwindcss.com) 4
- Angular CDK, Angular Aria, [Lucide](https://lucide.dev) icons
- [`@capacitor-community/sqlite`](https://github.com/capacitor-community/sqlite) for local persistence
- [`@ebarooni/capacitor-calendar`](https://github.com/ebarooni/capacitor-calendar) for the device calendar
- Vitest (unit) + Playwright and Axe (e2e / accessibility)
- ESLint (flat config) + Prettier

## Development

### Prerequisites

- **Node.js 24+** (pinned in `.nvmrc` / `.node-version` to 24.18.0)
- **pnpm 11+** (exact version pinned via the `packageManager` field in `package.json`)
- For native builds: **Xcode** (iOS) and **Android Studio / JDK** (Android)

pnpm is the only supported package manager. Enable [Corepack](https://nodejs.org/api/corepack.html)
so the pinned pnpm version is used automatically:

```bash
corepack enable
```

### Install

```bash
pnpm install
```

### Angular development server

```bash
pnpm start        # http://localhost:4200
```

### Tests, linting and formatting

```bash
pnpm test         # Unit tests (Vitest, watch mode)
pnpm test:ci      # Unit tests once (non-interactive)
pnpm lint         # Angular ESLint (includes architecture layer-boundary rules)
pnpm format       # Apply Prettier
pnpm format:check # Check formatting
pnpm e2e          # Playwright smoke test incl. Axe accessibility scan
pnpm store:screenshots # Store screenshots and Play feature graphic (docs/store-listing.md)
```

### Build and Capacitor synchronization

```bash
pnpm build        # Production build to dist/rebellinnen-kalender/browser
pnpm cap:sync     # Build + sync both native projects
```

`pnpm build` is what `cap sync` and the e2e suite consume.

### Open the native projects

```bash
pnpm cap:open:ios      # Opens the iOS project in Xcode
pnpm cap:open:android  # Opens the Android project in Android Studio
```

Running on a device is the normal Xcode / Android Studio flow after `pnpm cap:sync`: pick the device
and press run. Signing for local development uses the automatic signing already configured in the
projects; nothing in this repository needs a certificate to build or run.

### Releasing

Releases are automated. Merging into `dev` cuts a prerelease and uploads it to TestFlight and Play
internal testing; nothing is version-bumped by hand. See [docs/release.md](./docs/release.md).

### Angular CLI MCP

For version-accurate Angular support, the official
[Angular CLI MCP Server](https://angular.dev/ai/mcp) is configured in `.mcp.json` and runs
project-locally through the installed Angular CLI. Editors and agents that read `.mcp.json` pick it
up without further setup; everything else can start it manually:

```bash
pnpm exec ng mcp
```

Its `get_best_practices` and `search_documentation` tools answer against the installed Angular
version, which is why the architecture documentation keeps Angular code examples short instead of
pinning them to a version that will move.

## Planning

Planning happens through GitHub Issues and Milestones. The early issues are meant as discussion and
decision spaces where variants, wireframes, questions and feedback are collected.

[Current milestones](https://github.com/verein-amazone/rebellinnen-kalender/milestones):

1. V1 product picture & wireframes (done)
2. MVP base: local calendar app (done)
3. Curated content & organization events (done)
4. Test version, release & open-source foundation - the road to 1.0.0
5. Sharing & shared use
6. After V1

### Good entry points

- [docs/v1-scope.md](./docs/v1-scope.md) - what V1 covers, and where everything it leaves out is
  tracked
- [Open issues after V1](https://github.com/verein-amazone/rebellinnen-kalender/milestone/6), for
  example #3 Share appointments with others

### How to give feedback

Feedback is welcome directly in the GitHub Issues. Workshop participants may also give feedback via
the WhatsApp group; the project team transfers relevant feedback into the matching issue so that
decisions stay traceable. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Licensing

Unless stated otherwise, the source code in this repository is licensed
under the MIT License. See [LICENSE](./LICENSE).

Images, photographs, editorial content and other media assets are not
covered by the MIT License. Each asset is subject to its own licence or
permission terms. Image licence and attribution information is documented
in the image attribution data included in this repository
([apps/app/public/content/images.json](./apps/app/public/content/images.json)).

No permission to reuse an asset should be assumed beyond the licence or
permission explicitly documented for that asset.

Third-party software licences - the npm packages and the native iOS and
Android libraries - ship with every production build and are readable offline
in the app under **Einstellungen → Lizenzen & Impressum**. Which licences may
ship is decided in [apps/app/licenses/policy.json](./apps/app/licenses/policy.json); see
[apps/app/licenses/README.md](./apps/app/licenses/README.md).

## Note on design

The visual design (colors, typography, components) will be derived later from the approved Figma
mockup.

The app has a small in-app design system in the meantime: design tokens and visual patterns as CSS
in `apps/app/src/styles/`, and the few UI primitives that carry real behaviour as Angular components in
`apps/app/src/app/view/components/`. It is deliberately minimal and grows only when a second call site
appears. See [docs/architecture/design-system.md](./docs/architecture/design-system.md).
