# Release notes

Hand-written German release notes for releases from `main` - the versions that reach the public App
Store and Play Store listings. Prereleases from `dev` (`1.0.0-rc.N`) do not need one; their notes are
generated from the commit subjects for testers. See [Release notes](../release.md#release-notes) for
how the text travels.

## The convention

- **One file per release, named by its version:** `1.0.0.md`, `1.0.1.md`. No `v` prefix, no
  prerelease suffix.
- **German, written for the people who use the app**, not for developers: what is new or better,
  in their words. Write `Rebell*innen` with its gender star.
- **At most 500 characters as plain text** - Play's limit for "What's new". The same text is the
  App Store's "What's New" and is appended to the GitHub release.
- **Start with a `##` heading.** It titles the section in the GitHub release and in
  `CHANGELOG.md`; the store text drops it.
- **Plain markdown only:** paragraphs and `-` bullets. Links lose their URL in the store text, and
  HTML is not stripped.
- **Land it on `dev` before `dev` is merged into `main`**, so the release commit finds it.

## Preview

```bash
node scripts/build-store-release-notes.mjs --tag v1.0.0 --body-file /dev/null --dry-run
```

prints the store text with its length, or fails when it is too long.
