import { RECURRENCE_ENGINE_VERSION } from './materialization-config';

/**
 * `RECURRENCE_ENGINE_VERSION` is derived directly from `package.json`, so it cannot drift from
 * what is installed by itself. What it can still get wrong is the pin: if `rrule-temporal` ever
 * goes back to a semver range, the stamp becomes a range too, and a range is not a fixed point —
 * this is the guard against that.
 */
describe('RECURRENCE_ENGINE_VERSION', () => {
  it('names an exact rrule-temporal version, never a semver range', () => {
    expect(RECURRENCE_ENGINE_VERSION).toMatch(/^rrule-temporal@\d+\.\d+\.\d+$/);
  });
});
