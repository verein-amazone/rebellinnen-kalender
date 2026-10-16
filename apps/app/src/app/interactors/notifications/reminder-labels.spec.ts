import { reminderLabel, reminderOptions } from './reminder-labels';

describe('reminderLabel', () => {
  it.each<[number, string]>([
    [0, 'Zum Terminbeginn'],
    [5, '5 Minuten vorher'],
    [15, '15 Minuten vorher'],
    [60, '1 Stunde vorher'],
    [120, '2 Stunden vorher'],
    [1440, '1 Tag vorher'],
    [2880, '2 Tage vorher'],
    [10080, '1 Woche vorher'],
  ])('labels %i minutes before a timed start as „%s“', (minutes, label) => {
    expect(reminderLabel(minutes, false)).toBe(label);
  });

  it.each<[number, string]>([
    [-540, 'Am Tag um 09:00'],
    [900, '1 Tag vorher um 09:00'],
    [2340, '2 Tage vorher um 09:00'],
    [9540, '1 Woche vorher um 09:00'],
    [15, '1 Tag vorher um 23:45'],
  ])('labels %i minutes before an all-day start as „%s“', (minutes, label) => {
    expect(reminderLabel(minutes, true)).toBe(label);
  });

  it('offers the presets of the platform calendar apps', () => {
    expect(reminderOptions(false)).toHaveLength(10);
    expect(reminderOptions(true).map((option) => option.label)).toEqual([
      'Am Tag um 09:00',
      '1 Tag vorher um 09:00',
      '2 Tage vorher um 09:00',
      '1 Woche vorher um 09:00',
    ]);
  });
});
