# App icon

The app ships six interchangeable home-screen icons, two cats in three colourings each. „Cool Cat
Nacht“ is the default; the others can be picked at runtime under **Einstellungen → Darstellung &
Bedienung → App-Symbol**. More can be added later without changing anything but data, generated
assets and the native registration (see [Adding another icon](#adding-another-icon)).

## Where the artwork comes from

<p align="center">
  <img src="./images/app-icon.png" alt="The default icon, Cool Cat Nacht, with rounded corners" width="240">
</p>

Verein Amazone supplied the six icons in October 2026. They replace „Klassisch“, „Pixel“ and
„Nacht“ from release candidate 52 and earlier.

- **Cool Cat** - a cat with a headscarf, sunglasses and a handbag, the same character as in the
  Wissensimpuls illustration „Heute ist Feministischer Kampftag!“. In white and mint on navy
  („Cool Cat Nacht“), black and white on lilac („Cool Cat Lila“), and red and orange on white
  („Cool Cat Hell“).
- **Sam** - a cat in a shirt and tie. In white and purple on orange („Sam Orange“), white and teal on
  teal („Sam Türkis“), and red on white („Sam Hell“).

`docs/images/app-icon.png` is the rounded version of the default icon from the same delivery, for the
README; the website's `apps/site/public/assets/icon.webp` is the same rounded artwork at 256 px. The earlier icons were based on a sketch workshop participants built from sticky notes
(`docs/images/workshop-logo-sketch.png`), kept as a record.

## Sources and generated assets

The square sources live in `apps/app/resources/app-icons/`, one PNG per icon (at least 1024 × 1024, opaque,
no rounded corners - every platform applies its own mask):

```
apps/app/resources/app-icons/cool-cat-nacht.png
apps/app/resources/app-icons/cool-cat-lila.png
apps/app/resources/app-icons/cool-cat-hell.png
apps/app/resources/app-icons/sam-orange.png
apps/app/resources/app-icons/sam-tuerkis.png
apps/app/resources/app-icons/sam-hell.png
```

They are the delivered 4267 px files, scaled to 2048 px and stored without the alpha channel they
carried (fully opaque anyway).

Everything else is generated and committed:

```bash
node apps/app/scripts/generate-app-icons.mjs
```

Per icon that writes:

| Output                                                      | What it is                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/app/ios/App/App/Assets.xcassets/<Catalog>.appiconset` | One flat 1024 px PNG, full-bleed. iOS applies the corner mask.        |
| `apps/app/android/…/mipmap-<density>/<name>.png`            | Legacy (pre-API-26) square launcher icon, full-bleed, five densities. |
| `apps/app/android/…/mipmap-<density>/<name>_round.png`      | Legacy round icon: artwork inside the safe zone on a disc.            |
| `apps/app/android/…/mipmap-<density>/<name>_foreground.png` | Adaptive foreground: artwork scaled into the 72dp-of-108dp safe zone. |
| `apps/app/android/…/mipmap-anydpi-v26/<name>.xml`           | Adaptive icon pairing that foreground with a solid background colour. |
| `apps/app/android/…/values/ic_launcher_background.xml`      | The background colours, averaged from each source's own corners.      |
| `apps/app/public/app-icons/<id>.webp`                       | The 192 px preview shown on the settings screen.                      |

And, from the default icon (`cool-cat-nacht`) only:

| Output                                                        | What it is                                                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/site/public/apple-touch-icon.png`                       | The 180 px icon Safari on iOS uses when the website is added to a home screen, full-bleed.                                 |
| `apps/app/public/favicon.ico`, `apps/site/public/favicon.ico` | The browser tab icon: 16, 32 and 48 px PNGs in one ICO file, the same for the app and the website.                         |
| `apps/app/fastlane/metadata/android/de-DE/images/icon.png`    | The Play listing's 512 px hi-res icon, full-bleed (Play applies its own mask). See [store-listing.md](./store-listing.md). |

`favicon.ico` and `apple-touch-icon.png` belong to the website (`apps/site`), whose
page icon is the rounded artwork above, with its own corners and transparency. `ng serve` uses the
same tab icon. The website shows only the default icon, so the alternates need none.

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
  `apps/app/android/app/src/main/AndroidManifest.xml`, not on `MainActivity`. Switching means enabling one
  alias and disabling the others. Exactly one alias may be `android:enabled="true"`: the plugin
  treats the first enabled launcher component as the default, and that is what „Cool Cat Nacht“
  returns to. Never bring back a removed alias name: Android keeps the enabled state the plugin set
  for a component across updates, so a revived name could start disabled and leave the app without
  a launcher entry. That is why the cat icons got new alias names rather than taking over
  `.Klassisch`, `.Pixel` and `.Nacht`. Some launchers only pick the new icon up once the app's task has been closed.
- **iOS** - the alternates are asset catalogs listed in
  `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`. Their names are case-sensitive and must not start
  with `AppIcon`, or the system fails to resolve them on a physical device. iOS shows a system alert
  on every change, and older devices may not support alternate icons at all - the settings screen
  reads that through `isAvailable()` and offers no choice where it is false.

In the app, `DeviceAppIcon` wraps the plugin, `AppIconInteractor` owns the option list and the
mapping from icon id to native name, and the settings page reads the active icon back through
`getCurrentIcon()` instead of storing it. The operating system owns that state and can reset it
without telling the app, so there is nothing to keep in sync.

## Adding another icon

1. Drop a square PNG into `apps/app/resources/app-icons/`.
2. Add an entry to `ICONS` in `apps/app/scripts/generate-app-icons.mjs` and run the script.
3. Add an `<activity-alias>` for it in `AndroidManifest.xml`, `android:enabled="false"`.
4. Add its catalog name to `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` in
   `apps/app/ios/App/App.xcodeproj/project.pbxproj` (both Debug and Release).
5. Add the option, its German label and its native name to `AppIconInteractor`.
6. Run `pnpm cap:sync` and check the icon on a real Android launcher and a physical iPhone - the iOS
   simulator does not render alternate icons.
