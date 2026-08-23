---
name: Rebell*innen Kalender
description: A local-only, touch-first calendar app carrying curated feminist/empowerment content for the Verein Amazone community.
colors:
  primary: 'var(--color-primary)'
  primary-foreground: 'var(--color-primary-foreground)'
  secondary: 'var(--color-secondary)'
  secondary-foreground: 'var(--color-secondary-foreground)'
  background: 'var(--color-background)'
  foreground: 'var(--color-foreground)'
  card: 'var(--color-card)'
  card-foreground: 'var(--color-card-foreground)'
  muted: 'var(--color-muted)'
  muted-foreground: 'var(--color-muted-foreground)'
  accent: 'var(--color-accent)'
  accent-foreground: 'var(--color-accent-foreground)'
  nav-bg: 'var(--color-nav-bg)'
  danger: 'var(--color-danger)'
  danger-foreground: 'var(--color-danger-foreground)'
  success: 'var(--color-success)'
  success-foreground: 'var(--color-success-foreground)'
  warning: 'var(--color-warning)'
  warning-foreground: 'var(--color-warning-foreground)'
typography:
  display:
    fontFamily: 'var(--font-display)'
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: 'var(--font-display)'
    fontSize: '1.5rem'
    fontWeight: 600
  title:
    fontFamily: 'var(--font-display)'
    fontSize: '1.125rem'
    fontWeight: 600
  body:
    fontFamily: 'var(--font-sans)'
    fontSize: '1rem'
    fontWeight: 400
  label:
    fontFamily: 'var(--font-sans)'
    fontSize: '0.875rem'
    fontWeight: 600
rounded:
  sm: 'var(--radius-sm)'
  md: 'var(--radius-md)'
  lg: 'var(--radius-lg)'
  xl: 'var(--radius-xl)'
  full: '9999px'
spacing:
  touch: 'var(--spacing-touch)'
  row: 'var(--spacing-row)'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 16px'
    height: '{spacing.touch}'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 16px'
    height: '{spacing.touch}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 16px'
    height: '{spacing.touch}'
  button-danger:
    backgroundColor: '{colors.danger}'
    textColor: '{colors.danger-foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 16px'
    height: '{spacing.touch}'
  card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    rounded: '{rounded.lg}'
  field:
    backgroundColor: '{colors.card}'
    rounded: '{rounded.lg}'
    padding: '8px 16px'
---

# Design System: Rebell*innen Kalender

## Overview

**Creative North Star: "The Print Kalender, Rebuilt as Touch"**

The app is a digital continuation of an existing physical Rebell\*innen Kalender, and the visual
system reads that way: a chunky, rounded, poster-like display face (Fredoka) over a plain, legible
body face (Inter), warm-but-bold color blocks, and the dotted notebook-grid background
(`.dotted-bg`) lifted directly from the print design. Nothing in the system is decorative for its
own sake — every primitive exists because a real screen (Today, appointments, Nicht vergessen,
Anlaufstellen) needed it, and the component set stays deliberately small: buttons, cards/rows,
fields, choices, pills, checks, toggles, sheets, a tab bar, a dropdown menu, a reorderable list.

The system is four swappable palettes (`amazone` default, `warm`/Sonnenuntergang, `nacht`/
Mitternacht, `lila`/Lavendel) over one shared shape, type and spacing language — recoloring the app
is a `data-theme` attribute swap, never a second set of components. Everything is built for a thumb
on glass: no bare `hover:` anywhere in the codebase, `min-h-touch` (48px) on every interactive
target, 16px-minimum form text, and a text-size ladder (`small` 14px through `xxlarge` 32px) that
reflows components rather than clipping them — container queries, not media queries, drive that
reflow because only a container query reacts to root-font-size growth.

**Key Characteristics:**

- Chunky rounded display type (Fredoka) paired with a plain, highly legible UI/body face (Inter)
- Four complete, swappable color themes sharing one token structure, not one static palette
- Native-control-first: checkboxes, radios and switches are real `<input>`s reskinned with
  `accent-color`/`appearance: none`, not custom widgets, so forced-colors mode and screen readers
  get the platform's own behavior for free
- A print-calendar motif (the dotted notebook grid) as the app's one recurring decorative texture
- No shadows as a default idiom; depth comes from flat color-block layering, with `shadow-lg`
  reserved for genuinely floating surfaces (menu panel, dragged row)

## Colors

