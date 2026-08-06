# Accessibility

The conformance target is **WCAG 2.2 Level AA**. Accessibility is not a review step at the end; a
component is not finished until it satisfies the [definition of done](#definition-of-done) below.

Automated checks cannot establish conformance. The axe run in Playwright catches a fraction of the
failure modes — a clean report means "no machine-detectable error", not "accessible".

## What this app has to support

It is a phone app in a WebView, so the input and output modes that actually occur are:

- **Touch**, with VoiceOver (iOS) or TalkBack (Android) turned on or off.
- **The OS text-size preference**, up to 3.12x on iOS, and browser zoom on the web build.
- **Voice Control / Voice Access**, which activates controls by their _visible_ text.
- **Switch Control / Switch Access** and paired Bluetooth keyboards, which is why keyboard
  operability still matters even though the device has no keyboard.
- **Reduced motion**, dark mode and high-contrast settings.
- Cognitive and language needs: plain German, no time limits, no undiscoverable gestures.

Three of these already have their own chapter, and those chapters are the normative text — this
document does not repeat them:

- [Touch-first interaction](./design-system.md#touch-first-interaction) — hover, tap paths, target
  size, 16px text entry, platform gestures.
- [Scaling-safe rules](./design-system.md#scaling-safe-rules) and
  [OS text scaling](./frontend-architecture.md#os-text-scaling) — reflow, resize, no clipping.
- [Focus and announcements](./frontend-architecture.md#focus-and-announcements) — what happens on
  navigation, centrally, in `PageFocus`.

## Implementation order of preference

Work down this list. Move to the next level only when the previous one cannot satisfy the design or
the behaviour, and say in a comment why.

1. **Native HTML.** `<button>`, `<a href>`, `<input>`, `<select>`, `<dialog>`, `<details>`,
   `<fieldset>`/`<legend>`, `<table>`, the landmark elements, `<h1>`–`<h6>`.
2. **Angular template bindings** for an ARIA value that changes with component state.
3. **Angular Aria** (`@angular/aria`) when the interaction matches an established composite pattern
   — accordion, combobox, grid, listbox, menu, tabs, toolbar, tree — but the visual design is ours.
   The menu primitive already uses this; see [Menu](./design-system.md#menu--menucss--ngmenu-angular-aria).
4. **Angular CDK a11y** (`@angular/cdk/a11y`) for primitives the levels above do not provide:
   `LiveAnnouncer`, `CdkTrapFocus`, `FocusMonitor`, the key managers, `InteractivityChecker`.
5. **Custom ARIA and JavaScript**, following the WAI-ARIA Authoring Practices pattern in full.

**Do not start a custom ARIA implementation until levels 1–4 have been evaluated and found
unsuitable.** There is no Angular Material in this project and none is planned — the design system
is Tailwind plus our own primitives, which is precisely the case Angular Aria exists for.

A CSS class or an attribute directive on a native element beats a wrapper component. Do not build an
`<app-button>` whose host is a custom element; `rk-control-base` and friends style a real `<button>`
or `<a>`, which keeps focusability, Enter/Space activation, `disabled`, form participation and the
platform's own assistive-technology handling for free.

### Get Angular examples from the MCP server, not from this file

Angular APIs move. This document deliberately carries almost no Angular code, because a pasted
snippet goes stale silently. The [Angular CLI MCP server](https://angular.dev/ai/mcp) is configured
in `.mcp.json` and runs project-locally, against the installed CLI version:

- `get_best_practices` — the official Angular best-practices guide. Read it before writing Angular
  code in a session.
- `search_documentation` — current angular.dev documentation, including the accessibility guide,
  Angular Aria patterns, CDK a11y, `@defer`, router and forms.

Use those tools for the current spelling of an API. Use this document for what the _project_
requires.

## Name, role, state, value

Every interactive element must expose, where applicable: a role, an accessible name, its state or
value, a description when the name alone is not enough, its relationships to labels/panels/errors,
keyboard behaviour, and defined focus behaviour.

ARIA changes what is _reported_. It never adds keyboard behaviour, pointer behaviour, styling or
state management. A `role` on a `<div>` is a promise the `<div>` cannot keep.

### Accessible names

Preference order: visible native text → associated `<label>` → `aria-labelledby` → `aria-label`.

**The accessible name must contain the visible label**, ideally starting with it. Voice Control
users say what they see; a button reading „Speichern" with `aria-label="Änderungen sichern"` cannot
be spoken to. Add context after the visible text, never instead of it.

Icon-only controls need a name describing the _action_ („Erinnerung löschen"), not the glyph („X").
The icon itself is `aria-hidden="true"`. When visible text is already next to the icon, the icon
stays hidden and no extra name is added — otherwise the name is announced twice.

`placeholder` is never the only label. It disappears on input and its contrast is usually too low.

Long instructions belong in `aria-describedby`, not in the name.

### Visually hidden text

Tailwind's `sr-only` is the project's utility, and it is what the `<span class="sr-only">` labels in
the reminder list and the sheet dismiss button use. `.cdk-visually-hidden` also exists — the CDK
prebuilt stylesheet is imported so `LiveAnnouncer` works (see
[Angular CDK stylesheets](./frontend-architecture.md#angular-cdk-stylesheets)) — but do not mix the
two; `sr-only` is ours.

Never visually hide a focusable control unless it becomes visible on focus. Never put
`aria-hidden="true"` on a focusable element or an ancestor of one.

Visible text beats hidden text. Reach for `sr-only` only when the information genuinely cannot be on
screen.

### State is derived, never duplicated

`aria-expanded`, `aria-pressed`, `aria-selected`, `aria-checked`, `aria-current`, `aria-invalid` and
`aria-busy` must be bound to the same signal that drives the visible appearance. Accessibility state
kept in a second place drifts out of sync, and the drift is invisible to a sighted reviewer.

`aria-expanded` describes the current state, not what the next tap will do.

Pick the state that matches the widget, not the one that looks similar. `aria-selected` is for
options, tabs, rows and cells; `aria-checked` is for checkboxes, radios and switches;
`aria-current` marks the current page or step — which is how the tab bar marks the active
destination.

Never use `role="menu"` for ordinary navigation. It models a desktop application menu and brings a
keyboard contract with it.

## Announcements

`PageFocus` owns navigation focus and navigation announcements. Pages do not manage either.

For everything else:

- A change the user can see, inside the component that changed, goes in a template live region:
  `role="status"` (or `aria-live="polite"` with `aria-atomic="true"`, as the reminder list and the
  reminder-edit dialog do). Put the empty container in the DOM first and fill it afterwards — a
  region that appears together with its text may not be announced.
- A change originating outside a rendered region — a background job, an overlay, a cross-component
  outcome — goes through the CDK `LiveAnnouncer`.
- **Never both for the same event.** That is duplicate speech.
- `role="alert"` / `'assertive'` interrupts the user. Reserve it for something that has to be acted
  on now. Confirmations, counts and save states are polite.
- Announce the outcome, not each step. Do not repeat an identical message.
- A live region is not a substitute for visible text; important messages are visible too.
- Do not move focus in order to announce something.

## Forms and errors

- Every control has a persistent, programmatically associated label — `<label for>` with a matching
  `id`. This also enlarges the tap target.
- Correct `type` and `autocomplete` tokens. Never disable paste.
- Group radios and related checkboxes in `<fieldset>` with a `<legend>` — `sr-only` on the legend
  when the group heading is already visible above it, which is what the settings pages do.
- Required state is visible and programmatic, and never signalled by colour alone.
- On a validation failure: mark the field `aria-invalid`, link the message with `aria-describedby`,
  say what is wrong _and_ how to fix it, and keep the user's valid input.
- Angular's `ng-invalid` class, a red border, a disabled submit button or a toast are not error
  reporting.
- For a form with several errors, render a summary with links to the fields and move focus to it.

`ControlValueAccessor` makes a component participate in Angular forms. It does nothing for
accessibility — such a control still owes naming, disabled, required, invalid, keyboard and focus
behaviour.

## Images, icons and content

- Informative image: `alt` describing its purpose in context. Decorative: `alt=""` — present, empty.
- Inline SVG that is decoration: `aria-hidden="true"` (`focusable="false"` where IE-era behaviour
  still matters). All Lucide icons in this app are decoration next to a text label.
- When an image is the only content of a control, its alternative names the _function_.
- Markdown content is rendered through `marked` and sanitised with DOMPurify; heading levels in
  authored content must continue the page's outline and not skip.
- Tables are for tabular data, with `<caption>` and `<th scope>`. A static table is never an ARIA
  grid.

## Visual requirements

- Text contrast at least **4.5:1**, large text **3:1**. Verified per theme in Playwright.
- **3:1 non-text contrast** for anything meaning-bearing: focus rings, control borders that identify
  the control, checked/selected indicators, meaningful icons.
- **Never colour alone.** Add text, an icon, a border or a shape. The tab bar's active indicator
  exists for this reason; the destructive confirmation adds an icon rather than only turning red.
- Focus must be visible in every theme and state, and **must not be obscured** by the sticky header,
  the tab bar or an open sheet (WCAG 2.2 SC 2.4.11).
- `:focus-visible` in CSS is the default mechanism. Do not reach for `FocusMonitor` to reproduce it.
- Respect `prefers-reduced-motion`, including view-transition pseudo-elements, which sit outside the
  document tree and have to be disabled explicitly. The app also has an in-app motion setting.
- Nothing flashes, nothing auto-advances without a control to stop it.

## Dialogs, sheets and overlays

The sheet and the dialogs are the modal surfaces. A modal owes all of:

1. An accessible name.
2. A deliberate initial focus target — the heading, the first field, or the least destructive
   action, chosen for the content. Not reflexively the container.
3. Background content that cannot be operated, by pointer or by screen-reader virtual navigation.
4. Tab and Shift+Tab contained.
5. Escape to close, unless closing would lose data.
6. A visible close control.
7. Focus returned to the invoking control on close.

A focus trap alone is not a modal — `CdkTrapFocus` constrains Tab and nothing else. Do not add a
second trap around a component that already manages focus.

Tooltips, disclosures, non-modal drawers and menus are **not** modal. Do not trap focus in them.

## Testing

Automated and manual, in that order of cost, not of authority.

**Automated (CI).** `angular-eslint`'s `templateAccessibility` config is active in
`eslint.config.js`; treat a finding as a defect, not as a rule to disable. Playwright runs axe for
colour contrast per theme and a horizontal-overflow canary at 200% text on every route — add new
routes to both loops, and add a separate case for any state that has no URL, such as an open menu or
an open sheet. Unit specs assert landmarks, roles, focus and announcements, never appearance; see
[Testing](./design-system.md#testing) for the jsdom limitations that look like bugs.

Assert behaviour, not attributes. `expect(el.getAttribute('role')).toBe('button')` proves nothing
about whether the thing can be operated.

**Manual, per feature.**

| Pass                | Do this                                                       | Expect                                                                     |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Keyboard            | Tab, Shift+Tab, Enter, Space, arrows, Escape                  | Everything reachable, order logical, focus visible and unobscured, no trap |
| Text size           | OS text size to maximum, 200% and 400% zoom on the web build  | No clipping, no overlap, no sideways scrolling, no control lost            |
| VoiceOver (iOS)     | Complete the workflow by swipe navigation                     | Names, roles, states and updates correct; focus lands where it should      |
| TalkBack (Android)  | Same workflow                                                 | Same, plus correct grouping                                                |
| Voice Control       | Activate controls by speaking their visible label             | Every control responds to its visible text                                 |
| Colour and contrast | Both themes, high contrast, and a colour-blindness simulation | Nothing is distinguishable by colour alone                                 |
| Reduced motion      | Enable the OS setting and the in-app one                      | Non-essential motion gone, no information lost with it                     |

Screen readers do not have to speak identical words. The meaning and the operation have to be there.

Test the workflow, not only the isolated component. Components pass in isolation and fail next to a
sheet, a route transition, a sticky header or another live region.

## Definition of done

A component is not complete until:

- [ ] It uses the correct native element, or a complete Angular Aria / WAI-ARIA pattern.
- [ ] Role, name, state, value and relationships are exposed correctly.
- [ ] The accessible name contains the visible label.
- [ ] It works by touch, by keyboard, and with a screen reader.
- [ ] Focus order, focus destination and focus return are deliberate, and focus stays visible.
- [ ] Dynamic changes are announced once, at the right politeness, and are also visible.
- [ ] It survives maximum OS text size and 320px-equivalent reflow.
- [ ] It relies on neither colour, motion, hover, gesture nor drag alone.
- [ ] Text and non-text contrast are met in both themes.
- [ ] It was tested manually, not only by axe and lint.
- [ ] The behaviour is covered by a spec.

## Settled decisions and known limits

Recorded here so they are not rediscovered as new findings:

- **Every route declares a `title`,** and no `TitleStrategy` is registered, so Angular's default one
  writes it to `document.title` on each navigation (SC 2.4.2). A route added without a `title`
  silently keeps the previous screen's, which is why the Playwright suite asserts the title of every
  route — extend that list together with the route.
- **No skip link, deliberately.** SC 2.4.1 asks for a way past repeated blocks that precede the
  content. In this shell `<main>` is the first element in the DOM and the tab bar comes after it, so
  there is no block to skip. Revisit if a persistent header with navigation is ever added.
- **Playwright runs desktop Chromium**, so it cannot catch a sticky `:hover`, a real touch target or
  a screen-reader defect. Those are review and manual-test responsibilities.
