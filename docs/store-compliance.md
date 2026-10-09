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

- `ios/App/App/PrivacyInfo.xcprivacy:5-10` - no tracking, no tracking domains, no collected data
  types.
- `src/app/view/pages/settings/about/about.page.html:8-19` - what the app tells its users.
- The content catalog, the support-service list, the curated-calendar list, the images and the
  licence texts are bundled with the app and read from it (`assetUrl(…)` in
  `src/app/data/content/content-catalog-sync.ts`,
  `src/app/data/gateways/support-service-catalog.gateway.ts`,
  `src/app/data/calendar/curated/curated-calendar-sync.ts`,
  `src/app/data/gateways/legal-content.gateway.ts`).

The only network requests the app makes are calendar downloads:

- **Subscribed calendar links** (ICS/webcal), which the user adds, are fetched directly from the
  address the user entered (`src/app/data/gateways/ics-http.gateway.ts`).
- **Curated calendars** that the user switches on are fetched directly from their provider
  (`public/curated-calendars/catalog.json` - currently Google Calendar for the Amazone calendar and
  wien.gv.at for the Austrian public holidays).

That provider sees the device's IP address, as with any download. This is not collection by the
developer - nothing is sent to Verein Amazone or Independo - but the privacy policy has to say it
(#79).

Device calendars are read and written through the OS calendar on the device; their events are
shown in the app and stored in its local database, and never sent anywhere.

## Apple: App Privacy

App Store Connect → App → App Privacy.

| Question                                                        | Answer                                       | Why                                                                                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app** | See above. Apple defines "collect" as transmitting data off the device in a way that the developer or a partner can access it; on-device processing is not collection. |
| Tracking                                                        | None                                         | `NSPrivacyTracking` is `false` in `PrivacyInfo.xcprivacy`.                                                                                                             |
| Privacy policy URL                                              | See #79                                      | Currently `https://www.amazone.or.at/impressum-datenschutz#datenschutz`; it has to describe the app, not only the website.                                             |

The result is the "Data Not Collected" label.

The calendar permission is not part of this questionnaire. Its purpose string is in
`ios/App/App/Info.plist:48-55` („Die App möchte auf deinen Gerätekalender zugreifen, um seine Termine
zusätzlich anzuzeigen.“), and App Review reads it there.

## Google Play: Data safety

Play Console → App content → Data safety. Applied from
`fastlane/metadata/android/data_safety.csv` by `fastlane android listing`
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

## Google Play: App content

Play Console → App content. Each item blocks the rollout of every track, internal testing
included, until it is answered.

| Declaration                 | Answer                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy              | The URL from #79.                                                                                                                                                     |
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

| Permission                                           | Declared in                                    | Why                                                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERNET`                                           | `android/app/src/main/AndroidManifest.xml:96`  | Downloading subscribed and curated calendars.                                                                                                                                               |
| `READ_CALENDAR`, `WRITE_CALENDAR`                    | `AndroidManifest.xml:97-99`                    | Showing the phone's own calendars next to the app's, and saving an appointment into one of them when the user picks it. Requested only from the explicit „Gerätekalender verbinden“ action. |
| `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` (≤ API 32) | `AndroidManifest.xml:100-109`                  | Appointment reminders on time.                                                                                                                                                              |
| `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`       | `@capacitor/local-notifications`' own manifest | Showing reminders, and re-scheduling them after a restart. Requested only from a tap on the reminders switch.                                                                               |

## Age rating

The app shows editorial content - 52 Rebell\*innen portraits and 22 Wissensimpulse in
`public/content/catalog.json` - and a list of counselling services. All of it is informational
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

The answers live in [`fastlane/metadata/app_store_rating_config.json`](../fastlane/metadata/app_store_rating_config.json)
and are applied by `deliver` together with the store listing - so the console always shows what this
repository says. **All proposed**, to be agreed with Verein Amazone:

| Question                                                  | Answer          | Why                                                                                  |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| Mature or suggestive themes                               | Infrequent/mild | Sexual violence and abuse are named in several biographies, as facts, not described. |
| Medical or treatment information                          | Infrequent/mild | The menstruation entry and the eating-disorder and crisis helplines.                 |
| Health or wellness topics                                 | Yes             | Same entries.                                                                        |
| Realistic violence                                        | None            | Violence is mentioned in biographies, never depicted.                                |
| Alcohol, tobacco or drug use or references                | None            | One passing mention in a podcast recommendation.                                     |
| Sexual content or nudity, graphic or not                  | None            | Education about sexuality and gender identity is not sexual content.                 |
| Profanity, horror, weapons, gambling, contests            | None            | -                                                                                    |
| Unrestricted web access                                   | No              | External links open the system browser; the app has no browser of its own.           |
| User-generated content, messaging, social media           | No              | -                                                                                    |
| Advertising, loot boxes, parental controls, age assurance | No              | -                                                                                    |

Expected result: **13+**. With "Mature or suggestive themes" and "Medical or treatment information"
on None, it would be 4+ - which undersells what the Rebell\*innen biographies talk about.

### Google Play (IARC)

Play Console → App content → Content rating, category **"Reference, News, or Educational"** (the
closest IARC category for a calendar with editorial content; "Utility, Productivity, Communication,
or Other" is the alternative if IARC's reviewers disagree). Answer it with the same reading as above:

- Violence: references to real violence in text only, no depictions.
- Sexuality: no sexual content; educational references to sexuality and gender identity.
- Language, controlled substances, gambling: none.
- Users can interact or exchange content: **no**. Shares location: **no**. Digital purchases:
  **no**.

Record the resulting ratings (PEGI, USK, ESRB, …) here once the questionnaire is submitted.

## Export compliance

- **iOS:** `ITSAppUsesNonExemptEncryption` is `false` (`ios/App/App/Info.plist:39-45`), so App
  Store Connect does not ask on every upload. That is still correct for the shipped dependencies:
  `@capacitor-community/sqlite` links SQLCipher, but the database is opened with `'no-encryption'`
  (`src/app/data/gateways/sqlite.gateway.ts:155`), and the only encryption in use is the OS's
  HTTPS, which is exempt. **If the database is ever encrypted, this answer changes.**
- **Google Play:** there is no equivalent questionnaire. Play leaves export compliance with the
  developer; the same reasoning applies.

## Other console questions

- **Apple, Content Rights:** "Does your app contain, show, or access third-party content?" -
  **Yes**: portrait photos and texts about real people, under the licences documented in
  `public/image-attributions.json`. Answering "and you have the necessary rights" depends on the
  image review in #11.
- **Apple, EU Digital Services Act trader status:** depends on which legal entity holds the Apple
  developer account (Verein Amazone or Independo GmbH). A trader has to publish an address, phone
  number and email in the EU storefronts.
- **Google Play, developer verification:** account-level, not per app.

## What comes from the repository, and what is typed into a console

| Answer                        | Where it is applied                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Apple age rating              | `deliver`, from `fastlane/metadata/app_store_rating_config.json`, with the store listing                  |
| Apple App Privacy             | Typed into App Store Connect from this file - only an Apple ID login can set it, not the API key CI holds |
| Play Data safety              | `fastlane android listing`, from `fastlane/metadata/android/data_safety.csv`                              |
| Play App content, IARC rating | Typed into the Play Console from this file - the Play Developer API cannot set them                       |
| Export compliance (iOS)       | `Info.plist`, with every build                                                                            |
