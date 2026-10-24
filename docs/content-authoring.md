# Adding curated content (Wissensimpulse & Rebell\*innen)

How to add or edit a "Wissen" or "Rebell\*innen" item - the two content types, by the names the app
shows for them (`CONTENT_KIND_LABELS`) - the content shown on the Today page and under `/content`.
Covers the full pipeline: catalog entry, image conversion, and the image's entry in the image catalog
(description, creator, source and licence).

Related code: `apps/app/src/app/data/content/content-catalog-sync.ts` (reconciles the catalog into the
`content_items` table at runtime), `apps/app/public/content/README.md` (asset directory notes),
[issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11) (licensing rules this
guide implements).

## 1. Add the catalog entry

`apps/app/public/content/catalog.json` is the single source of truth for content. It is **not** seeded by a
database migration - `ContentCatalogSync` reconciles it into `content_items` lazily, on first read,
by diffing against the stored `version`. So:

1. Add a new object to `items`, or edit an existing one.
2. **Bump the top-level `version` field.** The sync only does its diff-and-write work when the
   stored version is stale - skip this and your change silently never reaches the database, even
   after a rebuild. (This bit us once already: a `wi-12` link edit went live in the file but never
   rendered, because `version` was untouched.) The app reads the file once per session, so reload
   it to see an edit under `ng serve`.

Fields per entry:

| Field                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | `wi-NN` or `reb-NN`, next free number in that series.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `kind`                     | `'wissensimpulse'` or `'rebellin'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `title`, `teaser`          | Plain text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `heroImageId`              | The `id` of the item's picture in `apps/app/public/content/images.json` (§4). Every item ships one: the Today page leads with it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `bodyMarkdown`             | See §3 for markdown conventions (blockquotes, links).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `sourceLabel`, `sourceUrl` | Optional "Quelle" link shown under the body (e.g. a linked article/app).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `relatedSources`           | Optional array of `{ title, subtitle?, url }` "Mehr zum Thema" links, shown together in one card below the body, each opening outside the app. `title` and `url` (https) are required, `subtitle` is an optional second line such as the publisher or platform. A link to Instagram, YouTube, TikTok, Spotify, LinkedIn or Snapchat gets a matching symbol instead of the external-link icon (`link-platform.ts` next to the detail page) - omit the field entirely when there are none. **Only ever link what Amazone supplied with the entry**; never research a link (a Wikipedia article, say) and add it yourself - the app then vouches for a page nobody in the editorial team chose. |
| `validFrom`, `validTo`     | The window the item may be featured in, both `null` for evergreen content. `--MM-DD` for a window that recurs every year (`"--05-17"` for IDAHOBIT, `"--06-01"`…`"--06-30"` for June; a window may wrap the turn of the year, `"--12-20"`…`"--01-06"`). `YYYY-MM-DD` only for a date that belongs to one year - a deadline, or a day that moves (Safer Internet Day is the second Tuesday of February). Both bounds use the same form; `content-catalog.content.spec.ts` fails otherwise.                                                                                                                                                                                                    |
| `video`                    | Optional `{ "provider": "youtube", "id": "<11-character id>", "orientation": "landscape" \| "portrait" }`. A YouTube Short is `portrait`. The id is the part after `watch?v=`, `youtu.be/` or `shorts/` - without `si=`, `t=` or other parameters. The item's picture becomes the video's cover, so pick a still from the video. Only YouTube: a Vimeo link goes into `relatedSources` if it has no YouTube twin. See §5 for what the app does with it.                                                                                                                                                                                                                                      |
| `supportServiceIds`        | Optional, chosen by hand: the Anlaufstellen the item points to. Omit it (or `null`) for none, `[]` for the Anlaufstellen page as a whole - when the text says „Anlaufstellen findest du hier in der App“ - or the `id`s of named entries from `support-services/catalog.json` when the text names a service that is listed there. Each named entry opens on its own card. The spec fails on an id the Anlaufstellen catalog does not have.                                                                                                                                                                                                                                                   |
| `eligibleForDaily`         | Whether this item can be picked as the Today page's featured item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

An entry names its picture by `heroImageId` and nothing else. The file, its description and its
attribution belong to the image, and are recorded with it in `apps/app/public/content/images.json` (§4), so
one image could serve several items without anything being written twice.

## 2. Convert and place the image

This section covers turning a delivered file into the asset the app ships. For what to ask a
contributor or partner organisation to deliver in the first place - aspect ratio, minimum
resolution, and the description/credit/rights notes that must come with it - see
[content-images.md](./content-images.md).

Images ship as WebP to keep the app bundle small. This machine's Homebrew `ffmpeg` build has no
`libwebp` support (`ffmpeg -encoders | grep webp` returns nothing), so conversion is two steps:
resize with `ffmpeg` into a temporary PNG, then encode to WebP with the separate `cwebp` tool
(Homebrew formula `webp`, install with `brew install webp` if `which cwebp` comes up empty).

```bash
# 1. Resize (cap the long edge at 1280px, keep aspect ratio, even dimensions for the encoder)
ffmpeg -i source-photo.jpg -vf "scale='min(1280,iw)':-2" /tmp/resized.png

