import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REGION_ORDER } from './support-services.interactor';

/**
 * Guards the authored Anlaufstellen content itself, not the code that reads it.
 *
 * The catalog is a hand-edited JSON asset with no build step and no schema beyond the gateway's
 * runtime type guards, which only drop a malformed entry - they cannot see that two entries in the
 * same region picked the same emoji, or that a `website` action lost its scheme. Both have already
 * happened by hand. The rules live in `docs/content-authoring.md`; this spec is what enforces them.
 *
 * Read with `node:fs` rather than imported: the file sits outside `src/`, and a spec under
 * `interactors/**` may not reach into `data/**` for the gateway's types anyway.
 */
const CATALOG_PATH = join(process.cwd(), 'public/support-services/catalog.json');

interface CatalogAction {
  readonly type: string;
  readonly label: string;
  readonly uri: string;
  readonly displayValue?: string;
}

interface CatalogItem {
  readonly id: string;
  readonly region: string;
  readonly name: string;
  readonly teaser: string;
  readonly icon: string;
  readonly actions: readonly CatalogAction[];
}

/**
 * Entries that share an emoji inside one region on purpose. The rule is one emoji per entry per
 * region; the exception is one organisation running several offers there, where a shared emoji is
 * the point. Add to this list only with the organisation named.
 */
const SHARED_EMOJI_BY_DESIGN: readonly (readonly string[])[] = [
  // Frauengesundheitszentrum FEM: one organisation, two hospital locations in Vienna.
  ['fem', 'fem-sued'],
];

/**
 * The one entry allowed a plain `http://` link: `wiff-vk.at` serves a certificate issued for a
 * different host, so HTTPS fails outright and the `http://` URL is the only one that resolves.
 * Drop this exception once the organisation fixes its certificate.
 */
const HTTP_ONLY_BY_NECESSITY: readonly string[] = ['wiff-voelkermarkt'];

const items = (JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as { items: CatalogItem[] }).items;

function sharedEmojiPartners(id: string): readonly string[] {
  return SHARED_EMOJI_BY_DESIGN.find((group) => group.includes(id)) ?? [];
}

describe('public/support-services/catalog.json', () => {
  it('is not empty', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('gives every entry a unique, kebab-case id', () => {
    const ids = items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('only uses regions the filter knows about', () => {
    const known = new Set(REGION_ORDER.map((region) => region.id));

    for (const item of items) {
      expect(known, `${item.id} claims an unknown region`).toContain(item.region);
    }
  });

  it('gives every entry a non-empty, trimmed name and teaser', () => {
    for (const item of items) {
      expect(item.name.trim(), `${item.id} name`).toBe(item.name);
      expect(item.name.length, `${item.id} name`).toBeGreaterThan(0);
      expect(item.teaser.trim(), `${item.id} teaser`).toBe(item.teaser);
      expect(item.teaser.length, `${item.id} teaser`).toBeGreaterThan(0);
    }
  });

  it('keeps every emoji unique within its region, bar the documented shared ones', () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];

    for (const item of items) {
      const key = `${item.region}|${item.icon}`;
      const owner = owners.get(key);
      if (owner !== undefined && !sharedEmojiPartners(item.id).includes(owner)) {
        clashes.push(`${item.region}: ${item.id} reuses ${item.icon} from ${owner}`);
      }
      owners.set(key, item.id);
    }

    // Pick another emoji, or add the pair to SHARED_EMOJI_BY_DESIGN if it is one organisation.
    expect(clashes).toEqual([]);
  });

  it('gives every action a uri matching its type', () => {
    for (const item of items) {
      for (const action of item.actions) {
        const where = `${item.id} ${action.type} action`;
        if (action.type === 'phone') {
          expect(action.uri, where).toMatch(/^tel:/);
        } else if (action.type === 'sms') {
          expect(action.uri, where).toMatch(/^sms:/);
        } else if (HTTP_ONLY_BY_NECESSITY.includes(item.id)) {
          expect(action.uri, where).toMatch(/^http:\/\//);
        } else {
          expect(action.uri, where).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it('keeps a phone/sms displayValue in step with the digits its uri dials', () => {
    for (const item of items) {
      for (const action of item.actions) {
        if (action.displayValue === undefined) {
          continue;
        }

        const dialled = action.uri.replace(/^(tel|sms):/, '');
        const shown = action.displayValue.replace(/\D/g, '');
        // A number is shown in Austrian national form (`0662 442255`) but dialled in E.164
        // (`+43662442255`) - except short numbers like `147` and the `sms:` URIs, which are
        // authored national. Accept either, but the digits themselves must line up: a card that
        // shows one number and dials another is the worst failure this catalog can have.
        const asInternational = shown.startsWith('0') ? `+43${shown.slice(1)}` : shown;
        expect([shown, asInternational], `${item.id}: displayValue does not match uri`).toContain(
          dialled,
        );
      }
    }
  });
});