Four independent, complete themes share one role structure (`primary`, `secondary`, `background`,
`card`, `muted`, `accent`, `danger`/`success`/`warning`, each with a matching `-foreground`), defined
once as raw `--rk-*` values per `[data-theme='…']` block in `theme.css` and exposed to Tailwind as
`--color-*` custom properties via `@theme inline`. **`theme.css` is the only source of truth for
color values; nothing below restates a hex code** — every color is named by its role token
(`var(--color-primary)`, `bg-primary`, …), which resolves differently per theme and stays correct
automatically when a theme's palette changes. Descriptive names below describe `amazone`, the
default theme, as an example; `warm`, `nacht` and `lila` restate the same role tokens with different
values rather than being described separately.

### Primary

- **Brand action color** (`var(--color-primary)` / `bg-primary`, "Amazone Red" in the default
  theme): primary buttons, the focus ring, checked radios/checkboxes/toggles, links in curated
  content.

### Secondary

- **Secondary action color** (`var(--color-secondary)` / `bg-secondary`, "Amazone Teal" in the
  default theme): distinct from the background in every theme so a secondary button never
  disappears into the page.

### Neutral

- **Page background** (`var(--color-background)` / `bg-background`, "Amazone Teal" in the default
  theme): a mid-saturation color rather than plain white or gray in every theme, which is why status
  colors have to run dark enough to stay legible on it.
- **Card surface** (`var(--color-card)` / `bg-card`, "Warm Cream" in the default theme): the surface
  for cards, sheets, menus and the input shell — near white but warm, matching the print calendar's
  paper.
- **Foreground / nav fill** (`var(--color-foreground)` / `var(--color-nav-bg)`, "Deep Indigo" in the
  default theme): body text, headings, and the tab bar's fill — `--rk-nav-bg` is the same value as
  `--rk-foreground` in every theme.
