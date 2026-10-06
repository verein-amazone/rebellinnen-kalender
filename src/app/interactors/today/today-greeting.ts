/** Which part of the day the Today greeting is addressing. */
export type GreetingId = 'morning' | 'day' | 'evening';

const DAY_HOUR = 12;
const EVENING_HOUR = 18;

/** Buckets a device-local hour (0–23) into the greeting it should show. */
export function selectGreeting(hour: number): GreetingId {
  if (hour < DAY_HOUR) {
    return 'morning';
  }
  if (hour < EVENING_HOUR) {
    return 'day';
  }
  return 'evening';
}

const GREETING_TEXT: Record<GreetingId, string> = {
  morning: 'Guten Morgen',
  day: 'Hallo',
  evening: 'Guten Abend',
};

/** The German greeting text for a bucket, without the name or the closing punctuation. */
export function greetingText(id: GreetingId): string {
  return GREETING_TEXT[id];
}

/**
 * The full greeting line: „Guten Morgen Nina!“, or „Guten Morgen!“ without a name. No comma before
 * the name - that read like a formal letter - and an exclamation mark at the end, because the
 * testers found the greeting flat without one.
 */
export function greetingLine(id: GreetingId, name: string | null): string {
  return name ? `${greetingText(id)} ${name}!` : `${greetingText(id)}!`;
}
