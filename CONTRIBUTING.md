# Contributing to the Rebell\*innen Kalender

Thanks for getting involved.

This repository is an open planning and development space for the first version of the Rebell\*innen
Kalender. Not everything is decided yet - that is exactly what the
[Issues](https://github.com/verein-amazone/rebellinnen-kalender/issues), comments and feedback are
for.

Everyone taking part is expected to follow the [Verhaltenskodex](./CODE_OF_CONDUCT.md). Security
problems go through the [security policy](./SECURITY.md) rather than a public issue.

## Ways to participate

- Read the current [Issues](https://github.com/verein-amazone/rebellinnen-kalender/issues) and
  [Milestones](https://github.com/verein-amazone/rebellinnen-kalender/milestones) to see the state
  of the planning.
- Comment directly in the relevant GitHub issues when you have ideas, questions or concerns.
- Workshop participants may also give feedback via the WhatsApp group; the project team transfers it
  into the matching issue.
- Use issues for variants, sketches, examples and follow-up questions.

Feedback is especially helpful on: what is genuinely useful in everyday life, what is understandable
(or not), what is missing, what should be simpler, and which variant feels right.

## Development workflow

### Branches and pull requests

- `dev` is the integration branch: every change lands here first, and every merge into it produces a
  prerelease (`1.0.0-rc.1`, `1.0.0-rc.2`, …) for TestFlight and Play internal testing.
- `main` is the release branch: merging `dev` into it produces a release (`1.0.0`, `1.0.1`, …) for
  the App Store and Play production.
- Create focused feature branches off `dev` and open a pull request back into it.
- Keep pull requests small and reviewable, with a clear description of the change.

Merging into `dev` also builds and uploads the prerelease to TestFlight and Play internal testing.
[docs/release.md](./docs/release.md) describes the whole path, the credentials it needs and what to
do when an upload fails.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`,
for example `feat(calendar): …`, `fix(a11y): …`, `chore(deps): …`. CI runs `commitlint` over every
commit of a pull request, so this is a required check rather than a style preference.

The convention is not cosmetic: semantic-release reads the commit types to decide the next version.
`feat` bumps the minor version, `fix` the patch version, and a `BREAKING CHANGE:` footer the major
version. `build`, `chore`, `ci`, `refactor` and `revert` also produce a patch, so that every merge
into `dev` gets its own distinct, sortable version to hand to testers. `docs`, `style` and `test`
release nothing - a typo fix does not need a new build.

Merge commits are exempt, which is why pull requests are merged rather than squashed: the individual
commits are the record.

### Versions

Nothing in the repository is version-bumped by hand. semantic-release owns the version and, on every
release, writes it into `package.json`, `CHANGELOG.md`,
`src/app/cross-cutting/infrastructure/app-version.ts` (shown on the „Über die App" screen), and the
iOS and Android version fields, then tags the commit and publishes a GitHub release.

The native build number is derived from the version by `scripts/sync-native-version.mjs`; see its
header comment for the encoding. `node scripts/sync-native-version.mjs --check` runs in CI and fails
when the native fields no longer match `package.json`.

If a store upload fails after the release already happened, do not re-upload the same build number -
both stores reject it permanently. Re-run the **Store upload** workflow for the same tag when the
build never reached the store, and push an empty commit to `dev`
(`git commit --allow-empty -m 'fix: retry the release upload'`) when it did. See
[docs/release.md](./docs/release.md).

### Package manager

**pnpm only.** Do not use `npm` or `yarn`, and do not commit `package-lock.json` or `yarn.lock`.
Enable [Corepack](https://nodejs.org/api/corepack.html) so the pinned pnpm version is used.

### CLI-first generation

Use official CLIs and schematics instead of hand-writing boilerplate:

- Angular CLI (`pnpm exec ng generate …`) for Angular artifacts.
- Capacitor CLI (`pnpm exec cap …`) for platform and plugin operations.
- The [Angular CLI MCP Server](https://angular.dev/ai/mcp) is configured in `.mcp.json` and runs
  project-locally. Consult it (`get_best_practices`, `search_documentation`) for current Angular 22
  practices before writing Angular code or configuration by hand.

### Quality gates

Before opening a pull request, run:

```bash
pnpm format:check
pnpm lint
pnpm test:ci
pnpm build
```

The lint step enforces the architecture layer boundaries (see below). Fix any violations rather
than disabling the rule.

CI additionally builds both native projects on every pull request: an unsigned iOS simulator build
and an Android debug build, each preceded by `cap sync`. If a change touches dependencies, run
`pnpm cap:sync` and commit the resulting changes to `ios/` and `android/` - otherwise the sync check
in CI fails because the committed native projects no longer match the lockfile.

### Language

All technical documentation and code comments must be written in **English**. (Community-facing
issue discussion may use German.)

## Architecture rules

Read [docs/architecture/frontend-architecture.md](./docs/architecture/frontend-architecture.md),
[docs/architecture/accessibility.md](./docs/architecture/accessibility.md) and
[docs/architecture/data-persistence.md](./docs/architecture/data-persistence.md) before changing
application code. Key rules:

- The dependency direction is **View/Presenters → Interactors → Data**.
- Views (pages, dialogs, scaffolds, blocks, components) **must not** access the data layer, inject
  DAOs, run SQL, or call native plugins directly.
- Business logic lives in interactors; interactors are stateless and UI-agnostic.
- Persistence and external data-source access live in the data layer; plugin-specific types stay
  behind data gateways.
- **Update the architecture documentation when you change a boundary or introduce a new layer
  concept.**

## Definition of done

- [ ] Change follows the architecture rules and dependency direction.
- [ ] Official CLIs/schematics were used where applicable.
- [ ] The [accessibility definition of done](./docs/architecture/accessibility.md#definition-of-done)
      is met: correct native element, accessible name containing the visible label, keyboard and
      screen-reader operation, focus and announcements, contrast, maximum text size.
- [ ] Technical docs and code comments are in English.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm test:ci` and `pnpm build` pass.
- [ ] Architecture docs updated if a boundary changed.
- [ ] No unnecessary dependencies, abstractions, or speculative product code were added.

## Working with issues

Many issues are working and discussion spaces, not just finished decisions. When commenting, it
helps to reference a specific issue, briefly describe your point, add an example if useful, and
distinguish between an idea, a question and a concrete proposal.

We want to keep the entry threshold low: clear language, traceable decisions, as few barriers to
feedback as possible, and a transparent planning state rather than a "finished" presentation.
