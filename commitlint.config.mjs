// Conventional Commits, enforced on the commits of a pull request (see the `checks` job in
// .github/workflows/ci.yml). The convention is not cosmetic here: semantic-release derives the
// released version from the commit types, so a mistyped subject silently changes what ships.
//
// Merge commits are ignored by commitlint's own defaults, which is why the repository can keep
// merging pull requests instead of squashing them.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // `improvement` on top of the conventional types: a change users notice that is too small to
    // call a feature. It releases a patch, not a minor (`releaseRules` in .releaserc.json).
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'improvement',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
    // Off, not relaxed: Dependabot pastes upstream release notes and long URLs into the body, and
    // semantic-release writes the generated notes into the body of its own release commit. Neither
    // wraps at 100 characters, and neither is worth rejecting over.
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
  },
};
