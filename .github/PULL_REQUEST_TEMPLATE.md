## What this changes

<!-- One or two sentences. Link the issue: "Closes #123". -->

## Definition of done

Everything below is part of the change, not a review step. Tick what applies; strike out what
genuinely does not.

- [ ] The commits follow [Conventional Commits](https://www.conventionalcommits.org/) - `commitlint`
      checks them, and semantic-release derives the released version from them.
- [ ] Quality gates pass locally: `pnpm format:check`, `pnpm lint`, `pnpm test:ci`, `pnpm build`.
- [ ] Architecture boundaries hold: View/Presenters → Interactors → Data. No DAO, SQL or Capacitor
      plugin in a view; no view state or navigation in an interactor.
- [ ] Touch first: no bare `hover:`, every action reachable by a plain tap, touch targets at least
      `min-h-touch`, text fields at 16px or more.
- [ ] Accessibility (WCAG 2.2 AA): a native element is styled rather than wrapped, the accessible
      name contains the visible label, ARIA state is bound to the same signal as the visible state,
      and the change was checked manually with the keyboard, at maximum OS text size, and with
      VoiceOver or TalkBack.
- [ ] Documentation and code comments are in English, and the architecture docs are updated if a
      boundary or a layer concept changed.
- [ ] Dependencies changed? `pnpm cap:sync` was run and the resulting `ios/` and `android/` changes
      are committed.

## How this was tested

<!-- Devices, screen readers, text sizes, edge cases. Say what you did not test. -->
