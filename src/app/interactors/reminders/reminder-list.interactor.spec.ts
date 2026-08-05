import { TestBed } from '@angular/core/testing';

import { ReminderDao } from '@app/data/daos/reminder.dao';
import type { ReminderRecord } from '@app/data/entities/reminder.record';

import {
  REMINDER_TEXT_MAX_LENGTH,
  ReminderListInteractor,
  ReminderTextInvalidError,
} from './reminder-list.interactor';

class FakeReminderDao {
  records: ReminderRecord[] = [];
  readonly completedUpdates: { id: string; completedAt: string | null; updatedAt: string }[] = [];
  readonly textUpdates: { id: string; text: string; updatedAt: string }[] = [];
  readonly deletions: string[] = [];

  listAll(): Promise<ReminderRecord[]> {
    return Promise.resolve(this.records);
  }

  insert(record: ReminderRecord): Promise<void> {
    this.records = [...this.records, record];
    return Promise.resolve();
  }

  updateText(id: string, text: string, updatedAt: string): Promise<void> {
    this.textUpdates.push({ id, text, updatedAt });
    return Promise.resolve();
  }

  updateCompletedAt(id: string, completedAt: string | null, updatedAt: string): Promise<void> {
    this.completedUpdates.push({ id, completedAt, updatedAt });
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.deletions.push(id);
    return Promise.resolve();
  }
}

describe('ReminderListInteractor', () => {
  let dao: FakeReminderDao;
  let interactor: ReminderListInteractor;

  beforeEach(() => {
    dao = new FakeReminderDao();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ReminderDao, useValue: dao }],
    });

    interactor = TestBed.inject(ReminderListInteractor);
  });

  it('adds a trimmed entry as open, with an identifier and timestamps', async () => {
    await interactor.add('  Blumen gießen  ');

    const [record] = dao.records;
    expect(record.text).toBe('Blumen gießen');
    expect(record.completedAt).toBeNull();
    expect(record.id).not.toBe('');
    expect(record.createdAt).toBe(record.updatedAt);
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

  it('presents entries with a completion flag and without the timestamps', async () => {
    dao.records = [
      {
        id: 'a',
        text: 'Offen',
        completedAt: null,
        createdAt: '2026-08-05T10:00:00.000Z',
        updatedAt: '2026-08-05T10:00:00.000Z',
      },
      {
        id: 'b',
        text: 'Erledigt',
        completedAt: '2026-08-05T11:00:00.000Z',
        createdAt: '2026-08-05T09:00:00.000Z',
        updatedAt: '2026-08-05T11:00:00.000Z',
      },
    ];

    expect(await interactor.list()).toEqual([
      { id: 'a', text: 'Offen', completed: false },
      { id: 'b', text: 'Erledigt', completed: true },
    ]);
  });

  it('completes an entry with a timestamp and reopens it with none', async () => {
    await interactor.complete('a');
    await interactor.reopen('a');

    expect(dao.completedUpdates[0].completedAt).not.toBeNull();
    expect(dao.completedUpdates[0].completedAt).toBe(dao.completedUpdates[0].updatedAt);
    expect(dao.completedUpdates[1].completedAt).toBeNull();
    expect(dao.completedUpdates[1].updatedAt).not.toBe('');
  });

  it('renames and deletes an entry', async () => {
    await interactor.rename('a', '  Neuer Text ');
    await interactor.remove('a');

    expect(dao.textUpdates[0].text).toBe('Neuer Text');
    expect(dao.deletions).toEqual(['a']);
  });
});
