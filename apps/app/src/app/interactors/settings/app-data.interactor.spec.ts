import { TestBed } from '@angular/core/testing';

import { AppDataReset } from '@app/data/maintenance/app-data-reset';
import { ReminderSchedulerInteractor } from '@app/interactors/notifications/reminder-scheduler.interactor';

import { AppDataInteractor } from './app-data.interactor';

describe('AppDataInteractor', () => {
  let calls: string[];
  let clearing: Error | null;

  beforeEach(() => {
    calls = [];
    clearing = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ReminderSchedulerInteractor,
          useValue: { cancelAll: () => Promise.resolve(void calls.push('cancel reminders')) },
        },
        {
          provide: AppDataReset,
          useValue: {
            clearEverything: () => {
              calls.push('clear data');
              return clearing === null ? Promise.resolve() : Promise.reject(clearing);
            },
          },
        },
      ],
    });
  });

  it('withdraws the pending reminders before it clears the data they belong to', async () => {
    await TestBed.inject(AppDataInteractor).resetAppData();

    expect(calls).toEqual(['cancel reminders', 'clear data']);
  });

  it('passes a failed clear on to the caller', async () => {
    clearing = new Error('database is locked');

    await expect(TestBed.inject(AppDataInteractor).resetAppData()).rejects.toThrow(
      'database is locked',
    );
  });
});
