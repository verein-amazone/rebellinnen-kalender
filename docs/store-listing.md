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
fastlane/
├── metadata/                                  deliver (App Store)
│   ├── de-DE/
│   │   ├── name.txt                           30
│   │   ├── subtitle.txt                       30
│   │   ├── promotional_text.txt               170, changeable without a new version
│   │   ├── description.txt                    4000
│   │   ├── keywords.txt                       100, comma-separated, no spaces
│   │   ├── support_url.txt
│   │   ├── marketing_url.txt
│   │   └── privacy_url.txt                    see #79
│   ├── copyright.txt
│   ├── primary_category.txt                   App Store category ids
│   ├── secondary_category.txt
│   ├── review_information/notes.txt           notes for App Review
│   ├── app_store_rating_config.json           age rating, see store-compliance.md
│   └── android/
│       ├── data_safety.csv                    Play Data safety answers, see store-compliance.md
│       └── de-DE/                             supply (Play)
│           ├── title.txt                      30
│           ├── short_description.txt          80
│           ├── full_description.txt           4000
│           └── images/
│               ├── icon.png                   512×512, scripts/generate-app-icons.mjs
│               ├── featureGraphic.png         1024×500, no alpha, pnpm store:screenshots
│               └── phoneScreenshots/*.png     2-8, pnpm store:screenshots
└── screenshots/de-DE/*.png                    deliver, 1-10 at 1320×2868, pnpm store:screenshots
```

The numbers are each field's limit in characters. `node scripts/check-store-listing.mjs` checks all
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
Playwright, from the production web build (`playwright.store.config.ts`,
`scripts/store-screenshots/store-screenshots.spec.ts`). It fills the app with German demo data
through the real forms, pins the clock to Sunday 8 March 2026 so the daily impulse and the calendar
are always the same, and writes:

- `fastlane/screenshots/de-DE/` - 1320×2868, the 6.9" iPhone size; App Store Connect scales it down
  for every smaller iPhone. The app is iPhone only, so there are no iPad screenshots.
- `fastlane/metadata/android/de-DE/images/phoneScreenshots/` - 1080×2160.
- `fastlane/metadata/android/de-DE/images/featureGraphic.png` - 1024×500, the app icon and name in
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
  (`public/image-attributions.json`). Other portraits carry licences - CC BY-NC-ND, CC BY-SA - that
  do not obviously allow a promotional screenshot.
- The developer tools stay off screen: no screenshot shows the settings overview, which has the
  „Entwicklung“ section in a release candidate.

## Changing the listing

1. Change the files, and regenerate the screenshots if the change is visible.
2. Run `node scripts/check-store-listing.mjs`.
3. Open a pull request into `dev` and ask Verein Amazone to review the text.
4. The change reaches the stores when it reaches `main`: with the release, or - for a commit that
   does not cut one, such as `docs(store): …` - through the Store listing workflow, which a push to
   `main` that touches `fastlane/metadata/` or `fastlane/screenshots/` starts by itself.

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