- **Muted surface** (`var(--color-muted)` / `bg-muted`, "Soft Sand" in the default theme):
  muted/hover surfaces (`.rk-button-ghost`'s hover fill, `.rk-toggle` track).
- **Accent** (`var(--color-accent)` / `bg-accent`, "Amazone Orange" in the default theme): the tab
  bar's active-indicator color only — reserved for that single "you are here" signal rather than
  general decoration.

### Named Rules

**The No Color-Only Signal Rule.** In every theme, `danger` is deliberately much darker than
`primary` — on `amazone` specifically, the brand primary is itself red, which would collide with the
conventional "danger" red if the two weren't kept clearly apart. Every destructive action pairs its
color with an explicit verb, an icon, and a confirmation step — never color alone. The same rule
governs status colors generally: none of `danger`/`success`/`warning` is the sole carrier of meaning
anywhere in the app.

**The Theme-Complete Rule.** A color is never hard-coded outside `theme.css`. Adding a fifth theme
means adding one `[data-theme='…']` block there (plus registering its id in the settings
interactor) — no other file, and no TypeScript, holds a color value.

## Typography

**Display Font:** Fredoka (with Inter, system-ui, sans-serif fallback)
**Body Font:** Inter (with system-ui, sans-serif fallback)

**Character:** A chunky, rounded, friendly display face over a plain, dependable body face — the
pairing reads as approachable and calendar-like rather than editorial or corporate. Both are
self-hosted variable fonts (latin + latin-ext only) so the offline-first app never depends on a font
CDN.

### Hierarchy

- **Headline** (Fredoka, semibold 600, `text-2xl`/1.5rem, h1): screen titles.
- **Title** (Fredoka, semibold 600, `text-xl`/1.25rem, h2; `text-lg`/1.125rem, h3): section and card
  group headings.
- **Body** (Inter, regular 400, 1rem): all running text, list rows, form values.
- **Label** (Inter, semibold 600, 0.875rem or smaller): field labels (`.rk-label`), hints
  (`.rk-hint`), errors (`.rk-error`), row values.

### Named Rules

**The Hyphenate-and-Wrap Rule.** German compounds are long. `body` sets `hyphens: auto` (with
`lang="de"` on `<html>`) plus `overflow-wrap: anywhere` as a fallback, and no label anywhere uses
`whitespace-nowrap` — every control's text wraps rather than overflows or forces horizontal scroll.

**The Absolute-Scale Rule.** The in-app text-size setting (`small` 14px → `xxlarge` 32px at the
16px root) replaces the OS text-scale rather than multiplying it; iOS's own Dynamic Type already
reaches 3.12x, so stacking would produce runaway type. The ladder deliberately stops at 2x (Apple's
own Larger-Text floor) — the layout is only proven usable up to there.

## Layout

Single-breakpoint, phone-first: `tablet: 40rem` is the only breakpoint (`tablet:`/`max-tablet:`),
everything below it is the unprefixed phone default. The app shell is a fixed-viewport frame with
exactly one scrolling region (`.rk-scroll-region`) — the tab bar and any focused-screen header sit
outside it and never scroll away, however tall the text-scaled content gets.

Two spacing primitives outside the ordinary Tailwind scale: `--spacing-touch` (48px / 3rem, the
minimum interactive target) and `--spacing-row` (56px / 3.5rem, a list row: a touch target plus
breathing room) — both in `rem`, so they grow with the root font size instead of pinning a control
to a fixed physical size.

Because a `rem`-based media query cannot react to the root font size, every list/row/tab/choice
component instead uses **container queries** against two literal widths that only ever match once
text has scaled up: `18rem` (`--container-row`, below which a row/footer stacks its content instead
of staying on one line) and `13rem` (`--container-compact`, below which decoration — icon size,
padding, minimum height — drops to fixed pixels while the text itself keeps scaling freely).
Standard body padding is `px-4 py-4` on a screen body, tightening to `px-2 py-2` at the compact
threshold.

## Elevation & Depth

The system is flat by default: cards, rows, choices and fields are distinguished by color-block
layering (`card` surface against `background`) and a `.rk-list`/`.rk-row` divider, not by shadow.
`box-shadow` appears in exactly two places, both genuinely floating content that leaves the normal
document layer: the dropdown menu panel (`.rk-menu`, `shadow-lg`) and the row being dragged in a
reorderable list (`.cdk-drag-preview`, `shadow-lg`).

### Shadow Vocabulary

- **Floating panel** (Tailwind `shadow-lg`): the menu panel and the actively-dragged row — content
  that has left the normal stacking order and needs to visually detach from what's underneath it.

### Named Rules

**The Flat-Unless-Floating Rule.** A shadow is reserved for an element that has actually left the
page's normal layer (an open menu, a row mid-drag). Every resting surface — card, row, field, sheet
panel — stays flat; depth there comes from a filled surface color and a rounded corner, never a
shadow.

## Shapes

One radius scale, driven from a single root token (`--rk-radius`, set once in `theme.css`), with
`--radius-md` and `--radius-sm` stepping down and `--radius-xl` stepping up from it in fixed offsets
(`calc(var(--rk-radius) ± Npx)`) — every rounded corner in the app is one of those four Tailwind
`rounded-*` utilities, never an arbitrary value, and changing `--rk-radius` alone rescales all four.
Cards, buttons, fields and list groups use `rounded-lg`; the sheet panel's top corners use
`rounded-t-xl`; pills, checks, toggles and the tab indicator use `rounded-full`; the Anlaufstellen
service badge uses `rounded-2xl` on purpose (a fixed Tailwind default, not a project token), so its
square badge silhouette reads as visually distinct from a pill's fully-round chip.

Borders are consistently `border-2` (2px) at rest, thickening to `border-4` on a focused field while
its padding shrinks by the same amount so the box never reflows. Border width is one of the only
places the system uses a fixed `px` value rather than `rem` — a border is decoration, not text, and
must not scale with the root font size.

## Components

### Buttons

- **Shape:** rounded corners (`rounded-lg`, 10px), `min-h-touch` (48px) minimum height, never a
  fixed height so a wrapped label doesn't clip.
- **Primary:** filled `primary` on `primary-foreground`, `px-4 py-2`, semibold label.
- **Secondary:** filled `secondary` on `secondary-foreground`, same shape.
- **Ghost:** transparent, `foreground` text, `muted` fill on `hoverable:`/`active:`.
- **Danger / Danger-secondary:** filled `danger` for a destructive primary action; a `border-2`
  outline in `danger` on the field surface (`input-background`) for a destructive action that
  should not carry primary-button weight — never signaled by color alone (see Colors' Named Rules).
- **Icon buttons:** the same control shell (`rk-control-base`) squared off (`size-touch`, no
  padding); a filled-primary variant for a row's one submit action, and a `border-2` outline-primary
  variant for a header action that matters but isn't the screen's main call to action.
- **Hover / Focus:** no bare `hover:` anywhere — `hoverable:` (gated on `(hover: hover) and
(pointer: fine)`) plus `active:brightness-90` carries the touch feedback. Focus uses a themed
  2px outline (`outline-ring`) with a 2px offset, visible on every theme.

### Chips

- **Pill** (`.rk-pill`): a calendar's own color identity as a fully-rounded chip — a `border-2` in
  the calendar's per-instance color over a background tinted 15% toward that color via
  `color-mix()` (never a Tailwind palette color, since the calendar color is arbitrary and
  per-instance). Label text always stays the normal foreground color, never the calendar's color,
  because a 30-swatch curated palette can't guarantee 4.5:1 contrast for every swatch.
- **Service badge** (`.rk-service-badge`): the same coloured-border-over-tinted-background technique
  at 20% tint and `rounded-2xl`, so it reads as a distinct "lead visual" context from a pill's
  filter-chip role.

### Cards / Containers

- **Corner Style:** `rounded-lg` (10px).
- **Background:** `card` surface on `card-foreground` text.
- **Shadow Strategy:** none — see Elevation & Depth's Flat-Unless-Floating rule.
- **Border:** none on a bare card; a grouped list (`.rk-list`) uses `divide-border divide-y` between
  rows instead of individual borders.
- **Internal Padding:** rows are `px-4 py-3`, tightening to `12px`/`8px` past the compact container
  threshold.

### Inputs / Fields

- **Style:** `card`-adjacent `input-background` fill, `border-2` in `border`, `rounded-lg`.
- **Focus:** the border grows from 2px to 4px while padding shrinks by the same amount (no reflow);
  a filled (non-empty) field keeps the emphasized `ring`-colored border so a completed form reads at
  a glance without re-focusing each field.
- **Error / Disabled:** an invalid field (`aria-invalid="true"`) turns its border `danger`; the error
  text below it is the primary signal, always present in the DOM inside an `aria-live="polite"`
  region — the red border is a redundant cue, never the only one.

### Navigation

- **Style:** the bottom tab bar (`.rk-tab-bar`) fills `nav-bg` (the deep-indigo foreground color) with
  `rebel-text` labels; a `min-h-touch` tab stacks icon over label. The active destination is marked
  two ways — bold label weight plus a small `accent`-colored rounded indicator bar beneath the
  icon — never by color alone.
- **Compact form:** past the `13rem` container threshold, icon size and indicator size pin to fixed
  pixels (24px icon, 16×3px indicator) while the label keeps scaling, so the bar doesn't consume the
  whole viewport at large text sizes.

### Sheets (signature component)

Modal sheets (`app-sheet` chrome, `.rk-sheet-*` looks) slide up from the bottom edge over a
`foreground/40` backdrop, in one of two heights (`.rk-sheet-panel-bottom`, capped at 85dvh; or
`.rk-sheet-panel-full`, viewport height minus 3rem) — never taller than the screen, with the sheet's
own body as the sole scrolling region inside it. A `.rk-sheet-grabber` bar is a purely visual
affordance; the sheet is not swipe-dismissible in v1, so the close button and Escape are the actual
dismissal paths. Entry/exit use a 220ms/180ms `cubic-bezier` slide, respecting the app's
reduced-motion override.

### Choices, checks and toggles

Radio/checkbox choices (`.rk-choice`) render as a card-styled row around a native `<input>`, kept
native specifically to inherit roving tabindex, arrow-key navigation and forced-colors support for
free. The round checklist tick (`.rk-check`) and the slide toggle (`.rk-toggle`) are the one place
the system redraws a native control's chrome (`appearance: none`) rather than reskinning it with
`accent-color` — both hand rendering back to the platform under `forced-colors: active`, and a
completed checklist entry is never marked by the check alone: its row text strikes through and the
control's accessible name flips to the opposite action.

## Do's and Don'ts

### Do:

- **Do** keep every color value inside `theme.css`'s per-theme blocks; a theme is complete or it
  doesn't exist (The Theme-Complete Rule).
- **Do** gate hover styles behind `hoverable:` and use `active:` for the state that actually matters
  on a touch screen.
- **Do** use container queries (`18rem`/`13rem` thresholds), not media queries, for any layout rule
  that must react to the in-app text-size setting.
- **Do** reserve `shadow-lg` for content that has actually left the page's normal stacking layer
  (an open menu, a dragged row) — not for ordinary resting cards or fields.
- **Do** pair `danger` with an explicit verb, icon and confirmation step; never let color alone carry
  a destructive action.
- **Do** keep a native `<input type="checkbox">`/`radio` under any reskinned control (check, toggle,
  choice) so forced-colors mode, Space/Enter and screen-reader semantics keep working.

### Don't:

- **Don't** write a bare `hover:` utility anywhere — it sticks after a tap on touch and never clears.
- **Don't** give an interactive element a fixed `h-*`/`w-*`; use `min-h-touch`/`min-w-touch` so a
  wrapped label at a large text size never clips.
- **Don't** introduce a shadow on a resting surface (card, row, field, sheet panel) — depth there
  comes from the flat `card`/`background` color pairing, never a drop shadow.
- **Don't** add a fifth radius value outside the `sm`/`md`/`lg`/`xl` scale derived from `--rk-radius`.
