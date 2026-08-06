import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { PositionAssignment, PositionRange } from '@app/data/daos/reminder.dao';
import { ReminderDao } from '@app/data/daos/reminder.dao';
import type { ReminderRecord } from '@app/data/entities/reminder.record';
import {
  DEFAULT_REMINDER_PREFERENCES,
  type ReminderPreferences,
} from '@app/data/stores/reminder-preferences';
import { RemindersStore } from '@app/data/stores/reminders.store';

import {
  REMINDER_TEXT_MAX_LENGTH,
  ReminderListInteractor,
  ReminderTextInvalidError,
} from './reminder-list.interactor';

function record(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'id-1',
    text: 'Blumen gießen',
    completedAt: null,
    createdAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-05T10:00:00.000Z',
    position: 1000,
    ...overrides,
  };
}

class FakeReminderDao {
  records: ReminderRecord[] = [];
  readonly completionUpdates: {
    id: string;
    completedAt: string | null;
    position: number;
    updatedAt: string;
  }[] = [];
  readonly textUpdates: { id: string; text: string; updatedAt: string }[] = [];
  readonly positionUpdates: { id: string; position: number; updatedAt: string }[] = [];
  readonly reassignments: PositionAssignment[][] = [];
  readonly deletions: string[] = [];

  listAll(): Promise<ReminderRecord[]> {
    // The real DAO sorts by section and then by position; the fake has to as well, or the
    // neighbour arithmetic would be tested against an order the database never returns.
    const sorted = [...this.records].sort((a, b) => {
      const section = Number(a.completedAt !== null) - Number(b.completedAt !== null);
      return section !== 0 ? section : a.position - b.position;
    });
    return Promise.resolve(sorted);
  }

  insert(entry: ReminderRecord): Promise<void> {
    this.records = [...this.records, entry];
    return Promise.resolve();
  }

  updateText(id: string, text: string, updatedAt: string): Promise<void> {
    this.textUpdates.push({ id, text, updatedAt });
    return Promise.resolve();
  }

  updateCompletion(
    id: string,
    completedAt: string | null,
    position: number,
    updatedAt: string,
  ): Promise<void> {
    this.completionUpdates.push({ id, completedAt, position, updatedAt });
    this.records = this.records.map((entry) =>
      entry.id === id ? { ...entry, completedAt, position, updatedAt } : entry,
    );
    return Promise.resolve();
  }

  updatePosition(id: string, position: number, updatedAt: string): Promise<void> {
    this.positionUpdates.push({ id, position, updatedAt });
    this.records = this.records.map((entry) =>
      entry.id === id ? { ...entry, position, updatedAt } : entry,
    );
    return Promise.resolve();
  }

  reassignPositions(assignments: readonly PositionAssignment[], updatedAt: string): Promise<void> {
    this.reassignments.push([...assignments]);
    this.records = this.records.map((entry) => {
      const assignment = assignments.find((candidate) => candidate.id === entry.id);
      return assignment === undefined
        ? entry
        : { ...entry, position: assignment.position, updatedAt };
    });
    return Promise.resolve();
  }

  selectPositionRange(completed: boolean): Promise<PositionRange> {
    const section = this.records.filter((entry) => (entry.completedAt !== null) === completed);
    if (section.length === 0) {
      return Promise.resolve({ min: null, max: null });
    }

    const positions = section.map((entry) => entry.position);
    return Promise.resolve({ min: Math.min(...positions), max: Math.max(...positions) });
  }

  delete(id: string): Promise<void> {
    this.deletions.push(id);
    this.records = this.records.filter((entry) => entry.id !== id);
    return Promise.resolve();
  }
}

