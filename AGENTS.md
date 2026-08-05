# Agent instructions

Concise rules for coding agents working in this repository. Read the architecture documentation
before changing application code:

- [Frontend architecture](./docs/architecture/frontend-architecture.md)
- [Design system](./docs/architecture/design-system.md)
- [Data & persistence](./docs/architecture/data-persistence.md)
- [Contributing guide](./CONTRIBUTING.md)

## Tooling

- Use **pnpm exclusively**. Never use `npm` or `yarn`; never commit `package-lock.json` or
  `yarn.lock`.
- Use official CLIs and Angular schematics (`pnpm exec ng generate …`, `pnpm exec cap …`) instead of
  hand-writing boilerplate.
- Consult the [Angular CLI MCP Server](https://angular.dev/ai/mcp) for current Angular 22 practices.

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

## General

- Do not add dependencies, abstractions, ORMs, or speculative product code without a concrete need.
- Write all technical documentation and code comments in **English**.
- Update the architecture docs when you change a boundary or introduce a new layer concept.
- Before finishing, run: `pnpm format:check`, `pnpm lint`, `pnpm test:ci`, `pnpm build`
  (and `pnpm cap:sync` when native registration is affected).
