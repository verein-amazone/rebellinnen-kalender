import { RECURRENCE_ENGINE_VERSION } from './materialization-config';

/**
 * `RECURRENCE_ENGINE_VERSION` is derived from the caret range in `package.json`, with the caret
 * stripped. Any other range syntax (`~`, `>=`, `x`) would leak into the stamp, and a range is not a
 * fixed point - this is the guard against that.
 */
describe('RECURRENCE_ENGINE_VERSION', () => {
  it('names an exact rrule-temporal version, never a semver range', () => {
    expect(RECURRENCE_ENGINE_VERSION).toMatch(/^rrule-temporal@\d+\.\d+\.\d+\+rows\.\d+$/);
  });
});
