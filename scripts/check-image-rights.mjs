#!/usr/bin/env node
// Fails while any image in public/image-attributions.json still waits for its rights review (#11):
// an entry with `needsReview`, or a licence recorded as `unclear`. Such an image must not reach
// the stores, so CI runs this on every pull request into `main` - the merge that releases.
//
// It is not run into `dev`: tester builds may carry images under review, and the unit tests
// (src/app/data/content/image-attributions.content.spec.ts) already check that every entry is
// well-formed.
//
//   node scripts/check-image-rights.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(import.meta.dirname, '..', 'public', 'image-attributions.json');

/** @type {{ path: string, license: string, needsReview?: boolean, reviewNote?: string }[]} */
const attributions = JSON.parse(readFileSync(FILE, 'utf8'));

const open = attributions.filter((a) => a.needsReview === true || a.license === 'unclear');

if (open.length > 0) {
  const lines = open.map((a) => `- ${a.path} (${a.license}): ${a.reviewNote ?? 'needs review'}`);
  console.error(
    `${open.length} of ${attributions.length} images still need their rights reviewed:\n` +
      `${lines.join('\n')}\n\n` +
      'Confirm each one, then remove `needsReview` and `reviewNote` - or remove the image. ' +
      'See docs/content-authoring.md.',
  );
  process.exit(1);
}
console.log(`All ${attributions.length} image rights are reviewed.`);
