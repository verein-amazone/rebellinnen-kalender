import { TestBed } from '@angular/core/testing';

import type { ContentItemRecord } from '@app/data/entities/content-item.record';
import { ContentItemDao } from '@app/data/daos/content-item.dao';
import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { DailyImpulseStore } from '@app/data/stores/daily-impulse.store';

import { DailyImpulseInteractor } from './daily-impulse.interactor';

function item(overrides: Partial<ContentItemRecord> = {}): ContentItemRecord {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Titel',
    teaser: 'Teaser',
    bodyMarkdown: 'Text',
    imagePath: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    validFrom: null,
    validTo: null,
    eligibleForDaily: true,
    ...overrides,
  };
}

class FakeContentItemDao {
  eligible: ContentItemRecord[] = [];
  /** Every record ever seen, independent of `eligible`'s current contents - `findById` looks a
   * stable pick up by id regardless of whether it is still in today's eligible pool. */
  private readonly all = new Map<string, ContentItemRecord>();

  listEligibleForDay(): Promise<ContentItemRecord[]> {
    for (const record of this.eligible) {
      this.all.set(record.id, record);
    }
    return Promise.resolve(this.eligible);
  }

  findById(id: string): Promise<ContentItemRecord | null> {
    return Promise.resolve(
      this.all.get(id) ?? this.eligible.find((entry) => entry.id === id) ?? null,
    );
  }
}

class FakeContentCatalogSync {
  ensureSynced = vi.fn().mockResolvedValue(undefined);
}

describe('DailyImpulseInteractor', () => {
  let dao: FakeContentItemDao;
  let sync: FakeContentCatalogSync;

  beforeEach(() => {
    localStorage.clear();
    dao = new FakeContentItemDao();
    sync = new FakeContentCatalogSync();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentItemDao, useValue: dao },
        { provide: ContentCatalogSync, useValue: sync },
      ],
    });
  });

  it('reconciles the catalog before reading', async () => {
    const interactor = TestBed.inject(DailyImpulseInteractor);

    await interactor.featuredItem('2027-02-05');

    expect(sync.ensureSynced).toHaveBeenCalled();
  });

  it('returns null when nothing is eligible for today', async () => {
    const interactor = TestBed.inject(DailyImpulseInteractor);

    await expect(interactor.featuredItem('2027-02-05')).resolves.toBeNull();
  });

  it('picks and persists an item on first call for a new day', async () => {
    dao.eligible = [item({ id: 'a' }), item({ id: 'b' })];
    const interactor = TestBed.inject(DailyImpulseInteractor);

    const picked = await interactor.featuredItem('2027-02-05');

    expect(picked).not.toBeNull();
    expect(TestBed.inject(DailyImpulseStore).pick()).toEqual({
      day: '2027-02-05',
      itemId: picked?.id,
    });
  });

  it('returns the same stable item on repeated calls for the same day even if the pool changes', async () => {
    const records = [item({ id: 'a' }), item({ id: 'b' })];
    dao.eligible = records;
    const interactor = TestBed.inject(DailyImpulseInteractor);

    const first = await interactor.featuredItem('2027-02-05');

    // The pool shrinks to just the other item - the stable pick must still win. `findById` is what
    // resolves the stable pick, so as long as its record still exists the exact pool contents here
    // don't matter.
    dao.eligible = records.filter((entry) => entry.id !== first?.id);

    const second = await interactor.featuredItem('2027-02-05');

    expect(second?.id).toBe(first?.id);
  });

  it('picks again once the day changes', async () => {
    dao.eligible = [item({ id: 'a' })];
    const interactor = TestBed.inject(DailyImpulseInteractor);
    await interactor.featuredItem('2027-02-05');

    dao.eligible = [item({ id: 'b' })];
    const picked = await interactor.featuredItem('2027-02-06');

    expect(picked?.id).toBe('b');
    expect(TestBed.inject(DailyImpulseStore).pick()).toEqual({ day: '2027-02-06', itemId: 'b' });
  });
});
