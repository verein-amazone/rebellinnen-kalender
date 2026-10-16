import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

/**
 * Mirrors `DEVELOPER_TOOLS_ENABLED` for the build under test. Locally the suite runs against
 * `ng serve`, which always shows the developer tools; CI serves a production build, which shows them
 * only for a prerelease version. A stable version reaches `dev` when a release from `main` is
 * merged back, and the specs that use the developer tools must not fail in that window.
 */
export const developerToolsEnabled = !process.env['CI'] || /^\d+\.\d+\.\d+-/.test(version);
