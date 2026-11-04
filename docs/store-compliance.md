# Store compliance answers

The answers to the questionnaires that App Store Connect and the Play Console ask before an app can
be released. They have nothing to do with the build, they block the release until they are
answered, and they are easy to get subtly wrong when they are re-derived from memory - so they are
recorded here, with the evidence each one rests on.

**When the app changes, this file changes with it.** A new permission, a new plugin, a network
request to a new place, or new content that touches the age rating means re-reading the matching
section below and updating the console to match.

Status: the answers marked **proposed** still need agreement with Verein Amazone before they are
entered. Everything else follows directly from the code.

## The one fact everything rests on

The app collects no data. There is no account, no server of its own, no analytics, no crash
reporting, no advertising and no tracking. Appointments, reminders, the „Nicht vergessen“ list,
bookmarks and settings live in a SQLite database and in local storage on the device and never leave
it. Deleting the app deletes them.

Evidence:

- `apps/app/ios/App/App/PrivacyInfo.xcprivacy:5-10` - no tracking, no tracking domains, no collected data
  types.
- `apps/app/src/app/view/pages/settings/about/about.page.html:8-19` - what the app tells its users.
- The content catalog, the support-service list, the curated-calendar list, the images and the
  licence texts are bundled with the app and read from it (`assetUrl(…)` in
  `apps/app/src/app/data/content/content-catalog-sync.ts`,
  `apps/app/src/app/data/gateways/support-service-catalog.gateway.ts`,
  `apps/app/src/app/data/calendar/curated/curated-calendar-sync.ts`,
  `apps/app/src/app/data/gateways/legal-content.gateway.ts`).

The app makes network requests to two kinds of places: calendar downloads, and a content item's video
once the user plays it.

- **Subscribed calendar links** (ICS/webcal), which the user adds, are fetched directly from the
  address the user entered (`apps/app/src/app/data/gateways/ics-http.gateway.ts`).
- **Curated calendars** that the user switches on are fetched directly from their provider
  (`apps/app/public/curated-calendars/catalog.json` - currently Google Calendar for the Amazone calendar and
  wien.gv.at for the Austrian public holidays).

- **A content item's YouTube video**, only after the user taps „Video abspielen“. The info button
  under the video says data goes to Google. On Android and iOS a native player view
  (`@capawesome/capacitor-youtube-player`, wrapped by
  `apps/app/src/app/cross-cutting/infrastructure/native-video-player.ts`) loads YouTube's player -
  from youtube-nocookie.com (privacy-enhanced mode), as the browser build frames it. Until the tap
  the cover is the item's own bundled picture, and nothing reaches YouTube. Privacy policy §6.2.

