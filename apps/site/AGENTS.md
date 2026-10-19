# Website (`@amazone/site`)

The website at rebellinnen.amazone.or.at: the landing page, `/download` (the QR-code target) and the
legal pages. Astro with static output, styled with Tailwind on the app's own tokens. Read the
repository's [AGENTS.md](../../AGENTS.md) first; its touch-first and accessibility rules apply here
unchanged.

- **Tokens, fonts, `hoverable:`** come from `@amazone/design-system` (`src/styles/global.css`). Use
  the tokens for colour and add a missing one to the package; the only literals are shadow tints and
  the `theme-color` meta, which cannot read a CSS variable.
- **Legal texts** come from `@amazone/legal` and are rendered as they are. Edit them there - the app
  shows the same files.
- **Nothing from elsewhere.** `src/layouts/BaseLayout.astro` sends a Content-Security-Policy that
  allows this origin only, so no inline `<script>` or `<style>`, no `style=` attributes and no
  `data:` URLs. A script goes in `public/` and is loaded with `<script is:inline src=… defer>`.
  The e2e suite fails on any policy violation and any foreign request.
- **Store addresses** live in `site.config.json`; `null` shows „Bald verfügbar“.
- **No advertising claim** on the landing or download page (Verein Amazone's request); the e2e
  suite checks it.
- Run `pnpm test:site` from the repository root: it builds the site twice (real config and test
  store addresses) and runs the Playwright suite in `e2e/`.

Astro reference: https://docs.astro.build. When starting the dev server from an agent, use
`astro dev --background` and manage it with `astro dev stop|status|logs`.
