# Design system

The app's visual primitives: what they are, where they live, and the rules they are built to.

This document covers the _how_. For where the UI layers sit relative to interactors and the data
layer, see [Frontend architecture](./frontend-architecture.md).

## The hybrid rule

There is one decision to make whenever a new pattern appears:

| The pattern is…         | It becomes…                  | Lives in                   |
| ----------------------- | ---------------------------- | -------------------------- |
| purely visual           | an `rk-*` CSS class          | `src/styles/components/`   |
| behaviour or ARIA state | an `app-*` Angular component | `src/app/view/components/` |

The prefix is the visible marker of which kind you are looking at. `app-` is required by
`@angular-eslint/component-selector`; `rk-` matches the existing `--rk-*` token prefix, so a reader
seeing `rk-` knows the rule is ours rather than Tailwind's or the CDK's.

A class is preferred wherever it works, because the same visual button appears as a `<button>` and
as an `<a routerLink>`, and a class composes with both without forking into two component APIs.
Reach for a component only when there is real behaviour to own: focus management, ARIA state,
keyboard handling, or markup that must not be retyped correctly on every screen.

Grow the system only when a second call site appears. A primitive with one user is a page style.

## File layout

```
src/styles.css                       barrel: tailwind, CDK stylesheets, then the four below
src/styles/fonts.css                 self-hosted @font-face
src/styles/theme.css                 tokens, themes, custom variants
src/styles/base.css                  element defaults and shared utilities
src/styles/components.css            barrel — imports only
src/styles/components/button.css     .rk-button*, .rk-icon-button, rk-icon
src/styles/components/card.css       .rk-card, .rk-list, .rk-row*
src/styles/components/choice.css     .rk-choice*
src/styles/components/field.css      .rk-field, .rk-input, .rk-label, .rk-hint, .rk-error
src/styles/components/navigation.css .rk-tab-bar, .rk-tab*
src/styles/components/screen.css     .rk-scroll-region, .rk-screen-*
src/styles/components/sheet.css      .rk-sheet-*
```

One file per primitive, because each carries a comment header explaining its constraints and those
do not survive being merged into one long file. Do not create a file before its primitive exists.

No underscore prefixes: Tailwind v4's `@import` is real CSS `@import` with no partial concept, so
the Sass convention would mean nothing here.

No `styleUrl` on any component. Every visual rule lives in `src/styles/`, which keeps one searchable
location and stays clear of the `anyComponentStyle` budget in `angular.json`.

### Layer order decides the cascade, not import order

`@import 'tailwindcss'` emits `@layer theme, base, components, utilities;` before anything else, so
every `.rk-*` rule in `@layer components` always loses to a Tailwind utility on the same element:

```html
<a class="rk-button rk-button-primary w-full">Neuer Termin</a>
```

`w-full` wins over anything the primitive sets, with no `!important` and regardless of where the
files are imported. Overriding a primitive at the call site is always safe.

## Writing rules: `@utility` vs `@layer components` vs a theme value

- **`@layer components`** is the default for a named visual pattern. It sorts below utilities, which
  is what makes call-site overrides work.
- **`@utility`** only when the rule must be `@apply`-able. `@apply` accepts _utilities only_ — it
  cannot reference a class defined in `@layer components`. That is why `rk-control-base` and
  `rk-icon` are utilities, and why `.rk-list` repeats the surface declarations instead of
  `@apply rk-card`.
- **A theme value** (`--spacing-*`, `--breakpoint-*`, `--container-*`) for anything that is really a
  scale step. Never write an `@utility` that competes with a real Tailwind utility: Tailwind sorts
  utilities by its own internal order, so a custom `rk-touch` against `min-h-16` on one element has
  no defined winner. As `--spacing-touch` it becomes an ordinary `min-h-touch` that sorts correctly.

## Tokens

Three groups, all in `src/styles/theme.css`:

