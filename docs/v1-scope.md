# V1 scope and known limitations

What version 1.0.0 of the Rebell\*innen Kalender does, what it deliberately does not do, and what is
known not to work yet. This is the one place for that text: the store descriptions
(`fastlane/metadata/`), the 1.0.0 release notes ([release-notes/1.0.0.md](./release-notes/1.0.0.md))
and the README are written from it.

Being explicit about what V1 leaves out is what keeps feedback from testers useful: a missing
feature that was never planned for V1 is listed below with the issue where it lives, so it does not
have to be reported again.

## What V1 does

- **An everyday calendar** - Heute as the start screen with the next appointments, the day's
  impulse and the „Nicht vergessen“ list; a week and month calendar; appointments with all-day and
  timed starts, recurrences and reminders.
- **Calendars from elsewhere** - the phone's own calendars (read, and write where the OS allows it),
  subscribed calendar links (ICS/webcal), and the curated Amazone and partner calendars, each one
  switchable and colour-coded.
- **Curated content** - Rebell\*innen portraits and Wissensimpulse, a daily impulse on Heute, and
  „Meine Sammlung“ for the entries a person wants to keep.
- **„Nicht vergessen“** - a simple checklist for the things that are not appointments.
- **Anlaufstellen** - support services with direct call and web links.
- **Made to fit** - four colour themes, text size, three app icons, reduced animations and
  vibration, all in the settings; an introduction on first launch.
- **Private by construction** - fully offline after installation, no account, no server, no
  analytics, no tracking, no ads. Everything stays on the phone (see „Über die App → Deine Daten
  bleiben bei dir“).

Platforms: iPhone (iOS 16.4 and later, portrait) and Android phones (Android 7.0, API 24, and
later). The web build is a demo for development and review, not a product.

## What V1 deliberately does not do

| Not in V1                                                                     | Why                                                                                                                                                                          | Where it lives                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Accounts, a server, synchronisation between devices, backups                  | A product constraint, not a gap: the app keeps everything on the device ([PRODUCT.md](../PRODUCT.md)). The consequence is that deleting the app deletes its data.            | -                                                                                          |
| Sharing appointments with others; shared calendars                            | Needs a design that works without a server.                                                                                                                                  | #3, milestones „5) Teilen & gemeinsames Nutzen“ and „6) Nach V1“                           |
| Refreshing subscribed calendars while the app is closed                       | Calendars refresh when the app is opened or comes back to the foreground; a subscription at most every six hours.                                                            | #54                                                                                        |
| Meeting links, attachments and formatted descriptions from imported calendars | Imported events keep title, time, place and plain-text description.                                                                                                          | #56, #62                                                                                   |
| Every possible repetition rule                                                | The form offers every n days, weeks (on chosen weekdays), months (on the same day) or years. A rule such as „every second Tuesday“ from another calendar is shown read-only. | [data-persistence.md](./architecture/data-persistence.md#authoring-recurring-appointments) |
| Reminders for appointments of device calendars through the app                | The phone's own calendar delivers those as its own alerts.                                                                                                                   | [data-persistence.md](./architecture/data-persistence.md#appointment-reminders)            |
| Editing appointments of a device calendar that the OS marks read-only         | The OS owns those calendars.                                                                                                                                                 | -                                                                                          |
| iPad layouts, landscape                                                       | Phone, portrait.                                                                                                                                                             | -                                                                                          |
| Friend lists, chat, automatic location search, automatic news feeds           | Workshop ideas recorded as later expansion paths.                                                                                                                            | [PRODUCT.md](../PRODUCT.md)                                                                |

## Known limitations

Things that are in scope but do not work as they should yet. Every
[pre-release QA run](./qa-checklist.md) adds the findings that will not be fixed before its release
here, each with its issue.

- **Reminders are capped at the next 60.** iOS keeps at most 64 pending notifications per app, so
  the app schedules the next 60 and tops them up on every start. A phone that is not opened for
  weeks while carrying many reminders a day can miss later ones. See
  [data-persistence.md](./architecture/data-persistence.md#appointment-reminders).
- **Android all-day appointments in device calendars** are verified on iOS only; whether they land
  on the right day on Android is still open (#98).
- **The web demo** cannot deliver reminders while the page is closed and cannot reach device
  calendars.
