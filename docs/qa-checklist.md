# Pre-release QA checklist

The manual pass that runs before a release from `main`. Automated checks - lint, unit specs,
Playwright with axe and the large-text canary - run on every pull request and are not repeated here.
This list covers what they cannot see: real devices, real screen readers, real permissions,
real notifications, and an upgrade over a build that testers already have.

It is the release-level version of the per-feature passes in
[Accessibility → Testing](./architecture/accessibility.md#testing). Those apply to one component;
this one applies to the whole app, end to end, on the build that is about to ship.

## How to run it

1. Pick the release candidate that will become the release (the `1.0.0-rc.N` that `main` is about to
   be merged from) and install it from TestFlight and Play internal testing - not a local debug
   build. The checks below are about the shipped artifact.
2. Open an issue for the run, with this file as its body, so the result is recorded next to the
   findings:

   ```bash
   gh issue create \
     --title "QA run 1.0.0-rc.N" \
     --body-file docs/qa-checklist.md \
     --milestone "4) Testversion, Release & Open-Source-Grundlage"
   ```

3. Tick the items in that issue as you go. Edit the "Run" block at the top first.
4. File every finding as **its own issue with a milestone** and link it from the run.
5. Close the run issue when every finding is either fixed or filed.

Not every item needs every device. Run the whole list once on one iPhone and one Android phone; run
the items marked **(all devices)** on every device in the matrix.

---

## Run

- Build under test: `1.0.0-rc.N`, iOS build `…`, Android versionCode `…`
- Upgrade baseline (the build testers had before this one): `…`
- Devices and OS versions used: `…`
- Tester and date: `…`

## Devices and OS

- [ ] iOS 16.4, the declared minimum (`IPHONEOS_DEPLOYMENT_TARGET`) - a device or a simulator
- [ ] Current iOS on a real iPhone
- [ ] A small iPhone (SE size) and a large one (Pro Max size)
- [ ] Android API 24, the declared minimum (`minSdkVersion`) - an emulator is fine here
- [ ] Current Android on a real phone
- [ ] A small and a large Android phone
- [ ] iPhone only and portrait only: the app does not offer itself on iPad and does not rotate

Simulators and emulators cannot judge VoiceOver, TalkBack, haptics, or whether a reminder fires
while the app is killed. Those items need a real device.

## Install and upgrade

- [ ] **Fresh install (all devices):** the introduction appears once, the app starts on Heute, no
      error, no empty screen that never fills.
- [ ] **Upgrade over the tester build.** Before installing the candidate, on the baseline build:
      create a single appointment and a recurring one with reminders, add and check off items on
      „Nicht vergessen“, bookmark a Rebell\*in and a Wissen entry, subscribe a calendar link, enable
      a curated calendar and a device calendar, and change theme, text size, app icon, animation and
      vibration settings. Then install the candidate over it.
  - [ ] Everything above is still there and still correct.
  - [ ] The reminders still fire.
  - [ ] The introduction does not appear again.

The upgrade check is the one that protects real users: once testers have a build, its database
schema has to keep upgrading cleanly. If the calendar-schema migrations are ever squashed (#32), the
run records explicitly which builds can no longer be upgraded from.

## Accessibility

Run these over the **whole workflow**, not screen by screen. A component that passes in isolation
can fail next to a sheet, a route change or a live region.

The workflow:

1. Complete the introduction.
2. Create an appointment with a reminder and a recurrence.
3. Edit and delete one occurrence of the recurring appointment, and then the whole series (the scope
   dialog).
4. Connect a device calendar, subscribe a calendar link, enable a curated calendar.
5. Open a Rebell\*in and a Wissen entry, add both to Meine Sammlung, and find them there.
6. Add, check, reorder (through the row menu) and delete items on „Nicht vergessen“.
7. Open an Anlaufstelle and use its call and web links.
8. Change every setting once.

- [ ] **VoiceOver** (iOS): the workflow can be completed by swiping alone; names, roles and states
      are right; focus lands where it should after every navigation, sheet and dialog.
- [ ] **TalkBack** (Android): the same, plus sensible grouping.
- [ ] **Voice Control** (iOS): controls respond to their visible label.
- [ ] **Maximum OS text size (all devices):** every page, including the loading skeletons and the
      sheets - no clipping, no overlap, no sideways scrolling, no lost control.
- [ ] **Reduced motion:** the OS setting and the app's own „Animationen“ setting both remove
      non-essential motion, and nothing that carried information disappears with it.
- [ ] **Every colour theme** - Amazone, Sonnenuntergang, Mitternacht, Lavendel: text readable,
      focus visible and not hidden behind the header, the tab bar or an open sheet.
- [ ] **System colour theme (all devices):** with „Farbthema → Systemeinstellung“, switching the
      device to dark mode while the app is open turns it to Mitternacht at once, and back to
      Amazone in light mode. A cold start in dark mode shows no white flash before the app paints.
- [ ] **Tap only:** every action is reachable by a plain tap - nothing needs a long press, a swipe,
      a drag or a double tap.

## Behaviour

- [ ] **Offline cold start (all devices):** flight mode, kill the app, start it - no crash; content,
      own appointments and „Nicht vergessen“ are all there; subscribed calendars show their last
      state honestly instead of an endless spinner or an error wall.
- [ ] **Back online:** subscribed and curated calendars refresh without a restart.
- [ ] **Calendar permission denied** at the first request: the app explains it and keeps working with
      its own calendars.
- [ ] **Calendar permission revoked** in the OS settings while the app is running: no crash on
      return, device calendars disappear or explain themselves.
- [ ] **Notification permission denied:** setting a reminder does not fail silently - the app says
      that reminders cannot arrive.
- [ ] **Exact alarms revoked** (Android 12, API 31-32): reminders still arrive, at worst late.
- [ ] **Reminders (all devices):** a reminder fires with the app in the background, with the app
      killed, and after a device restart; tapping it opens the appointment.
- [ ] **Day rollover:** leave the app open across midnight - Heute, the calendar's today marker and
      the Tagesimpuls move to the new day.
- [ ] **Timezone change:** change the device timezone while the app is open - timed appointments
      move, all-day appointments stay on their day.
- [ ] **All-day device events on Android** are written and read on the right day (#98).
- [ ] **App icon:** Klassisch, Pixel and Nacht can each be selected and show on the home screen.
- [ ] **External links** (Anlaufstellen, licences, image credits, Datenschutz, Impressum) open in the
      browser or the phone app, and the back path into the app works.
- [ ] **Shake** on Heute replays the Tagesimpuls greeting on a real device, and the same replay is
      reachable by tapping.

## Content

- [ ] Every catalog entry renders: walk through „Einstellungen → Entwicklung → Alle Inhalte
      (Debug)“, which every release candidate still has (it is hidden in the release build).
- [ ] Every image loads, and every image has its entry under „Über die App → Bildnachweise“.
- [ ] „Über die App → Open-Source-Lizenzen“ opens offline and is not empty.
- [ ] The gender star survives everywhere: `Rebell*innen`, never `Rebellinnen` or `Rebell innen`.

## Release build specifics

These are checked on the build produced from `main`, after the merge and before it is submitted.

- [ ] „Über die App“ shows the release version (`1.0.0`, not `1.0.0-rc.N`).
- [ ] The „Entwicklung“ section is gone from the settings.
- [ ] The store listing in both consoles matches the repository (see
      [docs/release.md](./release.md)).
