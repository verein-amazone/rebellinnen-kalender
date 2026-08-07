import { Injectable } from '@angular/core';

const STORAGE_KEY = 'rk.calendar-maintenance';

interface CalendarMaintenanceState {
  readonly lastTimeZone: string | null;
}

/**
 * Remembers the device zone the derived calendar rows were computed in. Not a preference — a
 * bookkeeping scalar the maintenance check compares against the current zone to decide whether
 * `date` and `floating` rows must be rebuilt.
 */
@Injectable({ providedIn: 'root' })
export class CalendarMaintenanceStore {
  lastTimeZone(): string | null {
    return this.read().lastTimeZone;
  }

  rememberTimeZone(timeZone: string): void {
    this.write({ lastTimeZone: timeZone });
  }

  private read(): CalendarMaintenanceState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'lastTimeZone' in parsed &&
          (typeof parsed.lastTimeZone === 'string' || parsed.lastTimeZone === null)
        ) {
          return { lastTimeZone: parsed.lastTimeZone };
        }
      }
    } catch {
      // Unreadable state is the same as no state.
    }

    return { lastTimeZone: null };
  }

  private write(state: CalendarMaintenanceState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage being unavailable only costs an extra rebuild next time.
    }
  }
}
