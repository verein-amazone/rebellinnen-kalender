import { TestBed } from '@angular/core/testing';

import { CalendarRepository } from '@app/data/calendar/calendar.repository';
import type { Catalog } from '@app/data/calendar/curated/curated-calendar-sync';
import { NativeEmojiPicker } from '@app/cross-cutting/infrastructure/emoji-picker';
import {
  IcsHttpGateway,
  type IcsDownloadRequest,
  type IcsDownloadResult,
} from '@app/data/gateways/ics-http.gateway';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';

import { CuratedCalendarsInteractor } from './curated-calendars.interactor';

const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//test//DE',
  'BEGIN:VEVENT',
  'UID:holiday@wien',
  'SUMMARY:Nationalfeiertag',
  'DTSTART;VALUE=DATE:20261026',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const CATALOG: Catalog = {
  version: 1,
  sources: [
    {
      id: 'at-public-holidays',
      name: 'Feiertage Österreich',
      description: 'Gesetzliche Feiertage in Österreich.',
      url: 'webcal://www.wien.gv.at/spezial/daten/ics/feiertage.ics',
      color: '#1565C0',
      emoji: '🇦🇹',
    },
  ],
};

class FakeEmojiPicker {
  result: string | null = '🌻';

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.result);
  }
}

class FakeIcsHttpGateway {
  result: IcsDownloadResult = { status: 'ok', body: FEED, etag: null, lastModified: null };
  requests: IcsDownloadRequest[] = [];

  download(request: IcsDownloadRequest): Promise<IcsDownloadResult> {
    this.requests.push(request);
    return Promise.resolve(this.result);
  }
}

function mockFetch(catalog: Catalog | null, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: ok && catalog !== null,
      json: () => Promise.resolve(catalog),
    }),
  );
}

describe('CuratedCalendarsInteractor', () => {
  let database: InMemorySqliteDatabase;
  let interactor: CuratedCalendarsInteractor;
  let http: FakeIcsHttpGateway;

  beforeEach(() => {
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    localStorage.clear();
    http = new FakeIcsHttpGateway();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SQLITE_DATABASE, useValue: database },
        { provide: IcsHttpGateway, useValue: http },
        { provide: NativeEmojiPicker, useValue: new FakeEmojiPicker() },
      ],
    });

    interactor = TestBed.inject(CuratedCalendarsInteractor);
    mockFetch(CATALOG);
  });

  afterEach(() => {
    database.close();
    vi.unstubAllGlobals();
  });

  it('seeds, downloads and lists a curated source with its catalog description', async () => {
    const rows = await interactor.listForManagement();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Feiertage Österreich',
      description: 'Gesetzliche Feiertage in Österreich.',
      color: '#1565C0',
      emoji: '🇦🇹',
      enabled: true,
      state: 'ok',
    });
    expect(http.requests).toHaveLength(1);
  });

  it('lists curated sources in catalog order, not in the order they were seeded', async () => {
    // The order the sources were seeded in: holidays first, as on an install predating the
    // catalog version that added the Amazone calendar.
    await interactor.listForManagement();
    mockFetch({
      version: 2,
      sources: [
        {
          id: 'amazone-rebellinnen-kalender',
          name: 'Rebell*innen Kalender',
          description: 'Veranstaltungen und Aktionen vom Verein Amazone.',
          url: 'https://example.org/amazone.ics',
          color: '#7B3FA8',
          emoji: '✊',
        },
        ...CATALOG.sources,
      ],
    });

    const rows = await interactor.listForManagement();

    expect(rows.map((row) => row.name)).toEqual(['Rebell*innen Kalender', 'Feiertage Österreich']);
  });

  it('never exposes add or remove on its surface', () => {
    expect((interactor as unknown as { add?: unknown }).add).toBeUndefined();
    expect((interactor as unknown as { remove?: unknown }).remove).toBeUndefined();
  });

  it('setEnabled and updateIdentity delegate to the underlying ICS subscription', async () => {
    const [row] = await interactor.listForManagement();

    await interactor.setEnabled(row.id, false);
    await interactor.updateIdentity(row.id, { name: 'Feiertage', color: '#000000', emoji: '🎉' });

    const repository = TestBed.inject(CalendarRepository);
    const source = await repository.findSource(row.id);
    const [calendar] = await repository.listCalendarsOfSource(row.id);
    expect(source!.enabled).toBe(false);
    expect(calendar).toMatchObject({ name: 'Feiertage', color: '#000000', emoji: '🎉' });
  });

  it('resolves the emoji the picker returns', async () => {
    await expect(interactor.pickEmoji()).resolves.toBe('🌻');
  });
});
