import { EVERGREEN_WINDOW_DAYS, isWithinWindow, windowDays } from './content-window';

describe('isWithinWindow', () => {
  it('matches every day for an evergreen item', () => {
    expect(isWithinWindow({ validFrom: null, validTo: null }, '2027-02-05')).toBe(true);
  });

  it('matches a one-off window inclusively, and only in its year', () => {
    const window = { validFrom: '2027-02-01', validTo: '2027-02-10' };

    expect(isWithinWindow(window, '2027-02-01')).toBe(true);
    expect(isWithinWindow(window, '2027-02-10')).toBe(true);
    expect(isWithinWindow(window, '2027-02-11')).toBe(false);
    expect(isWithinWindow(window, '2028-02-05')).toBe(false);
  });

  it('leaves a one-off window open on the side without a bound', () => {
    expect(isWithinWindow({ validFrom: '2027-02-01', validTo: null }, '2030-01-01')).toBe(true);
    expect(isWithinWindow({ validFrom: '2027-02-01', validTo: null }, '2027-01-31')).toBe(false);
    expect(isWithinWindow({ validFrom: null, validTo: '2027-02-01' }, '2027-02-02')).toBe(false);
  });

  it('matches a yearly window in every year', () => {
    const window = { validFrom: '--03-01', validTo: '--03-08' };

    expect(isWithinWindow(window, '2027-03-01')).toBe(true);
    expect(isWithinWindow(window, '2031-03-08')).toBe(true);
    expect(isWithinWindow(window, '2027-03-09')).toBe(false);
    expect(isWithinWindow(window, '2027-02-28')).toBe(false);
  });

  it('matches a single yearly day', () => {
    const window = { validFrom: '--05-17', validTo: '--05-17' };

    expect(isWithinWindow(window, '2028-05-17')).toBe(true);
    expect(isWithinWindow(window, '2028-05-18')).toBe(false);
  });

  it('wraps a yearly window across the turn of the year', () => {
    const window = { validFrom: '--12-20', validTo: '--01-06' };

    expect(isWithinWindow(window, '2027-12-31')).toBe(true);
    expect(isWithinWindow(window, '2028-01-06')).toBe(true);
    expect(isWithinWindow(window, '2028-01-07')).toBe(false);
    expect(isWithinWindow(window, '2027-12-19')).toBe(false);
  });

  it('matches no day for a window that mixes yearly and one-off bounds', () => {
    expect(isWithinWindow({ validFrom: '--03-01', validTo: '2027-03-08' }, '2027-03-05')).toBe(
      false,
    );
    expect(isWithinWindow({ validFrom: '--03-01', validTo: null }, '2027-03-05')).toBe(false);
  });
});

describe('windowDays', () => {
  it('counts an evergreen or open-ended window as the evergreen span', () => {
    expect(windowDays({ validFrom: null, validTo: null }, '2027-02-05')).toBe(
      EVERGREEN_WINDOW_DAYS,
    );
    expect(windowDays({ validFrom: '2027-01-01', validTo: null }, '2027-02-05')).toBe(
      EVERGREEN_WINDOW_DAYS,
    );
  });

  it('counts a one-off window inclusively', () => {
    expect(windowDays({ validFrom: '2027-02-01', validTo: '2027-02-10' }, '2027-02-05')).toBe(10);
  });

  it('counts a yearly window inclusively', () => {
    expect(windowDays({ validFrom: '--11-25', validTo: '--12-10' }, '2027-11-30')).toBe(16);
    expect(windowDays({ validFrom: '--06-01', validTo: '--06-30' }, '2027-06-05')).toBe(30);
  });

  it('counts a wrapped yearly window across the turn of the year', () => {
    expect(windowDays({ validFrom: '--12-20', validTo: '--01-06' }, '2027-12-25')).toBe(18);
  });

  it('measures a February window within today’s year, leap or not', () => {
    const february = { validFrom: '--02-01', validTo: '--02-29' };

    expect(windowDays(february, '2027-02-10')).toBe(28);
    expect(windowDays(february, '2028-02-10')).toBe(29);
  });
});
