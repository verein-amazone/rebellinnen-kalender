# @amazone/design-system

The visual foundation the app (`apps/app`) and the website (`apps/site`) share. It ships source
only: there is no build step, each consumer's Tailwind build reads these files directly.

| Export                                | What it is                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@amazone/design-system/theme.css`    | The `--rk-*` tokens per colour theme, their Tailwind `@theme` mapping and the custom variants |
| `@amazone/design-system/fonts.css`    | `@font-face` rules for Inter and Fredoka                                                      |
| `@amazone/design-system/fonts/<file>` | The `.woff2` files, their OFL licence texts and `NOTICE.md`                                   |

Import both stylesheets after `@import 'tailwindcss'`:

```css
@import 'tailwindcss';
@import '@amazone/design-system/fonts.css';
@import '@amazone/design-system/theme.css';
```

`fonts.css` refers to the font files by relative URL, so the consumer's bundler (the Angular
builder, Vite in Astro) copies them into its output with a content hash. Nothing has to be copied
into `public/` by hand.

What the tokens mean and how to use them is described in
[docs/architecture/design-system.md](../../docs/architecture/design-system.md) and
[DESIGN.md](../../DESIGN.md).