1. **`--rk-*` raw values** — one static block per colour theme, selected by `data-theme` on `<html>`.
   The theme blocks all have equal specificity, so **source order alone decides the winner**: keep
   `:root, [data-theme='amazone']` first, and never set raw values outside a theme block.
2. **`@theme inline`** — maps the raw values into Tailwind's namespaces. `inline` is required: it
   keeps the `var()` in the generated utilities, which is what lets changing `data-theme` recolour
   the app at runtime.
3. **plain `@theme`** — static scale values that never change at runtime, so there is no reference
   worth keeping: `--spacing-touch`, `--spacing-row`, `--breakpoint-tablet`, `--container-row`, `--container-compact`.

Colour values never live in TypeScript.

### Status colours

`danger`, `success` and `warning`, each with a `-foreground`, defined in all four themes. Each is
legible as text on both `card` and `background` and carries its foreground when used as a fill.

Two constraints worth knowing before changing them:

- Amazone's `--rk-primary` is itself red and its `background` is a mid teal, which forces its status
  colours quite dark. Orange is unavailable — it collides with `--rk-accent`.
- On `nacht` the polarity inverts: the status colour is light and its `-foreground` is dark, matching
  how `--rk-primary` already behaves there.

**Destructive actions are never signalled by colour alone.** Pair `danger` with an explicit verb, an
icon, and a confirmation step.

Contrast is checked per theme by the Playwright suite, because each theme is a separate palette and
one pass proves nothing about the other three.

### Breakpoints and custom variants

One breakpoint, `--breakpoint-tablet: 40rem`, giving `tablet:` and `max-tablet:`. Phone is the
unprefixed default. It is a theme value rather than an `@custom-variant` because the theme namespace
generates the whole variant family for free.

Two custom variants:

- **`hoverable:`** — `(hover: hover) and (pointer: fine)`. Use this instead of bare `hover:`. On a
  touch device a hover state sticks after a tap and the control stays visibly lit until the user taps
  somewhere else.
- **`motion-reduced:`** — mirrors how `base.css` resolves motion: the in-app override wins, and the
  device preference applies only when the user has not explicitly chosen `standard`.

## Scaling-safe rules

