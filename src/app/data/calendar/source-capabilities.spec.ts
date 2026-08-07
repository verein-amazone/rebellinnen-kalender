import { capabilitiesFor } from './source-capabilities';

describe('capabilitiesFor', () => {
  it('lets app items be edited and deleted in the app only', () => {
    expect(capabilitiesFor('app', true)).toEqual({
      editableInApp: true,
      deletableInApp: true,
      editViaNativeCalendar: false,
    });
  });

  it('routes writable device calendars to the native calendar flow', () => {
    expect(capabilitiesFor('device', true)).toEqual({
      editableInApp: false,
      deletableInApp: false,
      editViaNativeCalendar: true,
    });
  });

  it('offers no action at all for read-only device calendars', () => {
    expect(capabilitiesFor('device', false)).toEqual({
      editableInApp: false,
      deletableInApp: false,
      editViaNativeCalendar: false,
    });
  });

  it('keeps ICS feeds read-only regardless of the writable flag', () => {
    expect(capabilitiesFor('ics', true)).toEqual({
      editableInApp: false,
      deletableInApp: false,
      editViaNativeCalendar: false,
    });
  });
});
