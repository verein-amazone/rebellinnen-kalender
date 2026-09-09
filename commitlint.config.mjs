// Conventional Commits, enforced on the commits of a pull request (see the `checks` job in
// .github/workflows/ci.yml). The convention is not cosmetic here: semantic-release derives the
// released version from the commit types, so a mistyped subject silently changes what ships.
//
// Merge commits are ignored by commitlint's own defaults, which is why the repository can keep
// merging pull requests instead of squashing them.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Off, not relaxed: Dependabot pastes upstream release notes and long URLs into the body, and
    // semantic-release writes the generated notes into the body of its own release commit. Neither
    // wraps at 100 characters, and neither is worth rejecting over.
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
  },
};
