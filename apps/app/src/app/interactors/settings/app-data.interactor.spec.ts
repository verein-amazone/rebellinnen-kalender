import { TestBed } from '@angular/core/testing';

import { AppDataReset } from '@app/data/maintenance/app-data-reset';
import { ReminderSchedulerInteractor } from '@app/interactors/notifications/reminder-scheduler.interactor';
import { SiriAndSearchInteractor } from '@app/interactors/siri-and-search/siri-and-search.interactor';

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
          provide: SiriAndSearchInteractor,
          useValue: { clearAll: () => Promise.resolve(void calls.push('clear search')) },
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

  it('withdraws the pending reminders and search entries before it clears their data', async () => {
    await TestBed.inject(AppDataInteractor).resetAppData();

    expect(calls).toEqual(['cancel reminders', 'clear search', 'clear data']);
  });

  it('passes a failed clear on to the caller', async () => {
    clearing = new Error('database is locked');

    await expect(TestBed.inject(AppDataInteractor).resetAppData()).rejects.toThrow(
      'database is locked',
    );
  });
});
