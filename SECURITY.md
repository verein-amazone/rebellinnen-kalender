# Security policy

## Reporting a vulnerability

Report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/verein-amazone/rebellinnen-kalender/security/advisories/new)
for this repository. Please do not open a public issue for a security problem.

Expect an acknowledgement within a week. There is no bug bounty; the project is a small
open-source app built by [Independo GmbH](https://independo.app/) on behalf of
[Verein Amazone](https://www.amazone.or.at/).

## Supported versions

Only the version currently released to the App Store and Google Play receives fixes. Prereleases
distributed through TestFlight and Play internal testing are covered while they are the newest
build.

## Scope

The app has no backend, no user accounts, no login and no analytics or tracking. Nothing leaves the
device unless the user explicitly shares it, so there is no server to attack and no central store of
user data to breach.

What is worth reporting:

- anything that exposes the local SQLite database, its contents, or the user's device calendar data
  to another app, another user of the device, or the network;
- a way to bypass the operating system's calendar permission prompt, or to read calendars the user
  did not grant access to;
- code execution through imported content - the app parses ICS calendar feeds and renders Markdown,
  both of which come from outside;
- a vulnerable dependency that is actually reachable from the app.

What is out of scope:

- findings that require an already compromised or rooted/jailbroken device, or physical access to an
  unlocked device;
- missing hardening that has no exploit path, and automated scanner output without one;
- the deliberate absence of a passcode or biometric lock on the app itself;
- issues in the App Store or Google Play platforms rather than in this app.