describe('ReminderListInteractor', () => {
  let dao: FakeReminderDao;
  let preferences: ReturnType<typeof signal<ReminderPreferences>>;
  let interactor: ReminderListInteractor;

  beforeEach(() => {
    dao = new FakeReminderDao();
    preferences = signal<ReminderPreferences>(DEFAULT_REMINDER_PREFERENCES);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ReminderDao, useValue: dao },
        { provide: RemindersStore, useValue: { preferences: preferences.asReadonly() } },
      ],
    });

    interactor = TestBed.inject(ReminderListInteractor);
  });

  it('adds a trimmed entry as open, with an identifier and timestamps', async () => {
    await interactor.add('  Blumen gießen  ');

    const [entry] = dao.records;
    expect(entry.text).toBe('Blumen gießen');
    expect(entry.completedAt).toBeNull();
    expect(entry.id).not.toBe('');
    expect(entry.createdAt).toBe(entry.updatedAt);
  });

  it('gives every entry its own identifier', async () => {
    await interactor.add('Erstens');
    await interactor.add('Zweitens');

    expect(dao.records[0].id).not.toBe(dao.records[1].id);
  });

  it('rejects text a screen should never submit, without writing anything', async () => {
    await expect(interactor.add('   ')).rejects.toBeInstanceOf(ReminderTextInvalidError);
    await expect(interactor.add('x'.repeat(REMINDER_TEXT_MAX_LENGTH + 1))).rejects.toBeInstanceOf(
      ReminderTextInvalidError,
    );
    await expect(interactor.rename('id-1', '')).rejects.toBeInstanceOf(ReminderTextInvalidError);

    expect(dao.records).toEqual([]);
    expect(dao.textUpdates).toEqual([]);
  });

  it('presents entries with a completion flag and without the timestamps or the position', async () => {
    dao.records = [
      record({ id: 'a', text: 'Offen' }),
      record({
        id: 'b',
        text: 'Erledigt',
        completedAt: new Date().toISOString(),
        position: 2000,
      }),
    ];

    expect(await interactor.list()).toEqual([
      { id: 'a', text: 'Offen', completed: false },
      { id: 'b', text: 'Erledigt', completed: true },
    ]);
  });

  it('renames and deletes an entry', async () => {
    await interactor.rename('a', '  Neuer Text ');
    await interactor.remove('a');

    expect(dao.textUpdates[0].text).toBe('Neuer Text');
    expect(dao.deletions).toEqual(['a']);
  });

  describe('placement of new entries', () => {
    it('puts a new entry above the first open one by default', async () => {
      dao.records = [record({ id: 'a', position: 1000 }), record({ id: 'b', position: 2000 })];

      await interactor.add('Neu');

      expect(dao.records.at(-1)?.position).toBe(0);
      expect((await interactor.list())[0].text).toBe('Neu');
    });

    it('puts a new entry below the last open one when the preference says so', async () => {
      preferences.set({ ...DEFAULT_REMINDER_PREFERENCES, newItemPlacement: 'bottom' });
      dao.records = [record({ id: 'a', position: 1000 }), record({ id: 'b', position: 2000 })];

      await interactor.add('Neu');

      expect(dao.records.at(-1)?.position).toBe(3000);
      expect((await interactor.list()).at(-1)?.text).toBe('Neu');
    });

    it('starts an empty list at a positive position', async () => {
      await interactor.add('Neu');

      expect(dao.records[0].position).toBe(-1000);
    });

    it('ignores the completed entries when placing a new open one', async () => {
      dao.records = [
        record({ id: 'done', completedAt: new Date().toISOString(), position: -9000 }),
        record({ id: 'open', position: 1000 }),
      ];

      await interactor.add('Neu');

      expect(dao.records.at(-1)?.position).toBe(0);
    });
  });

  describe('completing and reopening', () => {
    it('completes an entry with a timestamp and reopens it with none', async () => {
      dao.records = [record({ id: 'a' })];

      await interactor.complete('a');
      await interactor.reopen('a');

      expect(dao.completionUpdates[0].completedAt).not.toBeNull();
      expect(dao.completionUpdates[0].completedAt).toBe(dao.completionUpdates[0].updatedAt);
      expect(dao.completionUpdates[1].completedAt).toBeNull();
      expect(dao.completionUpdates[1].updatedAt).not.toBe('');
    });

    it('puts a completed entry above every other completed one, however old it is', async () => {
      const today = new Date().toISOString();
      dao.records = [
        record({ id: 'old', createdAt: '2020-01-01T10:00:00.000Z', position: 1000 }),
        record({ id: 'done-a', completedAt: today, position: 500 }),
        record({ id: 'done-b', completedAt: today, position: 700 }),
      ];

      await interactor.complete('old');

      expect(dao.completionUpdates).toHaveLength(1);
      expect(dao.completionUpdates[0].position).toBe(-500);
      expect((await interactor.list()).map((entry) => entry.id)).toEqual([
        'old',
        'done-a',
        'done-b',
      ]);
    });

    it('puts a completed entry below the others when the preference says so', async () => {
      preferences.set({ ...DEFAULT_REMINDER_PREFERENCES, completedItemPlacement: 'bottom' });
      const today = new Date().toISOString();
      dao.records = [
        record({ id: 'open', position: 1000 }),
        record({ id: 'done', completedAt: today, position: 700 }),
      ];

      await interactor.complete('open');

      expect(dao.completionUpdates[0].position).toBe(1700);
    });

    it('reopens an entry using the placement for new entries', async () => {
      preferences.set({ ...DEFAULT_REMINDER_PREFERENCES, newItemPlacement: 'bottom' });
      dao.records = [
        record({ id: 'open', position: 1000 }),
        record({ id: 'done', completedAt: new Date().toISOString(), position: 500 }),
      ];

      await interactor.reopen('done');

      expect(dao.completionUpdates[0].position).toBe(2000);
    });
  });

  describe('moving an entry', () => {
    beforeEach(() => {
      dao.records = [
        record({ id: 'a', position: 1000 }),
        record({ id: 'b', position: 2000 }),
        record({ id: 'c', position: 3000 }),
      ];
    });

    it('writes the midpoint between the two new neighbours', async () => {
      await interactor.move('a', 1);

      expect(dao.positionUpdates).toEqual([
        { id: 'a', position: 2500, updatedAt: expect.any(String) },
      ]);
      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
    });

    it('writes one step beyond the first entry when moving to the top', async () => {
      await interactor.move('c', 0);

      expect(dao.positionUpdates[0].position).toBe(0);
      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    });

    it('writes one step beyond the last entry when moving to the bottom', async () => {
      await interactor.move('a', 2);

      expect(dao.positionUpdates[0].position).toBe(4000);
      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
    });

    it('writes nothing when the entry is already there', async () => {
      await interactor.move('b', 1);

      expect(dao.positionUpdates).toEqual([]);
      expect(dao.reassignments).toEqual([]);
    });

    it('writes nothing for an entry it does not know', async () => {
      await interactor.move('missing', 0);

      expect(dao.positionUpdates).toEqual([]);
    });

    it('renumbers the section in one write when the neighbours have grown too close', async () => {
      dao.records = [
        record({ id: 'a', position: 1000 }),
        record({ id: 'b', position: 1000.0000001 }),
        record({ id: 'c', position: 3000 }),
      ];

      await interactor.move('c', 1);

      expect(dao.positionUpdates).toEqual([]);
      expect(dao.reassignments).toEqual([
        [
          { id: 'a', position: 1000 },
          { id: 'c', position: 2000 },
          { id: 'b', position: 3000 },
        ],
      ]);
      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['a', 'c', 'b']);
    });

    it('keeps a completed entry among the completed ones', async () => {
      const today = new Date().toISOString();
      dao.records = [
        record({ id: 'open', position: 1000 }),
        record({ id: 'done-a', completedAt: today, position: 1000 }),
        record({ id: 'done-b', completedAt: today, position: 2000 }),
      ];

      await interactor.move('done-b', 0);

      expect(dao.positionUpdates[0].position).toBe(0);
      expect((await interactor.list()).map((entry) => entry.id)).toEqual([
        'open',
        'done-b',
        'done-a',
      ]);
    });

    it('picks its neighbours from the entries the screen is showing', async () => {
      dao.records = [
        record({ id: 'hidden', completedAt: '2020-01-01T10:00:00.000Z', position: 1500 }),
        record({ id: 'done-a', completedAt: new Date().toISOString(), position: 1000 }),
        record({ id: 'done-b', completedAt: new Date().toISOString(), position: 2000 }),
      ];

      await interactor.move('done-b', 0);

      // 0, not the midpoint with the hidden entry at 1500.
      expect(dao.positionUpdates[0].position).toBe(0);
    });
  });

  describe('hiding completed entries at the day change', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    it('hides an entry completed before today', async () => {
      dao.records = [
        record({ id: 'open' }),
        record({ id: 'done-today', completedAt: new Date().toISOString(), position: 2000 }),
        record({ id: 'done-yesterday', completedAt: yesterday, position: 3000 }),
      ];

      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['open', 'done-today']);
    });

    it('never hides an open entry, however old it is', async () => {
      dao.records = [record({ id: 'ancient', createdAt: '2019-01-01T10:00:00.000Z' })];

      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['ancient']);
    });

    it('keeps yesterday’s entries when the preference is off', async () => {
      preferences.set({ ...DEFAULT_REMINDER_PREFERENCES, hideCompletedAtDayChange: false });
      dao.records = [record({ id: 'done-yesterday', completedAt: yesterday })];

      expect((await interactor.list()).map((entry) => entry.id)).toEqual(['done-yesterday']);
    });

    it('only hides the entry, it never deletes it', async () => {
      dao.records = [record({ id: 'done-yesterday', completedAt: yesterday })];

      await interactor.list();

      expect(dao.deletions).toEqual([]);
      expect(dao.records.map((entry) => entry.id)).toEqual(['done-yesterday']);
    });
  });
});
