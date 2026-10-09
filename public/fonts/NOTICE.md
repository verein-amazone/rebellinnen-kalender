# Bundled fonts

Both families are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/).
The full licence texts with their copyright notices are in `licenses/texts/` and ship with the app
in the third-party licence list (Open-Source-Lizenzen), as the licence requires.

| File                     | Family  | Source                                        |
| ------------------------ | ------- | --------------------------------------------- |
| `inter-latin.woff2`      | Inter   | https://fonts.google.com/specimen/Inter        |
| `inter-latin-ext.woff2`  | Inter   | https://fonts.google.com/specimen/Inter        |
| `fredoka-latin.woff2`    | Fredoka | https://fonts.google.com/specimen/Fredoka      |
| `fredoka-latin-ext.woff2`| Fredoka | https://fonts.google.com/specimen/Fredoka      |

The files are the `latin` and `latin-ext` subsets of the variable font builds served by Google
Fonts. They are checked in so the app never requests a font at runtime.
