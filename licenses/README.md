# Third-party licences

The app shows the licences of everything it ships under Einstellungen → Lizenzen & Impressum →
Open-Source-Lizenzen (#11). That screen reads `3rdpartylicenses.txt` from the bundled app, which is
put together after every production build from two sources:

| Source                                     | Covers                                                                                                               | Made by                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Angular's `extractLicenses` (angular.json) | The npm packages whose JavaScript is bundled, including every Capacitor plugin and its native code                   | `ng build`, on every production build                    |
| `additional-third-party-licenses.txt`      | The Android and iOS libraries, the Capacitor Android runtime, npm files copied as assets, the fonts and NOTICE files | `node scripts/build-third-party-licenses.mjs`, committed |

`scripts/copy-third-party-licenses.mjs`, the `postbuild` step, appends the second file to the first
and checks every licence in the result against [`policy.json`](./policy.json). A licence the policy
does not allow fails the build.

## The policy

`policy.json` is the one allowlist for npm, Android and iOS. The Android build reads it too: the
Licensee Gradle plugin (`android/app/build.gradle`) fails on an Android library outside it.

- **`allowed`** - SPDX identifiers that may ship without anyone asking. Only permissive licences
  belong here. An SPDX expression passes when it can be satisfied with these: `MIT OR GPL-3.0`
  passes, `MIT AND GPL-3.0` does not.
- **`approved`** - one package under a licence that is not allowed in general, with the reason it is
  fine for this one. Copyleft licences (GPL, LGPL, AGPL, MPL, EPL, CC BY-SA for code) and anything
  non-commercial or unknown need a decision from Verein Amazone and Independo before they go here.
- **`overrides`** - licence data for a library whose own metadata is missing or wrong: an SPDX
  identifier, a licence text or a NOTICE file. Android libraries are keyed `group:artifact`, Swift
  packages by their identity in `Package.resolved`.
- **`components`** - things no manifest describes: the fonts, and code compiled into another
  library's binary.

The texts that `overrides` and `components` point to live in [`texts/`](./texts). Each entry says
where its text comes from.

## When CI fails

- **"… is not allowed"** (production build) - a new or updated dependency has a licence outside the
  policy. Replace the dependency, or get the licence approved and add it to `approved`.
- **"… does not match the dependencies"** (Android job) - a dependency change altered the list.
  Regenerate it and commit the result:

  ```bash
  JAVA_HOME=$(/usr/libexec/java_home -v 21) node scripts/build-third-party-licenses.mjs
  ```

  The script runs Gradle (JDK 21) and reads the Swift packages' licences from the GitHub API. The
  weekly dependency update does this by itself.

- **"… names no SPDX licence"** or **"… ships no licence file"** - look the licence up at the
  library's source and add an override.

## What this does not cover

Images and other media have their own licences, recorded in `public/image-attributions.json` and
shown on the Bildnachweise screen. Editorial content is not covered by either file.
