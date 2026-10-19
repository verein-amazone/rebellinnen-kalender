# Redirect for `kalender.amazone.or.at`

The website lived at `kalender.amazone.or.at` until October 2026 and moved to
`rebellinnen.amazone.or.at` (`apps/site`). 1.0.0 went to the stores with the old addresses, and QR
codes may have been printed with them, so every old address forwards to the same path on the new
domain: `https://kalender.amazone.or.at/datenschutz/` → `https://rebellinnen.amazone.or.at/datenschutz/`.

GitHub Pages serves one custom domain per site, so this is a Pages site of its own: these files are
the whole of it. Pages answers every path it has no file for with `404.html`, which is the same page
as `index.html`; `redirect.js` forwards to the new domain with path, query and fragment. Without
JavaScript the page falls back to the new domain's start page and shows a link.

## Publishing

The files live in the repository `verein-amazone/kalender-redirect`, published by Pages from its
`main` branch, root. Copy them there when they change here - they are expected to stay as they are.

Order matters when setting it up: a custom domain belongs to one Pages site at a time. Only after
`pages.yml` has published the website with `CNAME` = `rebellinnen.amazone.or.at` is
`kalender.amazone.or.at` free; then set it as the custom domain of `kalender-redirect` (the `CNAME`
file here does that on a branch-published site) and enable „Enforce HTTPS“ once the certificate is
issued. The DNS record stays as it is: `kalender.amazone.or.at` is a `CNAME` to
`verein-amazone.github.io`.