That provider sees the device's IP address, as with any download. This is not collection by the
developer - nothing is sent to Verein Amazone or Independo - but the privacy policy has to say it
(#79).

Device calendars are read and written through the OS calendar on the device; their events are
shown in the app and stored in its local database, and never sent anywhere.

## Apple: App Privacy

App Store Connect → App → App Privacy.

| Question                                                        | Answer                                           | Why                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app**     | See above. Apple defines "collect" as transmitting data off the device in a way that the developer or a partner can access it; on-device processing is not collection. |
| Tracking                                                        | None                                             | `NSPrivacyTracking` is `false` in `PrivacyInfo.xcprivacy`.                                                                                                             |
| Privacy policy URL                                              | `https://rebellinnen.amazone.or.at/datenschutz/` | The app's own policy, see [store-listing.md](./store-listing.md#privacy-policy).                                                                                       |

The result is the "Data Not Collected" label.

**Proposed - to decide with Verein Amazone before the release that ships videos:** whether the
YouTube player changes this answer. The player is a third-party library inside the app, and once
the user plays a video Google receives the IP address and device information and may set cookies -
data neither Verein Amazone nor Independo can access, but Google, arguably a "third-party partner",
can. The cautious reading declares it ("Data Linked to You": none; "Data Not Linked to You":
Identifiers / Usage Data, purpose "App Functionality", collected by a third party); the narrow
reading keeps "Data Not Collected" because the user opens the video from a third-party service on
their own initiative, like an external link. Neither is entered yet.

The calendar permission is not part of this questionnaire. Its purpose string is in
`apps/app/ios/App/App/Info.plist:48-55` („Die App möchte auf deinen Gerätekalender zugreifen, um seine Termine
zusätzlich anzuzeigen.“), and App Review reads it there.

## Google Play: Data safety

Play Console → App content → Data safety. Applied from
`apps/app/fastlane/metadata/android/data_safety.csv` by `fastlane android listing`
([store-listing.md](./store-listing.md#writing-the-listing-without-a-release)), through the Play
Developer API. The file uses the console's CSV import format: an app that collects nothing answers
the top question `PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA` with `FALSE`, and no other question is
asked. If Play ever rejects the file, export the current template from the console (Data safety →
Export to CSV), set the same answers and commit it in its place.

| Question                                                              | Answer    | Why                                                                                                                                |
| --------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types?   | **No**    | Google counts data as collected only when it is transmitted off the device. Calendar events read from the phone stay on the phone. |
| Is all of the user data collected by your app encrypted in transit?   | Not asked | Only asked when data is collected.                                                                                                 |
| Do you provide a way for users to request that their data is deleted? | Not asked | Only asked when data is collected. Uninstalling the app deletes everything.                                                        |

The resulting section says "No data collected" and "No data shared with third parties".

**Proposed:** the same open question as for Apple. Play counts data collected by third-party
libraries in the app, and the YouTube player is one (`android-youtube-player`, through the plugin).
If Verein Amazone takes the cautious reading, the CSV needs the collected types (device or other
IDs, app interactions) marked as collected for "App functionality", processed ephemerally, not
shared, and optional ("users can choose": a video only loads when tapped).

## Google Play: App content

Play Console → App content. Each item blocks the rollout of every track, internal testing
included, until it is answered.

| Declaration                 | Answer                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy              | `https://rebellinnen.amazone.or.at/datenschutz/`                                                                                                                      |
| App access                  | All functionality is available without special access - there is no login.                                                                                            |
| Ads                         | No, the app contains no ads.                                                                                                                                          |
| Content rating              | See [Age rating](#age-rating).                                                                                                                                        |
| Target audience and content | **Proposed:** 13-15, 16-17 and 18 and over. Not designed for children under 13, so the Families policy does not apply. The app is not a "Teacher Approved" candidate. |
| News app                    | No.                                                                                                                                                                   |
| Health apps                 | No - the app is a calendar. It links to counselling services and carries editorial content about health topics, but offers no health features.                        |
| Financial features          | None.                                                                                                                                                                 |
| Government app              | No.                                                                                                                                                                   |
| Data safety                 | See above.                                                                                                                                                            |
| Exact alarm permission      | **Calendar app:** the app schedules reminders for appointments the user created, at the time the user chose (`USE_EXACT_ALARM`).                                      |

### Permissions

Play asks for a justification only for permissions on its restricted list. Of the app's permissions,
only the exact alarm is one (above). The rest are recorded here so the answer is ready if a
reviewer asks:

| Permission                                           | Declared in                                            | Why                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERNET`                                           | `apps/app/android/app/src/main/AndroidManifest.xml:98` | Downloading subscribed and curated calendars.                                                                                                                                                     |
| `READ_CALENDAR`, `WRITE_CALENDAR`                    | `AndroidManifest.xml:99-101`                           | Showing the phone's own calendars next to the app's, and saving an appointment into one of them when the user picks it. Requested only from the explicit „Verbinden“ action under Gerätekalender. |
| `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` (≤ API 32) | `AndroidManifest.xml:102-111`                          | Appointment reminders on time.                                                                                                                                                                    |
| `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`       | `@capacitor/local-notifications`' own manifest         | Showing reminders, and re-scheduling them after a restart. Requested only from a tap on the reminders switch.                                                                                     |
| `WAKE_LOCK`                                          | `@capacitor/local-notifications`' own manifest         | Delivering a reminder while the phone sleeps. Granted at install, never asked for.                                                                                                                |
| `VIBRATE`                                            | `@capawesome/capacitor-haptics`' own manifest          | Haptic feedback on taps, which the user can switch off under Einstellungen → Vibration. Granted at install, never asked for.                                                                      |

`USE_BIOMETRIC` and `USE_FINGERPRINT` would arrive through `@capacitor-community/sqlite`, which
depends on `androidx.biometric` for an optional biometric database lock the app does not use.
`AndroidManifest.xml:112-116` removes both from the merged manifest, so they are not on the Play
listing. Check the merged manifest
(`apps/app/android/app/build/intermediates/merged_manifest/*/process*MainManifest/AndroidManifest.xml`) after a
plugin update for permissions that arrive the same way.

**If Play rejects the exact alarm declaration**, the fallback is to drop `USE_EXACT_ALARM` and keep
`SCHEDULE_EXACT_ALARM` without its `maxSdkVersion`: Android 13+ then denies exact alarms by default,
and `cross-cutting/infrastructure/notifications.ts` already falls back to inexact delivery, so
reminders arrive up to a few minutes late instead of not at all.

## Age rating

The app shows editorial content - 52 Rebell\*innen portraits and 22 Wissensimpulse in
`apps/app/public/content/catalog.json` - and a list of counselling services. All of it is informational
text and portrait photos. Nothing is depicted, nothing is user-generated, and there is no chat.

What in that content can matter for a rating:

- **Sexual violence and abuse, as references in biographies:** Gisèle Pelicot (reb-06), Simone Biles
  (reb-16), Ninia „LaGrande“ Binias (reb-52), Li Maizi (reb-15).
- **Political violence, war and flight:** Meena Keshwar Kamal (reb-05, murdered), Malala Yousafzai
  (reb-26, Taliban attack), Yusra Mardini (reb-42), Marjane Satrapi (reb-45), X González (reb-44,
  gun violence).
- **Sexuality and gender identity** as education and representation: Pride Month (wi-16), „Ein
  Regenbogen für alle!“ (wi-17), several portraits.
- **Health topics:** menstruation and the cycle (wi-01), mental health (wi-03, reb-18), and the
  Anlaufstellen - helplines for children and young people, crisis support, violence against women,
  eating disorders.
- **Drugs**, mentioned once in a podcast recommendation (wi-12).

### Apple

The answers live in [`apps/app/fastlane/metadata/app_store_rating_config.json`](../apps/app/fastlane/metadata/app_store_rating_config.json)
and are applied by `deliver` together with the store listing - so the console always shows what this
repository says. Agreed with Verein Amazone for 1.0.0, revised on their request of 4 November 2026:

| Question                                                  | Answer          | Why                                                                                             |
| --------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| Mature or suggestive themes                               | None            | Sexual violence and abuse are named in several biographies, as facts, not described. See below. |
| Medical or treatment information                          | Infrequent/mild | The menstruation entry and the eating-disorder and crisis helplines.                            |
| Health or wellness topics                                 | Yes             | Same entries.                                                                                   |
| Realistic violence                                        | None            | Violence is mentioned in biographies, never depicted. **Re-check with the videos.**             |
| Alcohol, tobacco or drug use or references                | None            | One passing mention in a podcast recommendation.                                                |
| Sexual content or nudity, graphic or not                  | None            | Education about sexuality and gender identity is not sexual content.                            |
| Profanity, horror, weapons, gambling, contests            | None            | -                                                                                               |
| Unrestricted web access                                   | No              | External links open the system browser; the app has no browser of its own.                      |
| User-generated content, messaging, social media           | No              | -                                                                                               |
| Advertising, loot boxes, parental controls, age assurance | No              | -                                                                                               |

"Mature or suggestive themes" was "Infrequent/mild" up to 1.0.0, which gave 13+. The German App
Store shows that answer as „Szenen mit erotischen Anspielungen“, and the app has no erotic content,
so Verein Amazone asked for it to go (4 November 2026). The biographies name abuse as a fact and
never describe it, so None is a fair answer. App Store Connect shows the resulting rating after the
next `deliver`; record it here. The change reaches the store page with the next submitted version.

### Google Play (IARC)

Play Console → App content → Content rating. Resubmitted on 4 November 2026 (category **"All Other
App Types"**, as before) with these answers:

- Violence: references to violence against humans in a realistic setting, referred to only, no
  blood. No war setting, no dark overtones.
- Sexuality: **references to sexual violence, referred to only** - the biographies. Not
  "Suggestive/Sexual Themes or References": that answer, given on 20 September 2026, produced PEGI 12
  with the descriptor „Sexuelle Anspielung“, which Verein Amazone rightly objected to.
- Controlled substances: a reference to illegal drugs (the warning about K.O.-Tropfen in wi-73).
- Fear, gambling, language, crude humour: none.
- Users can interact or exchange content: **no**. Shares location: **no**. Digital purchases:
  **no**. Primarily news or educational: **no**.
- Online content: **yes** - the YouTube videos. They refer to violence (the STOPiT clips) but do not
  show it; no sexual material, offensive language or drugs.

Ratings shown before submitting: **PEGI 3** without descriptors (Austria), USK 16 ("Contents for
Different Age Groups"), ESRB Teen (Violent References, Sexual
Themes, Drug Reference), ClassInd 14, IARC generic 3+. Managed publishing is on, so the change went
to Google for review and must then be published from the Publishing overview. Re-answer the
questionnaire when new content touches any of these points, in particular a video that shows
violence.

## Export compliance

- **iOS:** `ITSAppUsesNonExemptEncryption` is `false` (`apps/app/ios/App/App/Info.plist:39-45`), so App
  Store Connect does not ask on every upload. That is still correct for the shipped dependencies:
  `@capacitor-community/sqlite` links SQLCipher, but the database is opened with `'no-encryption'`
  (`apps/app/src/app/data/gateways/sqlite.gateway.ts:155`), and the only encryption in use is the OS's
  HTTPS, which is exempt. **If the database is ever encrypted, this answer changes.**
- **Google Play:** there is no equivalent questionnaire. Play leaves export compliance with the
  developer; the same reasoning applies.

## Other console questions

- **Apple, Content Rights:** "Does your app contain, show, or access third-party content?" -
  **Yes**: portrait photos and texts about real people, under the licences documented in
  `apps/app/public/content/images.json`, and Verein Amazone's own videos, played from YouTube.
  Answering "and you have the necessary rights" depends on the image review in #11.
- **Apple, EU Digital Services Act trader status:** depends on which legal entity holds the Apple
  developer account (Verein Amazone or Independo GmbH). A trader has to publish an address, phone
  number and email in the EU storefronts.
- **Google Play, developer verification:** account-level, not per app.

## What comes from the repository, and what is typed into a console

| Answer                        | Where it is applied                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Apple age rating              | `deliver`, from `apps/app/fastlane/metadata/app_store_rating_config.json`, with the store listing         |
| Apple App Privacy             | Typed into App Store Connect from this file - only an Apple ID login can set it, not the API key CI holds |
| Play Data safety              | `fastlane android listing`, from `apps/app/fastlane/metadata/android/data_safety.csv`                     |
| Play App content, IARC rating | Typed into the Play Console from this file - the Play Developer API cannot set them                       |
| Export compliance (iOS)       | `Info.plist`, with every build                                                                            |