Every primitive is built for a root font size far larger than the default, because the OS text-size
preference drives it (`--rk-os-scale`, see
[OS text scaling](./frontend-architecture.md#os-text-scaling)). The in-app ladder stops at 2x, but
the device setting does not — iOS reaches 3.12x — so the primitives have to hold up past the ladder.
These rules are what keep the layout usable there:

1. **`min-h-*`, never `h-*`** on anything containing text. A fixed height clips a wrapped label.
2. **rem for spacing.** Tailwind's default spacing scale is already rem — do not switch it to px.
   Border widths are the exception: they are not text and must not scale.
3. **No `whitespace-nowrap`.** No `truncate` or `line-clamp` without a route to the full text.
4. **`min-w-0` on text-bearing flex children.** Without it a flex child refuses to shrink below its
   content width and overflows instead of wrapping.
5. **Icons in `em`**, so they track the label they sit next to (`rk-icon`, `rk-icon-sm`). An icon
   that should track the _root_ instead — a fixed navigation glyph, say — stays on `size-*`, which
   is rem-based and therefore already scaling-safe.
6. **Intrinsic sizing over breakpoints.** `grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]` reflows on
   its own; a breakpoint never will.
7. **Long words must be breakable.** `src/styles/base.css` sets `hyphens: auto` and
   `overflow-wrap: anywhere` on `body`. German compounds are wider than a phone column once scaled —
   "Systemeinstellung" overflowed a 320px screen by 226px at 300% — and one unbreakable word makes
   the whole screen scroll sideways. `anywhere` rather than `break-word`: only `anywhere` shrinks the
   min-content width, which is what lets a flex or grid child give up the space.
8. **One scroll region, chrome outside it.** The shell is a fixed `h-dvh` frame and `.rk-scroll-region`
   is the only element that scrolls. Vertical scrolling at 2x and beyond is expected — the content
   genuinely is several viewports tall, and reflow asks for exactly that — but the tab bar must not
   scroll away with it.
9. **Decoration may be capped in pixels, text never.** Past `--container-compact` the tab bar's icon,
   its active indicator, the row and choice padding and the focused-screen dismiss button switch to
   fixed pixel sizes. That is what buys the space back: at 3x the tab bar went from 216px to 107px
   and the header from 193px to 109px on a 375x667 screen. Capping a **label** the same way would be
   defeating the setting, and is what Apple screens for — see the `.rk-tab` comment for the line
   between the two.

### Media queries cannot react to text size — container queries can

`rem` inside `@media` resolves against the **browser default** font size, not the root font size. It
never moves when the app scales its text. `rem` inside `@container` resolves against the **actual**
root font size, so it does.

Verified in Chromium with a 343px-wide container:

| root font-size | `@container (max-width: 18rem)` | `@media (max-width: 18rem)` | `@media (max-width: 288px)` |
| -------------- | ------------------------------- | --------------------------- | --------------------------- |
| 16px           | no match                        | no match                    | no match                    |
| 48px (300%)    | **matches**                     | no match                    | no match                    |

So a `md:grid-cols-3` layout happily keeps three columns while the text inside triples, which is
exactly how overlapping text is produced. **Container queries are the only query mechanism that
responds to text scaling.** `.rk-list` and `.rk-sheet-footer` use one; reach for `@container` rather
than a breakpoint whenever the question is "does this still fit".

The threshold needs care in the other direction too: `--container-row` is 18rem (288px at the default
size) precisely because no phone is that narrow, so a row never stacks at normal text size. A 22rem
threshold would have stacked rows on a 375px device out of the box.

## Primitives

### Buttons — `button.css`

`.rk-button` plus `.rk-button-primary` / `-secondary` / `-ghost` / `-danger`, and `.rk-icon-button`
for square label-less actions. `rk-control-base` is the shared `@utility` they build on and is not
for direct use.

Accessibility contract: an icon button needs an `aria-label` or an `.sr-only` span, and its icon is
always `aria-hidden`. The focus ring comes from the global `:focus-visible` rule in `base.css` —
primitives must not set their own `outline`. Disabled uses the `disabled` attribute so the control is
genuinely inert; an `<a>` has no disabled state, so render a `<button>` instead.

### Card, list and row — `card.css`

`.rk-card` is a surface. `.rk-list` is a grouped list of rows and is the query container.
`.rk-row` is one row, with `.rk-row-label` and `.rk-row-value` inside it.

These are presentational only. Semantics stay in the template: a grouped list is a `<ul>` of `<li>`,
and `.rk-row` goes on the `<a>` or `<button>` _inside_ the `<li>` so the whole row is one target.

### Choice row — `choice.css` + `app-choice-row`

A radio option as a card row. The control is a **native `<input type="radio">`** — native radio
groups already provide roving tabindex, arrow keys with wrap, Home/End, "option 2 of 4" position
announcements and forced-colors rendering, correctly, on every platform. `accent-color` in
`base.css` themes them without `appearance: none`, which is what makes keeping the native control
affordable. Angular Aria ships listbox, menu, tabs and tree but deliberately no radio group.

The component exists to hold markup that would otherwise be repeated per screen, and to slot
trailing content such as the theme page's colour swatch. Put the options in a `<fieldset>` with a
`<legend>` and give them all the same `name`. The description sits inside the same `<label>`, so it
becomes part of the accessible name — which reads correctly and avoids generating ids.

### Field, input and error — `field.css`

CSS only for now: no screen has a form yet, and a `touched`/`invalid` component API should be
designed against a real form rather than an imagined one.

`.rk-field` grows its border from 2px to 4px on `:focus-within` while shrinking the padding by
exactly the same amount, so the box keeps its size and nothing reflows.

The contract the first form has to honour:

- every `.rk-input` has its own `<label for>`; a placeholder is not a label
- the `.rk-error` sits inside a wrapper carrying `aria-live="polite" aria-atomic="true"` that is
  **always in the DOM** — an element appearing at the same moment as its text is frequently not
  announced at all
- `aria-invalid` and `aria-describedby` bind only once the field has been touched
- the error is always text; the red border is a redundant cue, never the only one

### Shell frame — `screen.css`

`.rk-scroll-region` is the app's single scrolling element and the query container every screen
resolves `@container` against. `.rk-screen-body` and `.rk-screen-header-bar` carry the padding around
a focused screen's content and header; both trim past `--container-compact`, and the header's
dismiss button is capped there too — it is label-less, so its glyph carries no text to scale.

### Tab bar — `navigation.css`

`.rk-tab-bar` (the query container), `.rk-tab-list`, `.rk-tab`, `.rk-tab-icon`, `.rk-tab-indicator`.
Because the bar sits outside the scroll region, its height is a fixed cost on every screen, so past
`--container-compact` the icon, indicator and padding go to fixed pixels while the labels keep
scaling. Active state is signalled three ways — `aria-current`, bold weight and the indicator — never
by colour alone.

### Sheet — `sheet.css` + `app-sheet` + `SheetService`

A modal sheet in two modes: `bottom` (content height, the Material bottom-sheet shape) and `full`
(near full height, for forms).

```ts
private readonly sheets = inject(SheetService);

protected chooseCalendar(): void {
  this.sheets
    .open<string>(CalendarPickerDialog, { heading: 'Kalender wählen', mode: 'bottom' })
    .closed.subscribe((calendarId) => {
      if (calendarId !== undefined) {
        this.calendar.select(calendarId);
      }
    });
}
```

From inside the content component: `inject(SheetRef).close(id)`, and `inject(SHEET_DATA)` for
whatever was passed in.

**The chrome lives in `view/components/sheet/`; the contents are presenters and belong in
`view/dialogs/`.**

It is built on the CDK overlay rather than `CdkDialog`, so everything a modal owes the user is wired
explicitly in `sheet.service.ts`: the dialog role and accessible name, the focus trap, `inert` on the
app shell, blocked page scrolling, Escape, the backdrop, and focus restoration with a fallback to the
page heading for when the opener has been destroyed by a navigation. `@angular/cdk/overlay-prebuilt.css`
is imported in `src/styles.css` and is not optional — without it the sheet renders as ordinary
content at the end of `<body>`.

The animation is plain CSS `@keyframes` on purpose. `base.css` neutralises motion by forcing
`animation-duration` to 0.01ms on descendants of `<html>`, and the Web Animations API ignores that
entirely — an `Element.animate()` sheet would keep sliding for users who asked it not to.

Not in v1: drag-to-dismiss, snap points, and a pinned footer region. `.rk-sheet-footer` exists for
content to use, but in v1 it scrolls with the body.

## Testing

CSS primitives get no unit test. A spec would either assert class strings, which is tautological, or
computed styles, which jsdom does not cascade from the global stylesheet. This matches how the rest
of the suite is written: it asserts landmarks, roles, focus and announcements, never appearance.

Components with behaviour get a spec that asserts the contract. Two jsdom limitations are worth
knowing, because both look like bugs and are not:

- **Geometry is always zero**, so the CDK's `InteractivityChecker` judges every element unfocusable
  and a focus trap gives up. `sheet.spec.ts` substitutes a checker that ignores visibility.
- **CSS animations never run**, so `animationend` never fires. The sheet's teardown races
  `animationend` against a 300ms timeout, which is what makes the tests terminate.
- **`BlockScrollStrategy` no-ops**, because it only engages when the document is actually scrollable.
  Scroll blocking is therefore verified in Playwright, not in a unit test.

Playwright covers what jsdom cannot: colour contrast per theme, and a horizontal-overflow canary at
200% text on every route. Add a route to both loops when you add a screen.
