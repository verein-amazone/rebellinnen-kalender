# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Note: targets both iOS (16.4+) and Android (API 24+) natively via Capacitor, no browser/PWA release
target. Visual/interaction language is deliberately unified across both OSes, not diverging per
platform - `adaptive` here means "native on both OSes," not "different look per OS." Every surface
must be touch-first: no mouse/keyboard-only interaction, no hover-dependent affordances (see
CLAUDE.md "Touch first").

## Users

The broader Verein Amazone community - not limited to active workshop participants. Anyone
interested in the Rebell\*innen content and calendar can use the app day-to-day as a personal,
no-login calendar with curated feminist/empowerment content, entirely on-device.

## Product Purpose

A digital version of the existing physical Rebell\*innen Kalender: a simple, everyday calendar app
that works without login and without the app's own server infrastructure. Success is a calendar
people actually use daily that also surfaces curated Amazone/Rebell\*innen content and a simple
checklist, fully offline and privacy-respecting.

## Positioning

Local-only, no-account calendar carrying curated feminist/empowerment content (Wissensimpulse,
Rebell\*innen) that a generic calendar app would not include, without the login/cloud-sync tradeoff
that content-driven community apps usually make.

## Operating Context

- Native mobile only (iOS 16.4+, Android API 24+), via Capacitor - touch input only, no
  mouse/keyboard interaction model.
- Fully offline-capable: local SQLite persistence, device calendar integration
  (`@ebarooni/capacitor-calendar`), no backend, no cloud sync.
- Screens in place or planned: Today view/start screen, personal appointments/calendar, curated
  Amazone/Rebell\*innen content, checklist ("Nicht vergessen"), settings/customization, sharing via
  existing OS share channels, support-services/Anlaufstellen contacts.

## Capabilities and Constraints

- Hard constraint: no login, no backend, no cloud synchronization - local-only.
- Curated content (Wissensimpulse/Rebell\*in catalog entries) follows licensing and image-conversion
  rules documented in `docs/content-authoring.md`; future work must not add entries that bypass them.
- Touch-first only: no hover-only affordances, min 48px touch targets, 16px+ text fields (see
  CLAUDE.md).
- Later/expansion ideas explicitly out of current scope: friend lists, real shared calendars, chat,
  automatic location search, automatic news feeds.

## Brand Commitments

- Name: `Rebell*innen Kalender`. Bundle ID: `at.or.amazone.rebellinnenkalender`.
- The app icon is a fixed brand asset. Three variants ship (`resources/app-icons/`), all drawn
  from the same workshop sketch; the user picks between them in the settings.
- Built with/for Verein Amazone (https://www.amazone.or.at/), developed by Independo GmbH on their
  behalf.

## Evidence on Hand

- `docs/content-authoring.md` - licensing/authoring rules for curated content entries.
- `docs/app-icon.md` - where the app icon comes from and how its assets are generated.
- No testimonials, benchmarks, or pricing exist; do not fabricate any.

## Product Principles

1. Local-first and account-free: never add a feature that implicitly requires login, backend, or
   cloud sync.
2. Touch-first, not web-first: every interaction must work with tap-only input, no hover/mouse
   fallback.
3. Curated content stays within licensed/authored bounds - no ad-hoc content additions.
4. Everyday-use calendar first, curated content and checklist as supporting surfaces - not the
   other way around.

## Accessibility & Inclusion

Target: WCAG 2.2 Level AA, treated as part of the definition of done (see
`docs/architecture/accessibility.md`), plus the touch-first rules above. No additional
product-specific accessibility need beyond this was identified.
