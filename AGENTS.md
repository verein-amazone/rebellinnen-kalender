# Agent instructions

Concise rules for coding agents working in this repository. Read the architecture documentation
before changing application code:

- [Frontend architecture](./docs/architecture/frontend-architecture.md)
- [Design system](./docs/architecture/design-system.md)
- [Accessibility](./docs/architecture/accessibility.md)
- [Data & persistence](./docs/architecture/data-persistence.md)
- [Contributing guide](./CONTRIBUTING.md)

## Tooling

- Use **pnpm exclusively**. Never use `npm` or `yarn`; never commit `package-lock.json` or
  `yarn.lock`.
- Use official CLIs and Angular schematics (`pnpm exec ng generate …`, `pnpm exec cap …`) instead of
  hand-writing boilerplate.
- The [Angular CLI MCP Server](https://angular.dev/ai/mcp) is configured in `.mcp.json` and runs
  project-locally. **Use it instead of recalling Angular APIs from memory:** `get_best_practices`
  before writing Angular code, `search_documentation` for the current spelling of an API, an Angular
  Aria pattern, a CDK primitive or a router/forms detail. The docs deliberately keep Angular
  examples short for this reason - the MCP server is the up-to-date source, not the prose.

## Angular conventions

- Standalone components, strict TypeScript, strict templates, zoneless change detection.
- Signals are the default for view-facing state. No NgModules for application architecture.
- The `@app/*` path alias maps to `src/app/*`.
- Use `private` by default. Use `#private` only where hard runtime privacy is intentional and the
  member will never need template access, subclass access, overriding, spying, or direct test
  access. Members used from a template are `protected`.

## Architecture (dependency direction: View/Presenters → Interactors → Data)

- **Pages and dialogs are presenters.** They hold view-facing signals, call interactors, react to
  user actions, open dialogs, and navigate. They must not inject DAOs, run SQL, touch the SQLite
  plugin, or call native calendar APIs directly.
- **Business logic lives in interactors.** Interactors are stateless application use cases; they
  orchestrate the data layer and must not hold view state, navigate, or inject UI/components.
- **Persistence and external data-source access live in the data layer** (DAOs, migrations, stores,
  gateways). Never inject DAOs or the SQLite plugin into views.
- **Keep plugin-specific types behind data gateways** so Capacitor types never leak into interactors
  or views.
- The ESLint config enforces these boundaries via `no-restricted-imports`. Fix violations; do not
  disable the rule.

## Touch first

This is a phone app in a WebView. There is no mouse and no keyboard on the device, so:

- **No bare `hover:`.** Hover sticks after a tap on touch and stays lit until the user taps elsewhere.
  Use the `hoverable:` variant (gated on `(hover: hover) and (pointer: fine)`) plus `active:` for the
  feedback that actually matters.
- **Never make hover, long press, right click, double tap or drag the only way to reach something.**
  Every action needs a plain tap path, and a control that matters is always visible rather than
  revealed on hover.
- **Touch targets are at least `min-h-touch`** (48px) and never a fixed `h-*`, so a wrapped label
  cannot clip.
- **Text fields render at 16px or more.** Below that iOS zooms the page in on focus and does not zoom
  back out.
- Prefer `dvh` over `vh`, and never `user-scalable=no` or `maximum-scale` in the viewport.
- See [Touch-first interaction](./docs/architecture/design-system.md#touch-first-interaction) for the
  detail and the reasoning.

## Accessibility

The target is **WCAG 2.2 Level AA**, and it is part of the definition of done, not a review step.
Read [Accessibility](./docs/architecture/accessibility.md) before building a component. The rules
that bite most often:

- **Work down the order of preference:** native HTML → Angular template binding → Angular Aria
  (`@angular/aria`) → CDK a11y (`@angular/cdk/a11y`) → custom ARIA. There is no Angular Material
  here. Do not start a custom ARIA implementation until the levels above have been ruled out.
- **Style a native element; do not wrap it.** `rk-*` classes and attribute directives go on a real
  `<button>` or `<a>`. A custom-element host loses focusability, Enter/Space, `disabled` and form
  participation, and ARIA does not give them back.
- **The accessible name must contain the visible label**, ideally starting with it - Voice Control
  users say what they see. Icon-only controls name the action; the icon is `aria-hidden="true"`.
  `placeholder` is never the only label.
- **Bind ARIA state to the same signal as the visible state.** `aria-expanded`, `aria-pressed`,
  `aria-current`, `aria-invalid` must never live in a second place.
- **Announce once.** A visible change uses a template `role="status"` / `aria-live="polite"` region;
  a change from outside the template uses the CDK `LiveAnnouncer` - never both for one event.
  `PageFocus` already owns navigation focus and announcements; pages do not manage either.
- **Form controls need a real `<label for>`**, plus `aria-invalid` and `aria-describedby` on error.
  `ng-invalid` and a red border are not error reporting.
- **Never colour alone**, contrast 4.5:1 for text and 3:1 for meaningful non-text, and focus must
  stay visible and unobscured by the sticky header, tab bar or an open sheet.
- `angular-eslint`'s template accessibility rules are active. Fix findings; do not disable them.
- axe passing is not conformance. Manually check keyboard, maximum OS text size, and VoiceOver or
  TalkBack for the whole workflow.

## General

- Do not add dependencies, abstractions, ORMs, or speculative product code without a concrete need.
- Write all technical documentation and code comments in **English**.
- Update the architecture docs when you change a boundary or introduce a new layer concept.
- Before finishing, run: `pnpm format:check`, `pnpm lint`, `pnpm test:ci`, `pnpm build`
  (and `pnpm cap:sync` when native registration is affected).
