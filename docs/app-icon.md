# App icon

The app ships three interchangeable home-screen icons. „Klassisch“ is the default; „Pixel“ and
„Nacht“ can be picked at runtime under **Einstellungen → Darstellung & Bedienung → App-Symbol**.
More candidates from [issue #9](https://github.com/verein-amazone/rebellinnen-kalender/issues/9)
can be added later without changing anything but data and generated assets.

## Where the artwork comes from

<p align="center">
  <img src="./images/workshop-logo-sketch.png" alt="A collaborative board where hundreds of small coloured sticky notes form the outline of a head with spiked hair, in pink, blue and orange" width="420">
</p>

The shape was built by workshop participants on a shared board, one sticky note at a time: a head
with spiked hair, drawn collectively rather than designed by one person. That sketch is the
inspiration for all three icons - every one of them is the same silhouette, redrawn to survive being
shown at 48 px on a home screen.

- **Klassisch** - the angular reading of the sketch, with the pink outline sitting behind a cyan
  head shape.
- **Pixel** - keeps the sticky-note grid of the original literally, as square blocks.
- **Nacht** - the sharpest reading: long teal spikes over a coral outline.

The sketch itself is kept here rather than in the README because it is a record of how the icon came
about, not the app's current face.

## Sources and generated assets

The square sources live in `resources/app-icons/`, one PNG per icon (at least 1024 × 1024, opaque,
no rounded corners - every platform applies its own mask):

```
resources/app-icons/klassisch.png
resources/app-icons/pixel.png
resources/app-icons/nacht.png
```

Everything else is generated and committed:

```bash
node scripts/generate-app-icons.mjs
```

Per icon that writes:

| Output                                             | What it is                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `ios/App/App/Assets.xcassets/<Catalog>.appiconset` | One flat 1024 px PNG, full-bleed. iOS applies the corner mask.        |
| `android/…/mipmap-<density>/<name>.png`            | Legacy (pre-API-26) square launcher icon, full-bleed, five densities. |
| `android/…/mipmap-<density>/<name>_round.png`      | Legacy round icon: artwork inside the safe zone on a disc.            |
| `android/…/mipmap-<density>/<name>_foreground.png` | Adaptive foreground: artwork scaled into the 72dp-of-108dp safe zone. |
| `android/…/mipmap-anydpi-v26/<name>.xml`           | Adaptive icon pairing that foreground with a solid background colour. |
| `android/…/values/ic_launcher_background.xml`      | The background colours, averaged from each source's own corners.      |
| `public/app-icons/<id>.webp`                       | The 192 px preview shown on the settings screen.                      |

Two details are worth knowing before editing an icon:

- **Android crops.** Launchers mask adaptive icons to a circle, a squircle or a rounded square, and
  only the centre 72 of 108 dp is guaranteed to survive. The full-bleed artwork would lose its
  spikes, so the generator scales it into that safe zone and fills the rest with the source's own
  background colour - which is why the padding is invisible.
- **iOS does not.** The asset catalog gets the artwork edge to edge, without an alpha channel.

## How switching works

Runtime switching uses [`@capawesome/capacitor-app-icon`](https://capawesome.io/docs/sdks/capacitor/app-icon/).
Both platforms need each icon registered at build time; neither can be given a new icon at runtime.

- **Android** - the launcher `<intent-filter>` sits on one `<activity-alias>` per icon in
  `android/app/src/main/AndroidManifest.xml`, not on `MainActivity`. Switching means enabling one
  alias and disabling the others. Exactly one alias may be `android:enabled="true"`: the plugin
  treats the first enabled launcher component as the default, and that is what „Klassisch“ returns
  to. Some launchers only pick the new icon up once the app's task has been closed.
- **iOS** - the alternates are asset catalogs listed in
  `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`. Their names are case-sensitive and must not start
  with `AppIcon`, or the system fails to resolve them on a physical device. iOS shows a system alert
  on every change, and older devices may not support alternate icons at all - the settings screen
  reads that through `isAvailable()` and offers no choice where it is false.

In the app, `AppIconGateway` wraps the plugin, `AppIconInteractor` owns the option list and the
mapping from icon id to native name, and the settings page reads the active icon back through
`getCurrentIcon()` instead of storing it. The operating system owns that state and can reset it
without telling the app, so there is nothing to keep in sync.

## Adding another icon

1. Drop a square PNG into `resources/app-icons/`.
2. Add an entry to `ICONS` in `scripts/generate-app-icons.mjs` and run the script.
3. Add an `<activity-alias>` for it in `AndroidManifest.xml`, `android:enabled="false"`.
4. Add its catalog name to `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` in
   `ios/App/App.xcodeproj/project.pbxproj` (both Debug and Release).
5. Add the option, its German label and its native name to `AppIconInteractor`.
6. Run `pnpm cap:sync` and check the icon on a real Android launcher and a physical iPhone - the iOS
   simulator does not render alternate icons.
