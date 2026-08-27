#!/usr/bin/env bash
#
# Weekly in-range dependency update for the Capacitor app.
#
# Updates the npm dependencies within the semver ranges declared in package.json, then runs
# `cap sync` so the committed native projects (ios/App/CapApp-SPM/Package.swift, Package.resolved,
# android capacitor.build.gradle) stay consistent with the new versions. Range-crossing majors are
# Dependabot's job (see .github/dependabot.yml); security advisories open Dependabot PRs
# immediately regardless of either mechanism.
#
# Runs locally on macOS as well as in CI: scripts/../.github/workflows/weekly-app-dependency-update.yml
# calls it with --summary-markdown to build the PR body.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

summary_markdown_path=""

print_usage() {
  cat <<'EOF'
Usage: scripts/update-app-dependencies.sh [options]

Options:
  --summary-markdown <path>  Write an update summary as Markdown to <path> (for CI/PR bodies)
  -h, --help                 Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary-markdown)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --summary-markdown requires a file path" >&2
        exit 1
      fi
      summary_markdown_path="$2"
      shift 2
      ;;
    -h | --help)
      print_usage
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      print_usage
      exit 1
      ;;
  esac
done

echo "==> Recording outdated packages before the update"
outdated_before="$(pnpm outdated 2>/dev/null || true)"

echo "==> Updating npm dependencies within their declared ranges"
pnpm update

echo "==> Building the web app and syncing the native projects"
pnpm cap:sync

if [[ "$(uname)" == "Darwin" ]] && command -v xcodebuild > /dev/null 2>&1; then
  echo "==> Re-resolving the Swift package graph so Package.resolved matches Package.swift"
  xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
else
  echo "==> Skipping Swift package resolution (requires macOS with Xcode);" \
    "ios/**/Package.resolved may be stale" >&2
fi

echo "==> Recording packages still outdated after the update (range-crossing majors)"
outdated_after="$(pnpm outdated 2>/dev/null || true)"

if [[ -n "$summary_markdown_path" ]]; then
  mkdir -p "$(dirname "$summary_markdown_path")"
  {
    echo "## Dependency update summary"
    echo
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "In-range npm updates applied and native projects synced (\`pnpm update\` + \`cap sync\`)."
    else
      echo "Everything already up to date within the declared ranges - no changes."
    fi
    echo
    echo "### Outdated before"
    echo
    echo '```text'
    echo "${outdated_before:-none}"
    echo '```'
    echo
    echo "### Still outdated after (majors - handled by Dependabot)"
    echo
    echo '```text'
    echo "${outdated_after:-none}"
    echo '```'
  } > "$summary_markdown_path"
  echo "==> Summary written to $summary_markdown_path"
fi

echo "==> Done"
