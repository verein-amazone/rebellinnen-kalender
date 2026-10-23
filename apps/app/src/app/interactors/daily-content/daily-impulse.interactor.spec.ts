import { TestBed } from '@angular/core/testing';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';
import { ContentItemDao } from '@app/data/daos/content-item.dao';
import { ContentCatalogSync } from '@app/data/content/content-catalog-sync';
import { DailyImpulseStore } from '@app/data/stores/daily-impulse.store';
import { ImpulsePreferencesStore } from '@app/data/stores/impulse-preferences.store';

import { DailyImpulseInteractor } from './daily-impulse.interactor';
import { selectDailyImpulse } from './select-daily-impulse';

function item(overrides: Partial<ContentItemRecord> = {}): ContentItemRecord {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Titel',
    teaser: 'Teaser',
    bodyMarkdown: 'Text',
    heroImageId: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    validFrom: null,
    validTo: null,
    eligibleForDaily: true,
    video: null,
    supportServiceIds: null,
    ...overrides,
  };
}

class FakeContentItemDao {
  eligible: ContentItemRecord[] = [];
  /** Every record ever seen, independent of `eligible`'s current contents - `findById` looks a
   * stable pick up by id regardless of whether it is still in today's eligible pool. */
  private readonly all = new Map<string, ContentItemRecord>();

  listEligibleForDaily(): Promise<ContentItemRecord[]> {
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

class FakeAppLifecycle {
  private readonly handlers = new Set<() => void>();

  onResume(handler: () => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  resume(): void {
    for (const handler of this.handlers) {
      handler();
    }
  }
}

describe('DailyImpulseInteractor', () => {
  let dao: FakeContentItemDao;
  let sync: FakeContentCatalogSync;
  let lifecycle: FakeAppLifecycle;

  beforeEach(() => {
    localStorage.clear();
    dao = new FakeContentItemDao();
    sync = new FakeContentCatalogSync();
    lifecycle = new FakeAppLifecycle();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentItemDao, useValue: dao },
        { provide: ContentCatalogSync, useValue: sync },
        { provide: AppLifecycle, useValue: lifecycle },
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

  it('only picks among items whose window includes today, yearly windows in any year', async () => {
    dao.eligible = [
      item({ id: 'past', validFrom: '2027-02-01', validTo: '2027-02-10' }),
      item({ id: 'idahobit', validFrom: '--05-17', validTo: '--05-17' }),
      item({ id: 'june', validFrom: '--06-01', validTo: '--06-30' }),
    ];
    const interactor = TestBed.inject(DailyImpulseInteractor);

    await expect(interactor.featuredItem('2031-05-17')).resolves.toMatchObject({ id: 'idahobit' });
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

  it('steers the next pick away from the kind of the impulse featured before', async () => {
    const previous = item({ id: 'reb-01', kind: 'rebellin' });
    const eligible = [item({ id: 'reb-02', kind: 'rebellin' }), item({ id: 'wi-01' })];
    // A day on which the Rebell*in wins on her own, so only the previous impulse can turn it round.
    const day = ['2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09'].find(
      (today) =>
        selectDailyImpulse({ eligible, recentIds: [], previous: null, today })?.id === 'reb-02' &&
        selectDailyImpulse({ eligible, recentIds: [], previous, today })?.id === 'wi-01',
    );
    dao.eligible = [previous];
    const interactor = TestBed.inject(DailyImpulseInteractor);
    await interactor.featuredItem('2027-02-04');

    dao.eligible = eligible;
    const picked = await interactor.featuredItem(day ?? '');

    expect(day).toBeDefined();
    expect(picked?.id).toBe('wi-01');
  });

  it('reports no featured id before a pick was made, and the pick afterwards', async () => {
    dao.eligible = [item({ id: 'a' })];
    const interactor = TestBed.inject(DailyImpulseInteractor);

    expect(interactor.featuredItemId('2027-02-05')).toBeNull();

    await interactor.featuredItem('2027-02-05');

    expect(interactor.featuredItemId('2027-02-05')).toBe('a');
    // Yesterday's pick is not today's.
    expect(interactor.featuredItemId('2027-02-06')).toBeNull();
  });

  it("features a hand-picked item and serves it as today's impulse", async () => {
    dao.eligible = [item({ id: 'a' }), item({ id: 'b' })];
    const interactor = TestBed.inject(DailyImpulseInteractor);
    await interactor.featuredItem('2027-02-05');

    interactor.featureItem('2027-02-05', 'b');

    expect(interactor.featuredItemId('2027-02-05')).toBe('b');
    expect((await interactor.featuredItem('2027-02-05'))?.id).toBe('b');
    // The override is announced like any other new impulse.
    expect(interactor.shouldGreet('2027-02-05')).toBe(true);
  });

  describe('when the impulse greets', () => {
    it('greets once per opening of the app by default, and again after a return from the background', () => {
      const interactor = TestBed.inject(DailyImpulseInteractor);

      expect(interactor.shouldGreet('2027-02-05')).toBe(true);
      interactor.markGreeted('2027-02-05');
      expect(interactor.shouldGreet('2027-02-05')).toBe(false);

      lifecycle.resume();

      expect(interactor.shouldGreet('2027-02-05')).toBe(true);
    });

    it('greets only once a day when set to „Einmal am Tag“, however often the app is reopened', () => {
      TestBed.inject(ImpulsePreferencesStore).update({ greeting: 'daily' });
      const interactor = TestBed.inject(DailyImpulseInteractor);

      interactor.markGreeted('2027-02-05');
      lifecycle.resume();

      expect(interactor.shouldGreet('2027-02-05')).toBe(false);
      expect(interactor.shouldGreet('2027-02-06')).toBe(true);
    });

    it('never greets when set to „Ohne Animation“, and does not answer a shake either', () => {
      TestBed.inject(ImpulsePreferencesStore).update({ greeting: 'off' });
      const interactor = TestBed.inject(DailyImpulseInteractor);

      expect(interactor.shouldGreet('2027-02-05')).toBe(false);
      lifecycle.resume();
      expect(interactor.shouldGreet('2027-02-05')).toBe(false);
      expect(interactor.greetingEnabled()).toBe(false);
    });

    it('records the day as seen when it greets, so switching to „Einmal am Tag“ does not repeat it', () => {
      const interactor = TestBed.inject(DailyImpulseInteractor);
      interactor.markGreeted('2027-02-05');

      TestBed.inject(ImpulsePreferencesStore).update({ greeting: 'daily' });

      expect(TestBed.inject(DailyImpulseStore).hasSeen('2027-02-05')).toBe(true);
      expect(interactor.shouldGreet('2027-02-05')).toBe(false);
    });
  });
});
