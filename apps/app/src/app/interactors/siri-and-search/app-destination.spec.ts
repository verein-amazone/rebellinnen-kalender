import { parseAppDestination, shortcutDestinationAt } from './app-destination';

describe('parseAppDestination', () => {
  it('opens the four App Shortcut screens', () => {
    expect(parseAppDestination('today')).toEqual({ commands: ['/today'] });
    expect(parseAppDestination('collection')).toEqual({
      commands: ['/content'],
      queryParams: { area: 'collection' },
    });
    expect(parseAppDestination('services')).toEqual({
      commands: ['/content'],
      queryParams: { area: 'services' },
    });
    expect(parseAppDestination('new-event')).toEqual({ commands: ['/calendar', 'event', 'new'] });
  });

  it('opens one Anlaufstelle on the Anlaufstellen screen', () => {
    expect(parseAppDestination('service:rat-auf-draht')).toEqual({
      commands: ['/content'],
      queryParams: { area: 'services', service: 'rat-auf-draht' },
    });
  });

  it('opens a content item on its detail screen', () => {
    expect(parseAppDestination('content:wi-01')).toEqual({ commands: ['/content', 'wi-01'] });
  });

  it.each([
    '',
    'settings',
    'toString',
    '__proto__',
    'service:',
    'content:',
    'content:../settings',
    'content:wi-01?returnTo=/settings',
    'service:a/b',
    'event:app:item-1',
  ])('ignores %j', (raw) => {
    expect(parseAppDestination(raw)).toBeNull();
  });
});

describe('shortcutDestinationAt', () => {
  it.each([
    ['/today', 'today'],
    ['/content', 'collection'],
    ['/content?area=collection&q=wut', 'collection'],
    ['/content?area=unknown', 'collection'],
    ['/content?area=services', 'services'],
    ['/content?area=services&service=rat-auf-draht', 'services'],
    ['/calendar/event/new', 'new-event'],
  ])('finds the App Shortcut screen at %s', (url, destination) => {
    expect(shortcutDestinationAt(url)).toBe(destination);
  });

  it.each(['/calendar', '/calendar/event/item-1', '/content/wi-01', '/settings'])(
    'finds none at %s',
    (url) => {
      expect(shortcutDestinationAt(url)).toBeNull();
    },
  );

  it('is the way back from every App Shortcut destination', () => {
    for (const destination of ['today', 'collection', 'services', 'new-event'] as const) {
      const opened = parseAppDestination(destination);
      const url = `${opened?.commands.join('/')}?${new URLSearchParams(opened?.queryParams)}`;
      expect(shortcutDestinationAt(url)).toBe(destination);
    }
  });
});
