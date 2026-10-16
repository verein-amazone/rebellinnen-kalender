import { TestBed } from '@angular/core/testing';
import { Temporal } from 'temporal-polyfill';

import {
  DeviceNotifications,
  type NotificationPermission,
  type PlannedNotification,
} from '@app/cross-cutting/infrastructure/notifications';
import { CalendarRepository, type ReminderCandidate } from '@app/data/calendar/calendar.repository';
import { NotificationPreferencesStore } from '@app/data/stores/notification-preferences.store';

import {
  MAX_PENDING_REMINDERS,
  planReminders,
  ReminderSchedulerInteractor,
} from './reminder-scheduler.interactor';

const ZONE = 'Europe/Vienna';
// Monday, 12 October 2026, 10:00 in Vienna.
const NOW = Temporal.Instant.from('2026-10-12T08:00:00Z');
const DEFAULTS = { timedDefaults: [15], allDayDefaults: [900] };

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    occurrenceId: 'app:item-1',
    title: 'Plenum',
    location: null,
    allDay: false,
    // 18:00 in Vienna.
    startUtc: '2026-10-12T16:00:00Z',
    startLocalDay: '2026-10-12',
    reminders: null,
    ...overrides,
  };
}

describe('planReminders', () => {
  it('follows the default reminders unless the appointment has its own', () => {
    const planned = planReminders(
      [candidate(), candidate({ occurrenceId: 'app:item-2', title: 'Chor', reminders: [60, 0] })],
      DEFAULTS,
      NOW,
      ZONE,
    );

    expect(planned.map((reminder) => [reminder.title, reminder.atUtc])).toEqual([
      ['Chor', '2026-10-12T15:00:00Z'],
      ['Plenum', '2026-10-12T15:45:00Z'],
      ['Chor', '2026-10-12T16:00:00Z'],
    ]);
  });

  it('schedules nothing for an explicit „no reminder“', () => {
    expect(planReminders([candidate({ reminders: [] })], DEFAULTS, NOW, ZONE)).toEqual([]);
  });

  it('anchors all-day reminders at local midnight of the first day', () => {
    const planned = planReminders(
      [candidate({ allDay: true, startUtc: '2026-10-13T22:00:00Z', startLocalDay: '2026-10-14' })],
      { ...DEFAULTS, allDayDefaults: [900, -540] },
      NOW,
      ZONE,
    );

    // 09:00 the day before and 09:00 on the day, in Vienna (UTC+2).
    expect(planned.map((reminder) => reminder.atUtc)).toEqual([
      '2026-10-13T07:00:00Z',
      '2026-10-14T07:00:00Z',
    ]);
    expect(planned[0].body).toBe('Morgen, ganztägig');
  });

  it('drops reminders that are already due', () => {
    // 10:05 - its 15-minute reminder was at 09:50.
    expect(
      planReminders([candidate({ startUtc: '2026-10-12T08:05:00Z' })], DEFAULTS, NOW, ZONE),
    ).toEqual([]);
  });

  it('says when and where in the text, and opens the occurrence on tap', () => {
    const [reminder] = planReminders(
      [candidate({ location: 'Vereinslokal' })],
      DEFAULTS,
      NOW,
      ZONE,
    );

    expect(reminder.body).toBe('Heute um 18:00 · Vereinslokal');
    expect(reminder.target).toBe('app:item-1');
  });

  it('gives every reminder a stable, distinct positive 32-bit id', () => {
    const candidates = Array.from({ length: 50 }, (_, index) =>
      candidate({ occurrenceId: `app:item-${index}`, reminders: [0, 5, 10, 15, 30] }),
    );

    const first = planReminders(candidates, DEFAULTS, NOW, ZONE);
    const again = planReminders(candidates, DEFAULTS, NOW, ZONE);
    const ids = first.map((reminder) => reminder.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => Number.isInteger(id) && id > 0 && id <= 0x7fffffff)).toBe(true);
    expect(again.map((reminder) => reminder.id)).toEqual(ids);
  });
});

class FakeRepository {
  candidates: ReminderCandidate[] = [];

  upcomingReminderCandidates(): Promise<ReminderCandidate[]> {
    return Promise.resolve(this.candidates);
  }
}

class FakeNotifications {
  supported = true;
  granted: NotificationPermission = 'granted';
  pending: readonly PlannedNotification[] | null = null;
  cancelled = 0;

  isSupported(): boolean {
    return this.supported;
  }

  permission(): Promise<NotificationPermission> {
    return Promise.resolve(this.granted);
  }

  replaceAll(planned: readonly PlannedNotification[]): Promise<void> {
    this.pending = planned;
    return Promise.resolve();
  }

  cancelAll(): Promise<void> {
    this.cancelled += 1;
    this.pending = [];
    return Promise.resolve();
  }
}

describe('ReminderSchedulerInteractor', () => {
  let repository: FakeRepository;
  let notifications: FakeNotifications;

  beforeEach(() => {
    localStorage.clear();
    repository = new FakeRepository();
    notifications = new FakeNotifications();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: CalendarRepository, useValue: repository },
        { provide: DeviceNotifications, useValue: notifications },
      ],
    });
  });

  function enableReminders(): void {
    TestBed.inject(NotificationPreferencesStore).update({ enabled: true });
  }

  function upcoming(count: number): ReminderCandidate[] {
    const start = Temporal.Now.instant().add({ hours: 2 });
    return Array.from({ length: count }, (_, index) =>
      candidate({
        occurrenceId: `app:item-${index}`,
        startUtc: start.add({ minutes: index }).toString(),
        reminders: [0, 5],
      }),
    );
  }

  it('cancels everything while reminders are switched off', async () => {
    repository.candidates = upcoming(1);

    await TestBed.inject(ReminderSchedulerInteractor).reschedule();

    expect(notifications.cancelled).toBe(1);
    expect(notifications.pending).toEqual([]);
  });

  it('cancels everything without the notification permission', async () => {
    enableReminders();
    notifications.granted = 'denied';
    repository.candidates = upcoming(1);

    await TestBed.inject(ReminderSchedulerInteractor).reschedule();

    expect(notifications.pending).toEqual([]);
  });

  it(`hands the OS at most the next ${MAX_PENDING_REMINDERS} reminders`, async () => {
    enableReminders();
    repository.candidates = upcoming(40);

    await TestBed.inject(ReminderSchedulerInteractor).reschedule();

    expect(notifications.pending).toHaveLength(MAX_PENDING_REMINDERS);
  });

  it('folds overlapping requests into one follow-up run', async () => {
    enableReminders();
    repository.candidates = upcoming(1);
    const replaced = vi.spyOn(notifications, 'replaceAll');
    const scheduler = TestBed.inject(ReminderSchedulerInteractor);

    await Promise.all([scheduler.reschedule(), scheduler.reschedule(), scheduler.reschedule()]);

    expect(replaced).toHaveBeenCalledTimes(2);
  });

  it('does nothing on the web', async () => {
    notifications.supported = false;

    await TestBed.inject(ReminderSchedulerInteractor).reschedule();

    expect(notifications.pending).toBeNull();
    expect(notifications.cancelled).toBe(0);
  });
});
