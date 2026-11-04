import { parseAppDestination } from './app-destination';

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
