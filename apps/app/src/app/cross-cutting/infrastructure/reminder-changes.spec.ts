import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ReminderChanges } from './reminder-changes';

describe('ReminderChanges', () => {
  it('changes its version every time a write is notified', () => {
    const changes = TestBed.inject(ReminderChanges);
    const before = changes.version();

    changes.notify();

    expect(changes.version()).not.toBe(before);
  });

  it('changes its version again on a second, independent notification', () => {
    const changes = TestBed.inject(ReminderChanges);
    changes.notify();
    const afterFirst = changes.version();

    changes.notify();

    expect(changes.version()).not.toBe(afterFirst);
  });
});
