import { TestBed } from '@angular/core/testing';

import { CalendarRepository } from '@app/data/calendar/calendar.repository';
import { IcsSubscriptionDao } from '@app/data/daos/ics-subscription.dao';
import { OccurrenceDao } from '@app/data/daos/occurrence.dao';
import { NativeEmojiPicker } from '@app/cross-cutting/infrastructure/emoji-picker';
import {
  IcsDownloadError,
  IcsHttpGateway,
  type IcsDownloadRequest,
  type IcsDownloadResult,
} from '@app/data/gateways/ics-http.gateway';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';
import {
  IcsSubscriptionInteractor,
  IcsSubscriptionNameInvalidError,
  IcsUrlInvalidError,
} from './ics-subscription.interactor';

class FakeEmojiPicker {
  result: string | null = '🌻';

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.result);
  }
}

const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//test//DE',
  'BEGIN:VEVENT',
  'UID:plenum@verein',
  'SUMMARY:Plenum',
  'DTSTART:20261012T170000Z',
  'DTEND:20261012T190000Z',
  'RRULE:FREQ=WEEKLY;COUNT=4',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

class FakeIcsHttpGateway {
  result: IcsDownloadResult | 'error' = {
    status: 'ok',
    body: FEED,
    etag: '"v1"',
    lastModified: null,
  };
  lastRequest: IcsDownloadRequest | null = null;
  downloads = 0;
  /** Set to hold every download open, so two callers can overlap deterministically. */
  gate: Promise<void> | null = null;

  async download(request: IcsDownloadRequest): Promise<IcsDownloadResult> {
    this.lastRequest = request;
    this.downloads += 1;

    if (this.gate !== null) {
      await this.gate;
    }
    if (this.result === 'error') {
      throw new IcsDownloadError('Der Kalender konnte nicht geladen werden.');
    }
    return this.result;
  }
}

