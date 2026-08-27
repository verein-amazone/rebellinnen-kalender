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

/** The German greeting text for a bucket, without the name - the caller appends that itself. */
export function greetingText(id: GreetingId): string {
  return GREETING_TEXT[id];
}
