# Curated content assets

See [docs/content-authoring.md](../../docs/content-authoring.md) for the full step-by-step guide to
adding a new item (catalog entry, image conversion, licensing). Short version below.

`catalog.json` is the single source of truth for the app's curated "Wissen & Impulse" and
"Rebell*in" content - see `src/app/data/content/content-catalog-sync.ts`, which reconciles it into
the `content_items` table at runtime. Bump `version` whenever `items` changes; the sync only does
its diff-and-write work when the stored version is stale.

An entry names its picture by `heroImageId` only. Everything about the picture - what it shows
(`alt`), who made it, its source and licence - is recorded once in [`images.json`](./images.json),
the image catalog, under the image's own `id`.

`images/<image id>.webp` are the images, converted from the original source photos/illustrations
via `ffmpeg` (resize) and `cwebp` (encode) - this machine's `ffmpeg` build has no `libwebp` support,
hence the two-step pipeline. The file path is never written down; it follows from the image `id`.

## Licensing

These images are **not** covered by the repository's MIT License (see [../../LICENSE](../../LICENSE)
and the [README's Licensing section](../../README.md#licensing)). Every image's licence, source and
attribution and its description are tracked in [`images.json`](./images.json), one entry per image
`id`, shown to users under Settings → Lizenzen & Impressum → Bildnachweise. Per
[issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11), an image only belongs
in this directory once its entry's rights are actually clarified - do not add an image here on the
assumption that clarification will follow later.