describe('IcsSubscriptionInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: IcsSubscriptionInteractor;
  let http: FakeIcsHttpGateway;
  let repository: CalendarRepository;
  let occurrences: OccurrenceDao;
  let subscriptions: IcsSubscriptionDao;
  let emojiPicker: FakeEmojiPicker;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    http = new FakeIcsHttpGateway();
    emojiPicker = new FakeEmojiPicker();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        { provide: IcsHttpGateway, useValue: http },
        { provide: NativeEmojiPicker, useValue: emojiPicker },
      ],
    });

    interactor = TestBed.inject(IcsSubscriptionInteractor);
    repository = TestBed.inject(CalendarRepository);
    occurrences = TestBed.inject(OccurrenceDao);
    subscriptions = TestBed.inject(IcsSubscriptionDao);
  });

  afterEach(() => {
    database.close();
  });

  it('rejects an unusable link before anything is stored', async () => {
    await expect(
      interactor.add('Schule', 'http://insecure.example/cal.ics'),
    ).rejects.toBeInstanceOf(IcsUrlInvalidError);
    await expect(repository.listIcsSubscriptions()).resolves.toEqual([]);
  });

  it('urlError names the same links add() rejects, and passes the ones it accepts', () => {
    expect(interactor.urlError('https://example.org/cal.ics')).toBeNull();
    expect(interactor.urlError('webcal://example.org/cal.ics')).toBeNull();
    expect(interactor.urlError('http://insecure.example/cal.ics')).not.toBeNull();
    expect(interactor.urlError('nicht-mal-eine-adresse')).not.toBeNull();
  });

  it('rejects a blank name before anything is stored, instead of creating an unnamed source', async () => {
    await expect(interactor.add('   ', 'https://example.org/cal.ics')).rejects.toBeInstanceOf(
      IcsSubscriptionNameInvalidError,
    );
    await expect(repository.listIcsSubscriptions()).resolves.toEqual([]);
  });

  it('trims the name before storing it on both the source and its calendar', async () => {
    const { subscriptionId } = await interactor.add('  Verein  ', 'https://example.org/cal.ics');

    const source = await repository.findSource(subscriptionId);
    expect(source!.name).toBe('Verein');
  });

  it('adds a subscription, downloads and materializes it', async () => {
    const { subscriptionId, outcome } = await interactor.add(
      'Verein',
      'webcal://example.org/cal.ics',
    );

    expect(outcome).toBe('updated');
    const rows = await occurrences.listInRange('2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z');
    expect(rows).toHaveLength(4);
    expect(rows[0].id).toBe(`ics:${subscriptionId}:plenum@verein#2026-10-12T17:00:00Z`);
    expect(rows[0].sourceType).toBe('ics');
    expect(rows[0].provenance).toBe('generated');

    const stored = await subscriptions.find(subscriptionId);
    expect(stored!.url).toBe('https://example.org/cal.ics');
    expect(stored!.rawIcs).toBe(FEED);
    expect(stored!.etag).toBe('"v1"');
    expect(stored!.lastSuccessAt).not.toBeNull();
  });

  it('warns about entries the parser had to skip, without failing the refresh', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    http.result = {
      status: 'ok',
      body: [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//test//DE',
        'BEGIN:VEVENT',
        'SUMMARY:No UID',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:plenum@verein',
        'SUMMARY:Plenum',
        'DTSTART:20261012T170000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
      etag: null,
      lastModified: null,
    };

    const { outcome } = await interactor.add('Verein', 'https://example.org/cal.ics');

    expect(outcome).toBe('updated');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('treats a 304 as unchanged and sends the cached validators', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    http.result = { status: 'not-modified' };

    const outcome = await interactor.refresh(subscriptionId);

    expect(outcome).toBe('unchanged');
    expect(http.lastRequest!.etag).toBe('"v1"');
    await expect(
      occurrences.listInRange('2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z'),
    ).resolves.toHaveLength(4);
  });

  it('a 304 counts as a successful check, so a long-unchanged feed stops being due', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    // The situation the bug lived in: the content last changed longer ago than the refresh
    // interval, so gating on that alone makes the feed due no matter how recently it was checked.
    await database.run(`UPDATE ics_subscriptions SET last_success_at = ? WHERE id = ?`, [
      new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
      subscriptionId,
    ]);

    http.result = { status: 'not-modified' };
    await interactor.refresh(subscriptionId);

    const subscription = await repository.findIcsSubscription(subscriptionId);
    expect(subscription!.lastCheckedAt).not.toBeNull();

    // Previously this re-downloaded on every launch and every foreground, forever.
    const before = http.downloads;
    await interactor.refreshAllDue();
    expect(http.downloads).toBe(before);
  });

  it('still refreshes a feed whose last check is older than the interval', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    await database.run(
      `UPDATE ics_subscriptions SET last_success_at = ?, last_checked_at = ? WHERE id = ?`,
      [
        new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        subscriptionId,
      ],
    );

    const before = http.downloads;
    await interactor.refreshAllDue();

    expect(http.downloads).toBe(before + 1);
  });

  it('shares one download between concurrent refreshes of the same subscription', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    http.result = { status: 'not-modified' };

    let open = () => undefined as void;
    http.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const before = http.downloads;

    // Two callers overlapping is the normal case: the foreground auto-refresh and a screen that
    // force-refreshes what the curated sync just reported.
    const both = Promise.all([
      interactor.refresh(subscriptionId),
      interactor.refresh(subscriptionId, { force: true }),
    ]);
    open();

    await expect(both).resolves.toEqual(['unchanged', 'unchanged']);
    expect(http.downloads).toBe(before + 1);
  });

  it('starts a new download once the previous one has settled', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    http.result = { status: 'not-modified' };

    const before = http.downloads;
    await interactor.refresh(subscriptionId);
    await interactor.refresh(subscriptionId);

    // Sharing is only for calls that overlap - it must not turn into a cache.
    expect(http.downloads).toBe(before + 2);
  });

  it('an updated feed replaces the previous revision atomically', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    http.result = {
      status: 'ok',
      body: FEED.replace('COUNT=4', 'COUNT=2').replace('SUMMARY:Plenum', 'SUMMARY:Plenum neu'),
      etag: '"v2"',
      lastModified: null,
    };

    const outcome = await interactor.refresh(subscriptionId, { force: true });

    expect(outcome).toBe('updated');
    const rows = await occurrences.listInRange('2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z');
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Plenum neu');
  });

  it('a malformed feed preserves the previous revision and flags the source as stale', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    http.result = { status: 'ok', body: '<html>kaputt</html>', etag: null, lastModified: null };

    const outcome = await interactor.refresh(subscriptionId, { force: true });

    expect(outcome).toBe('failed');
    await expect(
      occurrences.listInRange('2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z'),
    ).resolves.toHaveLength(4);

    const source = await repository.findSource(subscriptionId);
    expect(source!.state).toBe('stale');
    const stored = await subscriptions.find(subscriptionId);
    expect(stored!.rawIcs).toBe(FEED);
    expect(stored!.lastError).not.toBeNull();
  });

  it('an unavailable server on first download leaves an error state, not a broken half-source', async () => {
    http.result = 'error';

    const { subscriptionId, outcome } = await interactor.add(
      'Verein',
      'https://example.org/cal.ics',
    );

    expect(outcome).toBe('failed');
    const source = await repository.findSource(subscriptionId);
    expect(source!.state).toBe('error');
  });

  it('never exposes the full URL in the recorded error', async () => {
    const { subscriptionId } = await interactor.add(
      'Verein',
      'https://example.org/secret-token-xyz/cal.ics',
    );
    http.result = 'error';

    await interactor.refresh(subscriptionId, { force: true });

    const stored = await subscriptions.find(subscriptionId);
    expect(stored!.lastError).not.toContain('secret-token-xyz');
    expect(stored!.lastError).toContain('https://example.org');
  });

  it('keeps identical UIDs of different subscriptions apart', async () => {
    const first = await interactor.add('Verein A', 'https://a.example.org/cal.ics');
    const second = await interactor.add('Verein B', 'https://b.example.org/cal.ics');

    const rows = await occurrences.listInRange('2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z');
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((row) => row.id)).size).toBe(8);
    expect(rows.some((row) => row.sourceId === first.subscriptionId)).toBe(true);
    expect(rows.some((row) => row.sourceId === second.subscriptionId)).toBe(true);
  });

  it('removing a subscription removes its source, data and derived rows', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    await interactor.remove(subscriptionId);

    await expect(repository.findSource(subscriptionId)).resolves.toBeNull();
    await expect(subscriptions.find(subscriptionId)).resolves.toBeNull();
    await expect(
      occurrences.listInRange('2026-10-01T00:00:00Z', '2026-11-15T00:00:00Z'),
    ).resolves.toEqual([]);
  });

  it('updateIdentity changes the calendar name, colour and emoji', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    await interactor.updateIdentity(subscriptionId, {
      name: 'Vereinstermine',
      color: '#336699',
      emoji: '🗓️',
    });

    const rows = await repository.listIcsSubscriptions();
    const calendar = await repository.listCalendarsOfSource(subscriptionId);
    expect(calendar[0]).toMatchObject({ name: 'Vereinstermine', color: '#336699', emoji: '🗓️' });
    expect(rows).toHaveLength(1);
  });

  it('updateIdentity rejects a blank name, leaving the previous identity untouched', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    await expect(
      interactor.updateIdentity(subscriptionId, { name: '  ', color: null, emoji: null }),
    ).rejects.toBeInstanceOf(IcsSubscriptionNameInvalidError);

    const calendar = await repository.listCalendarsOfSource(subscriptionId);
    expect(calendar[0].name).toBe('Verein');
  });

  it('setEnabled(false) disables both the source and its calendar together', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    await interactor.setEnabled(subscriptionId, false);

    const source = await repository.findSource(subscriptionId);
    const calendar = await repository.listCalendarsOfSource(subscriptionId);
    expect(source!.enabled).toBe(false);
    expect(calendar[0].enabled).toBe(false);
  });

  it('setEnabled(true) re-enables a previously disabled subscription', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    await interactor.setEnabled(subscriptionId, false);

    await interactor.setEnabled(subscriptionId, true);

    const source = await repository.findSource(subscriptionId);
    const calendar = await repository.listCalendarsOfSource(subscriptionId);
    expect(source!.enabled).toBe(true);
    expect(calendar[0].enabled).toBe(true);
  });

  it('resolves the emoji the picker returns', async () => {
    emojiPicker.result = '🌻';

    await expect(interactor.pickEmoji()).resolves.toBe('🌻');
  });

  it('resolves null when the picker is dismissed without a selection', async () => {
    emojiPicker.result = null;

    await expect(interactor.pickEmoji()).resolves.toBeNull();
  });

  it('listForManagement lists every ics subscription joined with its calendar and state', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    const rows = await interactor.listForManagement();

    expect(rows).toEqual([
      {
        id: subscriptionId,
        name: 'Verein',
        color: null,
        emoji: null,
        enabled: true,
        state: 'ok',
        lastError: null,
      },
    ]);
  });

  it('listForManagement excludes curated subscriptions seeded from the catalog', async () => {
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');
    await repository.createIcsSubscription(
      {
        id: 'curated-1',
        type: 'ics',
        name: 'Feiertage Österreich',
        enabled: true,
        state: 'ok',
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-08-01T09:00:00.000Z',
      },
      {
        id: 'ics-cal:curated-1',
        sourceId: 'curated-1',
        name: 'Feiertage Österreich',
        color: '#1565C0',
        emoji: '🇦🇹',
        enabled: true,
        writable: false,
        externalId: null,
        nativeSourceId: null,
        nativeSourceName: null,
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-08-01T09:00:00.000Z',
      },
      {
        id: 'curated-1',
        url: 'https://www.wien.gv.at/spezial/daten/ics/feiertage.ics',
        allowInsecure: false,
        etag: null,
        lastModified: null,
        lastSuccessAt: null,
        lastCheckedAt: null,
        lastAttemptAt: null,
        lastError: null,
        activeRevisionId: null,
        rawIcs: null,
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-08-01T09:00:00.000Z',
        curatedId: 'at-public-holidays',
      },
    );

    const rows = await interactor.listForManagement();

    expect(rows.map((row) => row.id)).toEqual([subscriptionId]);
  });

  it('listForManagement reports an error subscription with its last error message', async () => {
    http.result = 'error';
    const { subscriptionId } = await interactor.add('Verein', 'https://example.org/cal.ics');

    const rows = await interactor.listForManagement();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(subscriptionId);
    expect(rows[0].state).toBe('error');
    expect(rows[0].lastError).not.toBeNull();
  });
});
