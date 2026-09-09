# Release process

How a change becomes a build in TestFlight and Play internal testing, and eventually an app in the
stores. Everything described here is automated except the credentials, which cannot live in a public
repository, and the final "publish to testers" action, which stays deliberate.

## The model

| Branch | Version          | Produced by               | iOS        | Android               |
| ------ | ---------------- | ------------------------- | ---------- | --------------------- |
| `dev`  | `1.0.0-rc.N`     | every merged pull request | TestFlight | Play internal testing |
| `main` | `1.0.0`, `1.0.1` | merging `dev` into `main` | App Store  | Play production       |

The `main` half is **not wired yet**. Two things are missing: the "Protect Main" ruleset has a
pull-request rule with no bypass actor, so semantic-release cannot push its release commit there
(#75), and the App Store / Play production lanes do not exist (#72, #73). Until then, `main` is not
part of the pipeline.

## What happens when a pull request is merged into `dev`

1. `.github/workflows/release.yml` runs `semantic-release`.
2. It reads the commit types since the last tag and decides the next version. `feat` bumps the
   minor, `fix` the patch, a `BREAKING CHANGE:` footer the major; `build`, `chore`, `ci`, `refactor`
   and `revert` also produce a patch, so every merge gets a distinct version to hand to testers.
   `docs`, `style` and `test` release nothing.
3. It writes the version into `package.json`, `CHANGELOG.md`,
   `src/app/cross-cutting/infrastructure/app-version.ts` (the „Über die App" screen) and both native
   projects, commits that as `chore(release): <version> [skip ci]`, tags it and publishes a GitHub
   prerelease.
4. `.github/workflows/store-upload.yml` then builds **that tag** and uploads the result to both
   stores, with the release notes attached.

The upload step only runs when the repository variable `STORE_UPLOADS_ENABLED` is `true`. That
switch is how the pipeline stays green before the credentials exist, and how uploads can be stopped
without reverting a workflow file.

### Version and build numbers

Nothing is version-bumped by hand. `scripts/sync-native-version.mjs` derives the store version and
the build number from `package.json`; its header comment documents the encoding, and
`node scripts/sync-native-version.mjs --check` runs in CI so the native fields can never drift.

    1.0.0-rc.4 -> version 1.0.0, build 10000004
    1.0.0      -> version 1.0.0, build 10000999

The `999` suffix marks the build that came from `main` - which is the one to pick in App Store
Connect and the Play console when publishing a real release.

### Release notes

`scripts/build-store-release-notes.mjs` reads the body of the GitHub release the tag carries and
writes it in both store formats: a plain-text "What to Test" for TestFlight and
`fastlane/metadata/android/de-DE/changelogs/<versionCode>.txt` for Play. The Play limit is 500
characters, so a long changelog is cut at a line boundary.

The text is the generated English commit-subject changelog with a German line naming the version.
Hand-written German release notes for the public release are #91 and #74.

## First-time setup

In this order. Steps 1-4 are Apple, 5-8 are Google, 9-11 are GitHub.

### Apple

1. **App Store Connect API key.** Users and Access → Integrations → App Store Connect API → create a
   key with the **App Manager** role. Download the `.p8` immediately; it cannot be downloaded again.
   Note the key ID and the issuer ID.
2. **A private certificates repository.** Create `verein-amazone/certificates`, empty and private.
   `fastlane match` stores the distribution certificate and the App Store provisioning profile there,
   encrypted.
3. **A read-only deploy key** for that repository, so CI can read it and nothing else:

   ```bash
   ssh-keygen -t ed25519 -C 'match@rebellinnen-kalender' -f match_deploy_key -N ''
   ```

   Add `match_deploy_key.pub` to the certificates repository under Settings → Deploy keys, **without**
   write access. The private half becomes the `MATCH_DEPLOY_KEY` secret.

4. **Create the certificate, once, from a laptop.** Pick a strong passphrase and keep it in the
   password manager - it is the `MATCH_PASSWORD` secret and there is no way to recover the
   certificates without it.

   ```bash
   bundle install
   MATCH_PASSWORD='…' bundle exec fastlane match appstore --readonly false
   ```

   `fastlane/Matchfile` sets `readonly(true)` on purpose, so a CI run can never create, renew or
   revoke a certificate. Apple caps distribution certificates per team, and ephemeral runners keep no
   keychain, so a runner allowed to create them would burn through the limit in a few releases.

### Google

5. **Create the Play Console entry** for `at.or.amazone.rebellinnenkalender`. Choose **`de-DE` as the
   default language** - `supply` can only upload a changelog for a locale the listing actually has,
   and the pipeline writes `de-DE`.
6. **Enable Play App Signing**, so Google holds the app signing key and this project only holds the
   upload key. Losing the upload key is then a support request rather than a dead app.
7. **Generate the upload keystore** and back it up outside this repository:

   ```bash
   keytool -genkeypair -v \
     -keystore upload-keystore.jks -storetype JKS \
     -keyalg RSA -keysize 4096 -validity 10000 \
     -alias upload \
     -dname 'CN=Rebellinnen Kalender, O=Verein Amazone, C=AT'
   ```

8. **Play Developer API access.** Create a service account in Google Cloud, download its JSON key,
   then invite the service account's email address in the Play Console under Users and permissions
   with **Release to testing tracks** and **View app information**, restricted to this app.
   Permission changes can take up to 24 hours to take effect.

### GitHub

9. **Two environments**, Settings → Environments, no required reviewers:

   - `testflight`
   - `play-internal`

   Environments with required reviewers for the production tracks come with #75.

10. **The secrets**, in their environment. Binary files go in base64 on a single line
    (`base64 -i <file> | tr -d '\n' | pbcopy` on macOS):

    | Environment     | Secret                            | Value                              |
    | --------------- | --------------------------------- | ---------------------------------- |
    | `testflight`    | `APP_STORE_CONNECT_KEY_ID`        | the key ID from step 1             |
    | `testflight`    | `APP_STORE_CONNECT_ISSUER_ID`     | the issuer ID from step 1          |
    | `testflight`    | `APP_STORE_CONNECT_KEY_P8_BASE64` | the `.p8` file, base64             |
    | `testflight`    | `MATCH_PASSWORD`                  | the passphrase from step 4         |
    | `testflight`    | `MATCH_DEPLOY_KEY`                | the private deploy key from step 3 |
    | `play-internal` | `ANDROID_KEYSTORE_BASE64`         | `upload-keystore.jks`, base64      |
    | `play-internal` | `ANDROID_KEYSTORE_PASSWORD`       | the keystore password from step 7  |
    | `play-internal` | `ANDROID_KEY_ALIAS`               | `upload`                           |
    | `play-internal` | `ANDROID_KEY_PASSWORD`            | the key password from step 7       |
    | `play-internal` | `PLAY_SERVICE_ACCOUNT_JSON`       | the whole service-account JSON     |

11. **The switch.** Settings → Secrets and variables → Actions → Variables: set
    `STORE_UPLOADS_ENABLED` to `true`.

Then merge anything into `dev`, or run the **Store upload** workflow manually against the latest
tag, and watch both jobs.

## Credential inventory and custody

| Credential                     | Lives in                                     | Held by   | Rotation                                                          |
| ------------------------------ | -------------------------------------------- | --------- | ----------------------------------------------------------------- |
| App Store Connect API key      | `testflight` environment + password manager  | Independo | Revoke in App Store Connect, create a new key, replace 3 secrets  |
| Apple Distribution certificate | private certificates repository              | Independo | `fastlane match nuke distribution` then re-create; expires yearly |
| `MATCH_PASSWORD`               | password manager                             | Independo | Only with a full `match nuke` and re-create                       |
| Match deploy key               | `testflight` environment                     | Independo | Delete the deploy key, generate a new pair                        |
| Android upload keystore        | `play-internal` environment + offline backup | Independo | Only via a Play App Signing upload-key reset request              |
| Play service account JSON      | `play-internal` environment                  | Independo | Delete the key in Google Cloud, create a new one                  |

Everything above is currently held by one organisation and, in practice, by one person. That is the
real risk in this list, larger than any single credential: **a second maintainer at Verein Amazone
should hold the password-manager entries**, so a release does not depend on one laptop. The keystore
backup in particular must exist somewhere that is neither this repository nor that laptop.

No key material is ever committed. `.gitignore` and `android/.gitignore` reject `*.p8`, `*.p12`,
`*.jks`, `*.keystore`, `*.mobileprovision` and `play-service-account*.json` outright.

## Publishing to testers

The pipeline uploads; it never distributes. That is deliberate - it means a bad build can be thrown
away without anyone having installed it.

**TestFlight.** The build appears under the version with its "What to Test" text filled in. Add it
to the internal testing group to send it to Verein Amazone.

**Play internal testing.** The bundle appears as a **draft** release on the internal track with the
German changelog. Open it and roll it out.

Play refuses to roll out any release, internal testing included, until the "App content"
declarations are complete - privacy policy, data safety, content rating, target audience. Those are
#78 and #79. The upload itself works before they are answered; only the rollout waits.

## When an upload fails

The release has already happened by the time an upload runs, so a failed upload leaves the tag and
the GitHub release behind. That is the lesser evil: unpublishing a release is worse than a
prerelease that never reached a tester.

- **The build never uploaded** (signing, credentials, a Gradle or Xcode failure): fix the cause and
  re-run the **Store upload** workflow manually with the same tag. Actions → Store upload → Run
  workflow → enter `v1.0.0-rc.N`.
- **The build uploaded and something after it failed**: do not re-run. Both stores reject a build
  number that has been used, permanently. Push an empty commit to cut the next `rc`, which gets a
  fresh build number:

  ```bash
  git commit --allow-empty -m 'fix: retry the release upload'
  ```

- **Only one of the two platforms failed**: the manual re-run does both. For the platform that
  already succeeded the upload will fail on the duplicate build number, which is noisy but harmless;
  read the other job's result.

## Hotfixing a released version

Not yet applicable - nothing has been released from `main`. Once it has: branch from `main`, land
the fix there with a `fix:` commit so it releases as a patch, then merge `main` back into `dev` so
the fix is not lost on the next prerelease.

## When a store rejects a build

**Apple.** Rejections arrive in App Store Connect and by email. Fix the cause on `dev`, which
produces a new `rc` and a new build; there is no way to re-submit the same build number. A rejection
of the TestFlight _beta review_ only affects external testers - internal testers keep the build.

**Google.** Play reports rejections against the release, not the bundle. A rejected internal-testing
release can be replaced by uploading the next bundle; a rejected production release usually needs
the "App content" answers corrected first.

Record what the rejection was and what fixed it in the issue it came from, so the next release does
not rediscover it.

## Repository settings that are not in version control

These exist only in the GitHub UI, which is why they are listed here (see #75):

- **Rulesets.** "Protect Default" (`~DEFAULT_BRANCH`, currently `dev`) and "Protect Main"
  (`refs/heads/main`), both with `deletion` and `non_fast_forward`; "Protect Main" additionally
  requires a pull request. Neither requires a status check yet, so `ci-success` - the aggregate
  check `.github/workflows/ci.yml` exists to provide - is not enforced anywhere.
- **The release workflow needs a bypass.** It pushes the release commit straight to the branch. That
  works on `dev` today and fails on `main`.
- **Environments and secrets** as listed above.
- **`STORE_UPLOADS_ENABLED`**, the variable that gates the uploads.

## What is not automated yet

- The `main` → App Store / Play production lanes (#72, #73) and the environments with required
  reviewers that should guard them (#75).
- Store listing metadata and screenshots (#74) - descriptions, keywords, screenshots and the Play
  feature graphic are still typed into the consoles by hand. Only the release notes come from the
  repository.
- The iOS privacy manifest (#77) and the store questionnaires (#78).
