# Adding curated content (Wissensimpulse & Rebell\*innen)

How to add or edit a "Wissen & Impulse" or "Rebell\*in" item - the content shown on the Today page
and under `/content`. Covers the full pipeline: catalog entry, image conversion, and licensing.

Related code: `src/app/data/content/content-catalog-sync.ts` (reconciles the catalog into the
`content_items` table at runtime), `public/content/README.md` (asset directory notes),
[issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11) (licensing rules this
guide implements).

## 1. Add the catalog entry

`public/content/catalog.json` is the single source of truth for content. It is **not** seeded by a
database migration - `ContentCatalogSync` reconciles it into `content_items` lazily, on first read,
by diffing against the stored `version`. So:

1. Add a new object to `items`, or edit an existing one.
2. **Bump the top-level `version` field.** The sync only does its diff-and-write work when the
   stored version is stale - skip this and your change silently never reaches the database, even
   after a rebuild. (This bit us once already: a `wi-12` link edit went live in the file but never
   rendered, because `version` was untouched.)

Fields per entry:

| Field                      | Notes                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                       | `wi-NN` or `reb-NN`, next free number in that series.                                                                                                                                |
| `kind`                     | `'wissensimpulse'` or `'rebellin'`.                                                                                                                                                  |
| `title`, `teaser`          | Plain text.                                                                                                                                                                          |
| `bodyMarkdown`             | See §3 for markdown conventions (blockquotes, links).                                                                                                                                |
| `imageAttribution`         | Human-readable credit string shown in the app footer - not the licensing record (that's §4).                                                                                         |
| `sourceLabel`, `sourceUrl` | Optional "Quelle" link shown under the body (e.g. a linked article/app).                                                                                                             |
| `relatedSources`           | Optional array of `{ title, url }` "Mehr zum Thema" links, shown below the body. Publisher/domain is derived from `url` automatically - omit the field entirely when there are none. |
| `validFrom`, `validTo`     | ISO dates for date-scoped items, or both `null` for evergreen content.                                                                                                               |
| `eligibleForDaily`         | Whether this item can be picked as the Today page's featured item.                                                                                                                   |

Do **not** put an `imagePath` field in the catalog - it's derived automatically from `kind` and
`id` (`imagePathFor()` in `content-catalog-sync.ts`): `/content/wissensimpulse/<id>.webp` or
`/content/rebellinnen/<id>.webp`.

## 2. Convert and place the image

Images ship as WebP to keep the app bundle small. This machine's Homebrew `ffmpeg` build has no
`libwebp` support (`ffmpeg -encoders | grep webp` returns nothing), so conversion is two steps:
resize with `ffmpeg` into a temporary PNG, then encode to WebP with the separate `cwebp` tool
(Homebrew formula `webp`, install with `brew install webp` if `which cwebp` comes up empty).

```bash
# 1. Resize (cap the long edge at 1280px, keep aspect ratio, even dimensions for the encoder)
ffmpeg -i source-photo.jpg -vf "scale='min(1280,iw)':-2" /tmp/resized.png

# 2. Encode to WebP
cwebp -q 75 /tmp/resized.png -o public/content/rebellinnen/reb-20.webp
```

Use `wissensimpulse/` or `rebellinnen/` to match the entry's `kind`, and name the file `<id>.webp`
exactly - that's what `imagePathFor()` expects.

## 3. Markdown conventions

`bodyMarkdown` renders through `MarkdownContentComponent` (`cross-cutting/markdown/`), which allows
paragraphs, lists, headings, links and blockquotes - see `src/styles/components/markdown-content.css`
for how each renders.

- **A Rebell\*in's own quoted words**, transcribed as their own standalone paragraph, should be a
  markdown blockquote (`> ...`), not quotation marks in running text - it renders visually distinct
  (bordered, larger, semibold) rather than relying on the quote marks alone. Only convert a
  standalone quoted paragraph; leave quoted terms inside running prose (e.g. a nickname like „Godmother
  of Punk“) as plain text.
- Links (`[text](url)`) render as underlined inline links; no other markup needed.
- Never import `marked` outside `cross-cutting/markdown/` - always go through
  `MarkdownContentComponent`, per the frontend architecture rules.

## 4. Record the image's licence in `image-attributions.json`

Per [issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11): **an image only
belongs in the repo once its rights are actually clarified.** Don't add an image on the assumption
that licensing will be sorted out later - resolve it first, or don't commit the image yet.

Add one entry to `public/image-attributions.json` (shown to users under Settings → Lizenzen &
Impressum → Bildnachweise):

```json
{
  "path": "/content/rebellinnen/reb-20.webp",
  "title": "Person or item title",
  "creator": "Photographer or illustrator name",
  "sourceUrl": "https://commons.wikimedia.org/wiki/File:Exact_File_Name.jpg",
  "license": "CC-BY-SA-4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "changes": ["cropped", "resized", "converted to WebP"]
}
```

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

## 5. Verify

1. `pnpm test:ci` - the catalog sync and content interactors have unit tests, but they don't cover
   authored content itself; this just confirms nothing broke.
2. Run the app (see the `run` skill / `pnpm start`), open `/content` (the debug content list) and
   click through the new item: image loads, markdown renders as expected, footer attribution shows.
3. If the item is `eligibleForDaily`, the Today card only shows one stable item per day - force a
   look by clearing `localStorage` (`rk.dailyImpulse`) or checking on a day where it's due to rotate.

## Adding an Anlaufstelle (support service)

Anlaufstellen (`public/support-services/catalog.json`, shown under Content → Anlaufstellen, #24)
are a **separate, simpler catalog** from the one above - don't confuse the two:

- No SQLite sync. `SupportServiceCatalogGateway` fetches the file directly on every page load; there
  is no `version` field to bump, no `content_items` table, and no build step. Anlaufstellen has no
  per-item state to persist (no bookmarking, no daily rotation, no read history), so the
  `ContentCatalogSync` machinery the Wissensimpulse/Rebell\*in catalog needs would add nothing here.
  Fields per entry:

| Field            | Notes                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | Stable, unique, kebab-case (e.g. `rat-auf-draht`).                                                                                                                                                                                                                                          |
| `region`         | `'online'` (Austria-wide phone/online offers) or an Austrian state slug (e.g. `vorarlberg`). A region only appears as a filter chip once it has at least one entry - see `SupportServicesInteractor`'s fixed display order (online first, then Vorarlberg, Tirol, Salzburg, then the rest). |
| `name`, `teaser` | Plain text.                                                                                                                                                                                                                                                                                 |
| `crisis`         | Optional, defaults to `false`. Set `true` for an acute-crisis/emergency hotline; the card marks it with an icon **and** the text "Krisenhotline", never colour alone.                                                                                                                       |
| `icon`           | One emoji, freely chosen to fit the service (e.g. 🧠, 🛡️, ⚖️) - shown on a tinted badge next to the name. Every entry needs one; there's no default and no shared palette to pick from, just something distinct from its neighbours in the same region's list.                              |
| `color`          | A hex colour tinting that badge (e.g. `"#E92F2A"`). Vary it across entries in the same region so a long scrolling list stays scannable - two red badges back-to-back defeats the point.                                                                                                     |
| `logoPath`       | Optional, omitted today on every entry. A real organisation logo **may only be added once its usage rights are cleared** - same rule `image-attributions.json` already enforces for other images. See "Adding a real logo" below.                                                           |
| `actions`        | Array of contact actions, in the order the buttons should appear (first button is primary). May be empty, though a service with no way to reach it is unusual.                                                                                                                              |

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
distinct icon/colour badge.

### Adding a real logo

Every entry ships with an `icon`/`color` badge today; a real organisation logo replaces it once
one is sourced and cleared, per organisation:

1. Confirm the logo's usage rights first - same rule as `image-attributions.json` (see §4 above):
   don't add a logo image on the assumption that licensing will be sorted out later.
2. Convert it to WebP and place it at `public/support-services/logos/<id>.webp`, matching the
   entry's `id` (mirrors the `public/content/<kind>/<id>.webp` convention the daily-impulse
   catalog uses - see §2 above for the `ffmpeg`/`cwebp` conversion steps).
3. Set `"logoPath": "/support-services/logos/<id>.webp"` on that entry. `SupportServiceAvatar`
   prefers the image automatically and falls back to the `icon`/`color` badge if it 404s - leave
   `icon`/`color` in place as that fallback, don't remove them.
