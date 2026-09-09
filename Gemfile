# fastlane is the only Ruby dependency of this repository: it owns the store uploads
# (`fastlane/Fastfile`), and nothing in the app itself is written in Ruby. Everything else stays on
# pnpm.
#
# The lockfile is committed and Dependabot keeps it current (see .github/dependabot.yml); CI installs
# with `bundle install --deployment`, so a run can never resolve a version that was not reviewed.
source 'https://rubygems.org'

gem 'fastlane', '~> 2.239'
