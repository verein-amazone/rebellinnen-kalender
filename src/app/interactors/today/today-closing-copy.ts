/**
 * The Today page's closing-footer copy, keyed by the message keys `today-closing-state.ts` picks.
 *
 * Kept separate from the state-selection rules so wording can be added to or reworded without
 * touching behaviour, and so the rules can be tested without depending on exact German phrasing.
 * Every key holds several equivalent variants; `pickClosingCopy` below chooses one deterministically.
 *
 * Text only, no emoji: a decorative emoji is rendered by the component in its own `aria-hidden`
 * element, not read out as part of the sentence.
 */
const CLOSING_COPY: Readonly<Record<string, readonly string[]>> = {
  'appointment-later.headline': [
    'Heute steht noch etwas an',
    'Später ist noch ein Termin',
    'Heute kommt noch ein Termin',
  ],
  'appointment-later.next': [
    'Als Nächstes: {time} – {title}',
    'Dein nächster Termin beginnt um {time}.',
  ],
  'appointment-later.withReminders': ['Dein nächster Termin beginnt um {time}.'],
  'appointment-later.nextAllDay': ['Heute: {title}', 'Als Nächstes: {title}'],
  'appointment-later.withRemindersAllDay': ['Und außerdem heute: {title}'],
  'open-reminders.headline.one': ['Noch 1 Punkt für heute', 'Für heute ist noch 1 Punkt offen'],
  'open-reminders.headline.many': [
    'Noch {count} Punkte für heute',
    'Für heute sind noch {count} Punkte offen',
  ],
  'open-reminders.supporting': ['Du kannst später hier weitermachen.'],
  'all-done.headline': [
    'Für heute ist alles erledigt',
    'Alles erledigt für heute',
    'Du hast für heute alles im Blick.',
  ],
  'all-done.tomorrowPreview': ['Morgen um {time}: {title}', 'Als Nächstes: Morgen um {time}'],
  'all-done.tomorrowPreviewAllDay': ['Morgen: {title}'],
  'nothing-planned.headline': [
    'Heute ist nichts weiter geplant',
    'Für heute steht nichts mehr an',
    'Heute bleibt Zeit für dich',
  ],
  'nothing-planned.tomorrowPreview': [
    'Morgen um {time}: {title}',
    'Als Nächstes: Morgen um {time}',
  ],
  'nothing-planned.tomorrowPreviewAllDay': ['Morgen: {title}'],
  'day-over.headline': [
    "Das war's für heute",
    'Für heute ist alles geschafft',
    'Der heutige Tag ist abgeschlossen',
  ],
  'day-over.goodnight': ['Hab einen schönen Abend.'],
};

/**
 * The variant `key` maps to for `day` and `stateId`, stable for as long as neither changes.
 *
 * A simple string hash rather than randomness: the same `(day, stateId, key)` must always resolve
 * to the same text, including across app restarts, without storing anything. Hashing in `key` too
 * means a headline and its supporting line don't always land on the same pool index together.
 */
export function pickClosingCopy(key: string, day: string, stateId: string): string {
  const pool = CLOSING_COPY[key];
  if (pool === undefined) {
    throw new Error(`Unknown closing-message key: ${key}`);
  }

  return pool[hash(`${day}|${stateId}|${key}`) % pool.length];
}

function hash(input: string): number {
  let hashValue = 0;
  for (let index = 0; index < input.length; index++) {
    hashValue = (Math.imul(31, hashValue) + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hashValue);
}
