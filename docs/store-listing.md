# Store listing

The App Store and Play Store listings live in this repository and are written to the stores by the
release from `main` - the same `deliver` and `supply` runs that upload the build (see
[release.md](./release.md)) - and, without a build, by the
[Store listing workflow](#writing-the-listing-without-a-release). Nothing in the listing is typed into a console by hand, except the few
things listed under [What stays in the consoles](#what-stays-in-the-consoles).

## Who owns the copy

The text is community-facing: it describes a feminist calendar app to the people it is for. It is
written **with Verein Amazone, not by the development team alone** - a pull request that changes
store text needs their review before it reaches `main`. German only (`de-DE`), like the app. Write
`Rebell*innen` with its gender star in every field.

The facts in it come from [v1-scope.md](./v1-scope.md); when the scope changes, the description
changes with it.

## Where everything is

```text
apps/app/fastlane/
├── metadata/                                  deliver (App Store)
│   ├── de-DE/
│   │   ├── name.txt                           30
│   │   ├── subtitle.txt                       30
│   │   ├── promotional_text.txt               170, changeable without a new version
│   │   ├── description.txt                    4000
│   │   ├── keywords.txt                       100, comma-separated, no spaces
│   │   ├── support_url.txt
│   │   ├── marketing_url.txt
│   │   └── privacy_url.txt                    see "Privacy policy" below
│   ├── copyright.txt
│   ├── primary_category.txt                   App Store category ids
│   ├── secondary_category.txt
│   ├── review_information/notes.txt           notes for App Review
│   ├── app_store_rating_config.json           age rating, see store-compliance.md
│   └── apps/app/android/
│       ├── data_safety.csv                    Play Data safety answers, see store-compliance.md
│       └── de-DE/                             supply (Play)
│           ├── title.txt                      30
│           ├── short_description.txt          80
│           ├── full_description.txt           4000
│           └── images/
│               ├── icon.png                   512×512, apps/app/scripts/generate-app-icons.mjs
│               ├── featureGraphic.png         1024×500, no alpha, pnpm store:screenshots
│               └── phoneScreenshots/*.png     2-8, pnpm store:screenshots
└── screenshots/de-DE/*.png                    deliver, 1-10 at 1320×2868, pnpm store:screenshots
```

The numbers are each field's limit in characters. `node apps/app/scripts/check-store-listing.mjs` checks all
of them, the image sizes and the hand-written release notes, and CI runs it on every pull request -
so a listing the stores would reject fails the pull request, not the release.

**The Play files have no final newline.** `supply` uploads them byte for byte, so a newline would end
up in the listing; `.editorconfig` keeps editors from adding one, and the check catches it otherwise.

The release notes are not in this tree: they come from `docs/release-notes/<version>.md` (see
[Release notes](./release.md#release-notes)).

## Screenshots and the feature graphic

```bash
pnpm store:screenshots
```

builds the app and renders every screenshot for both stores and the Play feature graphic, with
Playwright, from the production web build (`apps/app/playwright.store.config.ts`,
`apps/app/scripts/store-screenshots/store-screenshots.spec.ts`). It fills the app with German demo data
through the real forms, pins the clock to Sunday 8 March 2026 so the daily impulse and the calendar
are always the same, and writes:

- `apps/app/fastlane/screenshots/de-DE/` - 1320×2868, the 6.9" iPhone size; App Store Connect scales it down
  for every smaller iPhone. The app is iPhone only, so there are no iPad screenshots.
- `apps/app/fastlane/metadata/android/de-DE/images/phoneScreenshots/` - 1080×2160.
- `apps/app/fastlane/metadata/android/de-DE/images/featureGraphic.png` - 1024×500, the app icon and name in
  the bundled fonts.

The PNGs are committed. They are reviewed like any other change, and the release job uploads them
from the tag without needing a browser on the macOS runner. Regenerate them after any visible change
to a screen they show, look at every one, and commit them with that change.

Things to know:

- **They come from the web build.** There is no status bar, and screens that only exist on a phone -
  calendar management, the reminder fields of the appointment form - are not shown.
- **Emoji are drawn by the operating system's emoji font**, so a run on Linux differs from a run on
  macOS. Regenerate them on a Mac, so a diff shows real changes only.
- **Pick content whose images may be shown in a store.** The screenshots show only Rebell\*innen
  whose portraits are in the public domain and Wissensimpulse illustrated by Verein Amazone itself
  (`apps/app/public/content/images.json`). Other portraits carry licences - CC BY-NC-ND, CC BY-SA - that
  do not obviously allow a promotional screenshot.
- The developer tools stay off screen: no screenshot shows the settings overview, which has the
  „Entwicklung“ section in a release candidate.

## Privacy policy and terms of use

The app has its own privacy policy, terms of use (#79) and imprint, because Verein Amazone's
website texts do not describe the app. Each has one source in `packages/legal/src/` - `datenschutz.md`,
`nutzungsbedingungen.md` and `impressum.md` - and reaches readers in two ways:

- **In the app**, under Einstellungen → App & Rechtliches (`PrivacyPage`, `TermsPage`,
  `ImprintPage`), read from the bundled file so it works offline.
- **On the web**, as part of the website (below):
  <https://kalender.amazone.or.at/datenschutz/>,
  <https://kalender.amazone.or.at/nutzungsbedingungen/> and
  <https://kalender.amazone.or.at/impressum/>. The privacy URL is in
  `apps/app/fastlane/metadata/de-DE/privacy_url.txt`, in App Store Connect (App Privacy) and in the Play
  Console (App content → Privacy policy).

The texts are Verein Amazone's: change them with their review, like the store copy, and update the
„Stand“ date. Write the gender star as `\*` (`Rebell\*innen`), or Markdown reads two of them in
one paragraph as emphasis; the renderer drops `mailto:` and `tel:` links, so addresses stay text.
Because the web pages follow `dev`, a change is public as soon as it is merged - land it when it is
true for the version in the stores.

The terms of use do not replace Apple's standard licence agreement (EULA): no custom EULA is set
in App Store Connect, so Apple's applies alongside them. A custom EULA would have to meet Apple's
minimum terms for one.

## Website

`https://kalender.amazone.or.at/` is the app's website: an introduction with the store links,
`/download`, the three legal texts and a 404 page. The domain is a DNS `CNAME` to
`verein-amazone.github.io` that Verein Amazone maintains.

- **Built by** [Astro](https://astro.build/) from `apps/site` (`pnpm build:site`) into
  `apps/site/dist/`. The pages are in `apps/site/src/pages/`, styled with Tailwind on the tokens of
  `@amazone/design-system`; the legal pages render `packages/legal/src/*.md`.
- **The copy** is written in the pages (`apps/site/src/pages/index.astro`, `apps/site/src/lib/site.ts`)
  and follows the store copy in `apps/app/fastlane/metadata/de-DE/` (name, subtitle, promotional
  text, description). A change to one is a reason to look at the other - but on purpose the website
  makes no claim about advertising, which the store description does („ohne Werbung“): Verein Amazone
  asked for it to be left out there, and the e2e suite checks it.
- **Store links** come from `apps/site/site.config.json`. While a listing is not public its URL stays
  `null`, and the site says „Bald verfügbar im App Store …“ instead of showing that badge. Fill in
  the App Store URL (`https://apps.apple.com/at/app/…/id<number>`) and the Play URL
  (`https://play.google.com/store/apps/details?id=at.or.amazone.rebellinnenkalender`) when each
  store goes live.
- **`/download`** is the address for QR codes. On an iPhone or iPad it forwards to the App Store, on
  Android to Google Play; anywhere else, without JavaScript or before release, it shows the store
  buttons it has. Print `https://kalender.amazone.or.at/download` - never a store URL - so the code
  keeps working whatever the stores change.
- **Nothing third-party**: fonts, images and the one script are served from the site itself, there
  are no cookies and no tracking, and a Content-Security-Policy says so. The privacy policy
  (section 9) describes exactly this; keep the two in step.
- **Assets** in `apps/site/public/assets/`, with their provenance in `apps/site/ASSETS.md`: the official German store badges (Apple's badge tool, Google's badge
  page), the EU co-funding emblem and the ProEuropean Values (CERV) logo from
  proeuropeanvalues.at/finanzierung, the default app icon and the store screenshots as WebP
  (`cwebp -q 82 -resize 600 0`). Regenerate the screenshots after `pnpm store:screenshots` changes
  them.
- **Published** by `.github/workflows/pages.yml` on every push to `dev` that touches its sources,
  and **tested** by `pnpm test:site` (axe, no foreign requests, no Content-Security-Policy
  violation, no sideways scroll at 320 px, the `/download` redirect) in the `Website` CI job.

## Availability

Austria only, free. Set in App Store Connect (Pricing and Availability) and on Play's production
track (Countries / regions); neither comes from this repository.

## Changing the listing

1. Change the files, and regenerate the screenshots if the change is visible.
2. Run `node apps/app/scripts/check-store-listing.mjs`.
3. Open a pull request into `dev` and ask Verein Amazone to review the text.
4. The change reaches the stores when it reaches `main`: with the release, or - for a commit that
   does not cut one, such as `docs(store): …` - through the Store listing workflow, which a push to
   `main` that touches `apps/app/fastlane/metadata/` or `apps/app/fastlane/screenshots/` starts by itself.

## Writing the listing without a release

`.github/workflows/store-listing.yml` writes everything above to both stores without building the
app: `bundle exec fastlane ios listing` and `bundle exec fastlane android listing`. It runs

- on a push to `main` that changes the listing, and
- on demand: Actions → Store listing → Run workflow, from `dev` or `main`. This is how the first App
  Store version gets its listing before 1.0.0 is released, and how a failed run is retried. Other
  branches cannot run it: the store environments only serve `dev` and `main`
  ([release.md](./release.md), step 9).

It never runs on a push to `dev`: the Play listing is shared by every track, so it would put text
nobody has reviewed for the public stores into the production listing. A manual run from `dev` does
exactly that on purpose - only do it while the app is not live yet, or with Managed publishing on.

What it writes, and where:

- **App Store** - the text, categories, review notes, screenshots and age rating go to the version
  App Store Connect has in "Prepare for Submission". There must be one: a version that is live or in
  review cannot be edited, and creating the next version is the release's job. Nothing is submitted.
- **Play** - the text, icon, feature graphic and phone screenshots (only the images that changed),
  then the Data safety answers from `data_safety.csv`. supply needs a build on the internal track to
  attach the edit to; every prerelease from `dev` puts one there. The listing goes to review and, with
  Managed publishing on, waits for "Publish".

The Play job shares the `google-play-edits` concurrency group with the Play upload, because a
committed Play edit invalidates every other open one. A third Play job queued behind a pending one
replaces it - re-run the replaced one if it was an upload.

## What stays in the consoles

- **Questionnaires** - Apple App Privacy, Play App content and the IARC rating. No API key can set
  them (fastlane can write App Privacy, but only with an Apple ID login and its two-factor prompt,
  which CI cannot answer); the answers are in [store-compliance.md](./store-compliance.md). Play Data
  safety is the exception and comes from `data_safety.csv`.
- **Contact details** - the App Review contact (name, phone, email) and the Play listing's contact
  email and website. They are personal data and do not belong in a public repository. `deliver`
  updates only the review fields it has a file for, so the console values stay.
- **Play app category and tags**, which `supply` does not manage.
- **Pricing and availability** - free, in all countries the account allows.
