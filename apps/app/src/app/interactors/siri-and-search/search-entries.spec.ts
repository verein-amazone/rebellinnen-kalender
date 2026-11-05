import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import type { SupportServiceView } from '@app/interactors/support-services/support-service.vm';

import { bookmarkEntry, supportServiceEntry } from './search-entries';

const SERVICE: SupportServiceView = {
  id: 'rat-auf-draht',
  region: 'online',
  name: 'Rat auf Draht',
  teaser: 'Notruf für Kinder, Jugendliche und ihre Bezugspersonen.',
  icon: '📞',
  actions: [
    { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
    { type: 'chat', label: 'Chat', uri: 'https://www.rataufdraht.at/chat', displayValue: null },
    { type: 'website', label: 'Webseite', uri: 'https://www.rataufdraht.at', displayValue: null },
  ],
};

const ITEM: ContentItemView = {
  id: 'reb-01',
  kind: 'rebellin',
  title: 'Johanna Dohnal',
  teaser: 'Österreichs erste Frauenministerin.',
  bodyMarkdown: 'Persönliche Notizen gehören hier nicht hin.',
  imagePath: null,
  imageAlt: null,
  imageAttribution: null,
  sourceLabel: null,
  sourceUrl: null,
  relatedSources: [],
  video: null,
  supportServiceIds: null,
};

describe('supportServiceEntry', () => {
  it('lists an Anlaufstelle by name, teaser, region and how it is reached', () => {
    expect(supportServiceEntry(SERVICE)).toEqual({
      id: 'service:rat-auf-draht',
      title: 'Rat auf Draht',
      description: 'Notruf für Kinder, Jugendliche und ihre Bezugspersonen.',
      keywords: ['Anlaufstelle', 'Online & Telefon', 'Telefon', 'Chat', 'Webseite'],
    });
  });

  it('never carries a phone number or a link', () => {
    const entry = JSON.stringify(supportServiceEntry(SERVICE));

    expect(entry).not.toContain('147');
    expect(entry).not.toContain('tel:');
    expect(entry).not.toContain('https:');
  });

  it('names each way of reaching it once', () => {
    const twoPhones = {
      ...SERVICE,
      actions: [SERVICE.actions[0], { ...SERVICE.actions[0], uri: 'tel:0800' }],
    };

    expect(supportServiceEntry(twoPhones).keywords).toEqual([
      'Anlaufstelle',
      'Online & Telefon',
      'Telefon',
    ]);
  });
});

describe('bookmarkEntry', () => {
  it('lists a bookmarked item by title, teaser and kind, without its body', () => {
    expect(bookmarkEntry(ITEM)).toEqual({
      id: 'content:reb-01',
      title: 'Johanna Dohnal',
      description: 'Österreichs erste Frauenministerin.',
      keywords: ['Rebell*innen', 'Meine Sammlung'],
    });
  });
});
