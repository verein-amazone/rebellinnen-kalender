# @amazone/legal

The legal texts in German, as Markdown, in one place:

| File                         | Shown as                              |
| ---------------------------- | ------------------------------------- |
| `src/datenschutz.md`         | Datenschutzerklärung (privacy policy) |
| `src/nutzungsbedingungen.md` | Nutzungsbedingungen (terms of use)    |
| `src/impressum.md`           | Impressum (imprint)                   |

- **App** (`apps/app`): angular.json copies the files to `legal/`, and the app reads them at
  runtime (`LegalContentGateway`), so they work offline.
- **Website** (`apps/site`): each legal page imports its file and renders it at build time.
- **Stores**: the store listings link to the website's `/datenschutz/`;
  `apps/app/scripts/check-store-listing.mjs` checks the policy against what the listings declare.

A change here therefore changes the app, the website and what the stores point at in one commit.
Prettier leaves these files alone (`.prettierignore`), so the wording and line breaks stay exactly as
written.