# 2. Encode to WebP
cwebp -q 75 /tmp/resized.png -o apps/app/public/content/images/rosa-parks.webp
```

Every image lives in `apps/app/public/content/images/`, named `<image id>.webp`: the image's id (§4) is the
file name, which is how the app finds the file (`imagePathFor()` in `image-catalog.gateway.ts`). Pick
a short slug - lower case, words joined by hyphens, umlauts written out (`ae`, `oe`, `ue`, `ss`) -
that names what the picture shows, usually the person or the topic.

## 3. Markdown conventions

`bodyMarkdown` renders through `MarkdownContentComponent` (`cross-cutting/markdown/`), which allows
paragraphs, lists, headings, links and blockquotes - see `apps/app/src/styles/components/markdown-content.css`
for how each renders.

- **A Rebell\*in's own quoted words**, transcribed as their own standalone paragraph, should be a
  markdown blockquote (`> ...`), not quotation marks in running text - it renders visually distinct
  (bordered, larger, semibold) rather than relying on the quote marks alone. Only convert a
  standalone quoted paragraph; leave quoted terms inside running prose (e.g. a nickname like „Godmother
  of Punk“) as plain text.
- Links (`[text](url)`) render as underlined inline links; no other markup needed.
- Never import `marked` outside `cross-cutting/markdown/` - always go through
  `MarkdownContentComponent`, per the frontend architecture rules.

## 4. Record the image in `images.json`

Per [issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11): **an image only
belongs in the repo once its rights are actually clarified.** Don't add an image on the assumption
that licensing will be sorted out later - resolve it first, or don't commit the image yet.

Add one entry to `apps/app/public/content/images.json`, the image catalog. It is everything the app says
about an image: the content screens take the picture's file, description and credit line from it,
and Settings → Lizenzen & Impressum → Bildnachweise lists it with its full attribution.

```json
{
  "id": "rosa-parks",
  "title": "Person or item title",
  "alt": "Schwarzweißfoto: eine Frau mit kurzen Haaren spricht in ein Mikrofon.",
  "creator": "Photographer or illustrator name",
  "sourceUrl": "https://commons.wikimedia.org/wiki/File:Exact_File_Name.jpg",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "changes": ["cropped", "resized", "converted to WebP"]
}
```

`alt` is **required**: a German description of what the picture shows, for people who cannot see
it. Describe the picture, never the credit, and include any text that is part of the image.
`images.content.spec.ts` fails when it is missing.

There is no credit line to write: the app builds it. Under the picture on the detail screen it shows
`Bild: <creator>, <license>`; Bildnachweise shows everything - creator, licence with its link, source
and changes. Leave `creator` out when it is genuinely unknown (the screens then say so) rather than
writing "Unknown".

Write the licence as Creative Commons writes it - `CC BY-SA 4.0`, `CC BY-SA 3.0 DE`, `CC0 1.0` - or
`Public Domain`, and link its canonical deed without a language suffix. The accepted names and their
links are the `LICENSES` table in `apps/app/src/app/data/content/images.content.spec.ts`; a new
licence goes there first. That spec also fails when an image under `apps/app/public/` has no entry, or two,
and when an entry is not the picture of any item.
`Alle Rechte vorbehalten` (no link) is for an image used without an open licence by a decision of
Verein Amazone, crediting the rightsholder; so far only `johanna-dohnal` (Parlamentsdirektion, #11)
is.
The app's own icons (`apps/app/public/app-icons/`) are the only exception.

Notes from doing this for the first 41 items:

- **Find the exact source file, don't guess.** For a Wikimedia Commons photo, search Commons for
  the subject, open the candidate file page, and confirm the **creator and licence identifier
  match** what you were told before using its `sourceUrl` - several near-duplicate photos of the
  same person, by different photographers under different licences, commonly exist side by side.
  Use `sourceUrl` (a real file page you found and checked), never a fabricated or guessed URL.
- If there's no clean `sourceUrl` (e.g. own/commissioned Verein Amazone content), use `source`
  (free text) instead, and add `permissionRef` once a real usage-grant reference exists - omit it
  rather than inventing one.
- For public-domain images, add `publicDomainBasis` explaining why (e.g. "US government work",
  "author's life + 100 years expired").
- Use `changes` to list every transformation actually applied - `cropped` only if the source was
  cropped, always `resized` and `converted to WebP` given the pipeline in §2.
- Add `needsReview: true` and a `reviewNote` whenever a human still needs to double-check
  something - an unverified source match, an unclear licence, a missing `permissionRef`. Leave both
  off once fully confirmed. If the licence genuinely can't be established, set `license: "unclear"`
  and do **not** commit the image (see the rule above) - don't ship it flagged as unclear.
- A pull request into `main` fails while any entry has `needsReview` or an `unclear` licence
  (`apps/app/scripts/check-image-rights.mjs`), so an unreviewed image can reach tester builds but not a
  release.

## 5. Videos

An item with `video` shows its picture as a cover with „Video abspielen“ and a notice that playing
sends data to Google; nothing reaches YouTube before the tap (privacy policy §6.2). The video then
plays on a screen of its own: a native player on Android and iOS, the youtube-nocookie embed in the
browser. „Auf YouTube ansehen“ sits under both as a second way in.

When a video is added, ask the producer whether it has German captions, and say in the pull request
if it does not - the app asks YouTube to show captions, but cannot add any (WCAG 1.2.2).

## 6. Verify

1. `pnpm test:ci` - the catalog sync and content interactors have unit tests, but they don't cover
   authored content itself; this just confirms nothing broke.
2. Run the app (see the `run` skill / `pnpm start`), open `/content` (the debug content list) and
   click through the new item: image loads, markdown renders as expected, the credit line shows.
3. If the item is `eligibleForDaily`, the Today card only shows one stable item per day - force a
   look by clearing `localStorage` (`rk.dailyImpulse`) or checking on a day where it's due to rotate.

## Adding an Anlaufstelle (support service)

Anlaufstellen (`apps/app/public/support-services/catalog.json`, shown under Content → Anlaufstellen, #24)
are a **separate, simpler catalog** from the one above - don't confuse the two:

- **Bump the top-level `version` with every edit.** Like the Wissensimpulse catalog, the file is
  reconciled into SQLite (`SupportServiceCatalogSync`, into `support_services` and its search
  index), and only a changed version triggers the rewrite - skip the bump and an existing install
  keeps showing, and finding, the old entries. Fields per entry:

| Field            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | Stable, unique, kebab-case (e.g. `rat-auf-draht`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `region`         | `'online'` (Austria-wide phone/online offers) or an Austrian state slug (e.g. `vorarlberg`). A region only appears as a filter chip once it has at least one entry - see `SupportServicesInteractor`'s fixed display order (online first, then Vorarlberg, Tirol, Salzburg, then the rest).                                                                                                                                                                                                                                                                                                                                                        |
| `name`, `teaser` | Plain text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `icon`           | One emoji, freely chosen to fit the service (e.g. 🧠, 🛡️, ⚖️) - drawn plain as the card's lead visual, with no frame behind it. Every entry needs one; there's no default and no shared palette to pick from. It must be **unique within its region**: the filter is single-select, so one region's list is the whole visible set. But **one organisation keeps one emoji across regions** - an Anlaufstelle with an online offer and a Vorarlberg office uses the same emoji for both. Two offers of the same organisation inside one region may share an emoji too; list the pair in `SHARED_EMOJI_BY_DESIGN` so the guard spec below allows it. |
| `actions`        | Array of contact actions, in the order the buttons should appear (first button is primary). May be empty, though a service with no way to reach it is unusual.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### `actions[]` - enter numbers pre-formatted, don't rely on the app to convert them

Each action is `{ type, label, uri, displayValue? }`. **The app renders `uri` and `label` exactly
as given - it does not parse or reformat phone numbers at runtime.** Getting the `uri` right when
you add an entry is the whole job; there is no normalization pass to catch a mistake later.

| Field          | Notes                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | `'phone'`, `'sms'`, `'website'`, or `'chat'`. Decides the icon and whether the link opens externally (`website`/`chat`) or hands off to the OS (`phone`/`sms`). |
| `label`        | The exact button text (e.g. `"Anrufen"`, `"SMS senden"`, `"Chat"`, `"Webseite"`).                                                                               |
| `uri`          | The literal `tel:`/`sms:`/`https:` value - see the number-formatting rules below.                                                                               |
| `displayValue` | Optional, `phone`/`sms` only: the human-readable number, read out in the button's accessible name (e.g. `"Anrufen (147)"`). Omit for `website`/`chat`.          |

**Phone number formatting for `uri` - get this right per number, there's no generic rule that
covers all of them:**

- **Austrian short/service numbers** (e.g. `147` Rat auf Draht, `142` Telefonseelsorge): keep
  exactly as given. `uri: 'tel:147'`. **Never** prepend `+43` - `+43147` is a different, wrong
  number, not an internationalised version of `147`.
- **Ordinary Austrian numbers and `0800` numbers**: strip the leading `0`, prepend `+43`, remove
  spaces. `01 4000 53655` → `uri: 'tel:+431400053655'`. `0800 222 555` → `uri: 'tel:+43800222555'`.
  Keep the original spaced form as `displayValue` (e.g. `'0800 222 555'`) - only `uri` needs to be
  machine-readable.
  - `0800` means freephone **in Austria only** - it is not guaranteed reachable or free from
    abroad. Don't describe an `0800` service as free worldwide.
- **A number already given in `+43…` form** (e.g. Verein Amazone's `+43 5574 45801`): just remove
  the spaces for `uri` (`tel:+43557445801`); it's already correct, don't reprocess it.
- **SMS-only services**: use `type: 'sms'` and a `sms:` URI (digits only, no `+43` unless the
  service explicitly documents an international SMS number), never `type: 'phone'` - a `tel:` link
  on an SMS-only number opens the dialer for a service that doesn't take calls. Re-check the
  provider's current recommended contact method before shipping an SMS-only entry; emergency/crisis
  communication channels change.
- A `Chatten:`/web-chat link from source material becomes `type: 'chat'`; a plain informational
  link becomes `type: 'website'`. Both render as an external link - the distinction only changes
  the icon and default label.

Verify: `pnpm test:ci`, then open `/content` → Anlaufstellen and check the region filter, each
`phone` action opens the device dialer with the exact number shown, each `sms` action opens the
messaging app (not the dialer), `website`/`chat` actions open externally, and each card shows a
distinct emoji.

`support-services.catalog-content.spec.ts` reads the committed file and enforces what the gateway's
runtime type guards cannot see: unique kebab-case ids, known regions, non-empty trimmed text,
emoji unique per region, a `uri` scheme matching each action's type, and a `displayValue` whose
digits are the digits the `uri` dials. It runs as part of `pnpm test:ci`. Both exception lists in
it - `SHARED_EMOJI_BY_DESIGN` and `HTTP_ONLY_BY_NECESSITY` - name the entry and the reason; add to
them deliberately, never to silence a failure.

## Adding a curated calendar (Amazone & Partnerkalender)

`apps/app/public/curated-calendars/catalog.json` is the one place a curated online calendar is listed (#2).
Everything in the app follows from it: the introduction's „Welche Kalender willst du sehen?“ step,
Settings → Kalender verwalten → Amazone & Partnerkalender, and the seeded calendar itself. No
screen names a calendar in code.

1. Add an entry: `id` (stable, kebab-case, never reused), `name`, `description` (one sentence,
   shown under the toggle), `url` (`https:` or `webcal:`; plain `http:` is refused), `color`
   (`#RRGGBB`) and `emoji`. The array order is the order on both screens.
2. Bump the top-level `version`. Without it an existing install never seeds the new entry.
3. Name the calendar and its provider in the privacy policy, `packages/legal/src/datenschutz.md`
   section 5.2, with a link to the provider's own privacy policy. `node apps/app/scripts/check-store-listing.mjs`
   fails while the policy does not name a catalog entry.
4. Re-read the store descriptions (`apps/app/fastlane/metadata/de-DE/description.txt`,
   `apps/app/fastlane/metadata/android/de-DE/full_description.txt`) and `docs/store-compliance.md`, which
   describe which calendars ship, and update them to match.

The colour, emoji and name are only applied the first time an entry is seeded; changing them later
leaves existing installs as they are. Removing an entry never removes a seeded calendar from a
device, see `CuratedCalendarSync`.

On an existing install a new entry is seeded switched on and downloaded on the next calendar
screen; only a fresh install gets to choose in the introduction first.
