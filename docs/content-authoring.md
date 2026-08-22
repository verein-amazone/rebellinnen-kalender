# Adding curated content (Wissensimpulse & Rebell\*innen)

How to add or edit a "Wissen & Impulse" or "Rebell\*in" item — the content shown on the Today page
and under `/content`. Covers the full pipeline: catalog entry, image conversion, and licensing.

Related code: `src/app/data/content/content-catalog-sync.ts` (reconciles the catalog into the
`content_items` table at runtime), `public/content/README.md` (asset directory notes),
[issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11) (licensing rules this
guide implements).

## 1. Add the catalog entry

`public/content/catalog.json` is the single source of truth for content. It is **not** seeded by a
database migration — `ContentCatalogSync` reconciles it into `content_items` lazily, on first read,
by diffing against the stored `version`. So:

1. Add a new object to `items`, or edit an existing one.
2. **Bump the top-level `version` field.** The sync only does its diff-and-write work when the
   stored version is stale — skip this and your change silently never reaches the database, even
   after a rebuild. (This bit us once already: a `wi-12` link edit went live in the file but never
   rendered, because `version` was untouched.)

Fields per entry:

| Field                      | Notes                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `id`                       | `wi-NN` or `reb-NN`, next free number in that series.                                        |
| `kind`                     | `'wissensimpulse'` or `'rebellin'`.                                                          |
| `title`, `teaser`          | Plain text.                                                                                  |
| `bodyMarkdown`             | See §3 for markdown conventions (blockquotes, links).                                        |
| `imageAttribution`         | Human-readable credit string shown in the app footer — not the licensing record (that's §4). |
| `sourceLabel`, `sourceUrl` | Optional "Quelle" link shown under the body (e.g. a linked article/app).                     |
| `validFrom`, `validTo`     | ISO dates for date-scoped items, or both `null` for evergreen content.                       |
| `eligibleForDaily`         | Whether this item can be picked as the Today page's featured item.                           |

Do **not** put an `imagePath` field in the catalog — it's derived automatically from `kind` and
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
exactly — that's what `imagePathFor()` expects.

## 3. Markdown conventions

`bodyMarkdown` renders through `MarkdownContentComponent` (`cross-cutting/markdown/`), which allows
paragraphs, lists, headings, links and blockquotes — see `src/styles/components/markdown-content.css`
for how each renders.

- **A Rebell\*in's own quoted words**, transcribed as their own standalone paragraph, should be a
  markdown blockquote (`> ...`), not quotation marks in running text — it renders visually distinct
  (bordered, larger, semibold) rather than relying on the quote marks alone. Only convert a
  standalone quoted paragraph; leave quoted terms inside running prose (e.g. a nickname like „Godmother
  of Punk“) as plain text.
- Links (`[text](url)`) render as underlined inline links; no other markup needed.
- Never import `marked` outside `cross-cutting/markdown/` — always go through
  `MarkdownContentComponent`, per the frontend architecture rules.

## 4. Record the image's licence in `image-attributions.json`

Per [issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11): **an image only
belongs in the repo once its rights are actually clarified.** Don't add an image on the assumption
that licensing will be sorted out later — resolve it first, or don't commit the image yet.

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
  match** what you were told before using its `sourceUrl` — several near-duplicate photos of the
  same person, by different photographers under different licences, commonly exist side by side.
  Use `sourceUrl` (a real file page you found and checked), never a fabricated or guessed URL.
- If there's no clean `sourceUrl` (e.g. own/commissioned Verein Amazone content), use `source`
  (free text) instead, and add `permissionRef` once a real usage-grant reference exists — omit it
  rather than inventing one.
- For public-domain images, add `publicDomainBasis` explaining why (e.g. "US government work",
  "author's life + 100 years expired").
- Use `changes` to list every transformation actually applied — `cropped` only if the source was
  cropped, always `resized` and `converted to WebP` given the pipeline in §2.
- Add `needsReview: true` and a `reviewNote` whenever a human still needs to double-check
  something — an unverified source match, an unclear licence, a missing `permissionRef`. Leave both
  off once fully confirmed. If the licence genuinely can't be established, set `license: "unclear"`
  and do **not** commit the image (see the rule above) — don't ship it flagged as unclear.

## 5. Verify

1. `pnpm test:ci` — the catalog sync and content interactors have unit tests, but they don't cover
   authored content itself; this just confirms nothing broke.
2. Run the app (see the `run` skill / `pnpm start`), open `/content` (the debug content list) and
   click through the new item: image loads, markdown renders as expected, footer attribution shows.
3. If the item is `eligibleForDaily`, the Today card only shows one stable item per day — force a
   look by clearing `localStorage` (`rk.dailyImpulse`) or checking on a day where it's due to rotate.
