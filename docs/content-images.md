# Sourcing imagery for the app

What to ask a contributor, partner organisation or photographer for, and why those numbers.
This is the brief you hand to whoever produces the picture; for what to do with the file
once it arrives, see [content-authoring.md](./content-authoring.md).

## The short brief

Everything below in the form you can forward as-is:

> - **4:3, landscape.** For example 2048 × 1536.
> - **At least 1440 × 1080 pixels.** Larger is always better; the original size is ideal.
> - **JPEG or PNG at full quality**, straight out of the camera or the design tool. Not
>   WebP, not a screenshot, and not a copy that has been through a messaging app.
> - **Three notes per image:** a description of what it shows, the credit line, and one
>   line on where the right to use it comes from.

## Where the numbers come from

**Why 4:3.** The same image is rendered in two places: full width on the content detail
page (`detail.page.html`, natural aspect ratio, no crop) and as the Today card's preview
(`today-impulse.block.html`, `aspect-[4/3] object-cover`, a hard centre crop). Delivered at
4:3, both show the same picture and nothing is cut. Anything wider loses its edges in the
preview - the current 3:2 stock loses 80px per side, and the 1.69:1 illustrations lose 135px
per side, which is enough to cut into text set near the edge.

Other ratios are accepted rather than rejected; they are simply cropped in the preview. If
a picture cannot be produced at 4:3, keep the subject centred.

**Why 1440 × 1080 as the floor.** The app is iPhone-only and portrait-only
(`TARGETED_DEVICE_FAMILY = 1`, `UISupportedInterfaceOrientations`). The widest iPhone is
440pt, and `rk-screen-body` is `px-4`, leaving a 408pt content column. At the device pixel
ratio of 3 that is **1224 physical pixels** - the most a full-width image can ever occupy.
1440 covers that with headroom for a hypothetical wider phone. Upscaling is not a
substitute: sharpness absent from the original cannot be added later.

There is no upper bound worth stating. Oversized originals cost nothing but disk, and
keeping them means a future resolution bump does not require going back to the source.

**Why not WebP from the supplier.** The app ships WebP, but that conversion is ours to
make. A supplied WebP has already been through one lossy pass, and re-encoding it adds a
second.

**Why messaging apps matter.** WhatsApp and similar silently downscale images sent as
"photo", regardless of the original's size, and the sender cannot tell from their end.
Sending as a _document_ preserves the file. This is the single most common reason a
delivery misses the resolution floor.

## Text inside images

Avoid it. Text baked into a picture is not exposed to screen readers and does not scale
with the OS text size, both of which the app's WCAG 2.2 AA target rules out as the only
carrier of information (see [accessibility.md](./architecture/accessibility.md)). Where
text is unavoidable, ask for it separately as plain text so it can be rendered as markup.

## The three notes, and what they map to

Each one lands somewhere specific; none of them is optional.

| Ask for                               | Lands in                                     | Notes                                                                                                          |
| ------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A description of what the image shows | `imageAlt` in `public/content/catalog.json`  | German, one or two sentences. Describes the picture, never the credit. Read aloud to people who cannot see it. |
| The credit line                       | `imageAttribution` in the same entry         | Shown as a visible caption. Never used as alt text.                                                            |
| Where the usage right comes from      | An entry in `public/image-attributions.json` | Creator, source, licence. Surfaced under Settings → Lizenzen & Impressum → Bildnachweise.                      |

The third one is the one that gets forgotten, and it is the one that blocks. Per
[issue #11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11) an image only
belongs in `public/content/` once its rights are actually clarified - not on the
expectation that clarification will follow. "Own photograph", "commissioned work, agreement
on file", "photographer agreed by email" and a named public licence all qualify; a credit
line on its own does not. Where a written grant exists, archive it and reference it.

Images are **not** covered by the repository's MIT licence. Where people are recognisable,
their consent to publication is needed as well.

## Current shipped sizes

The conversion step in [content-authoring.md](./content-authoring.md) caps the long edge at
1280px, which clears the 1224px requirement above with little to spare. Two files predate
this guidance and sit below it - `reb-17.webp` at 255 × 256 and `reb-10.webp` at 587 × 588 -
and look soft on device. Whether to raise the shipped cap, and whether to keep full-size
masters in the repository alongside the shipped derivatives, is not settled; the floor above
is written so that either choice stays open.
