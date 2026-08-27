# Curated content assets

See [docs/content-authoring.md](../../docs/content-authoring.md) for the full step-by-step guide to
adding a new item (catalog entry, image conversion, licensing). Short version below.

`catalog.json` is the single source of truth for the app's curated "Wissen & Impulse" and
"Rebell*in" content - see `src/app/data/content/content-catalog-sync.ts`, which reconciles it into
the `content_items` table at runtime. Bump `version` whenever `items` changes; the sync only does
its diff-and-write work when the stored version is stale.

`wissensimpulse/<id>.webp` and `rebellinnen/<id>.webp` are the matching images, one per catalog
entry with an `id`, converted from the original source photos/illustrations via `ffmpeg` (resize)
and `cwebp` (encode) - this machine's `ffmpeg` build has no `libwebp` support, hence the two-step
pipeline. The image path is never stored in `catalog.json`; it's derived from `kind` and `id`.

## Licensing

These images are **not** covered by the repository's MIT License (see [../../LICENSE](../../LICENSE)
and the [README's Licensing section](../../README.md#licensing)). Every image's licence, source and
attribution is tracked in [`../image-attributions.json`](../image-attributions.json), one entry per
`path`, shown to users under Settings → Lizenzen & Impressum → Bildnachweise. Per
[issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11), an image only belongs
in this directory once its entry's rights are actually clarified - do not add an image here on the
assumption that clarification will follow later.
