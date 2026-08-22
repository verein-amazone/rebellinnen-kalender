import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import type {
  SupportServiceRegion,
  SupportServiceView,
} from '@app/interactors/support-services/support-service.vm';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';

import { ContentOverviewPage } from './overview.page';

function item(overrides: Partial<ContentItemView> = {}): ContentItemView {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Was tut dir gut?',
    teaser: 'Wir haben ein paar Ideen für dich!',
    bodyMarkdown: 'Ein Bad nehmen.',
    imagePath: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    ...overrides,
  };
}

function service(overrides: Partial<SupportServiceView> = {}): SupportServiceView {
  return {
    id: 'rat-auf-draht',
    region: 'online',
    name: 'Rat auf Draht',
    teaser: 'Beratung für Kinder und Jugendliche',
    crisis: true,
    icon: '🧠',
    color: '#E92F2A',
    logoPath: null,
    actions: [
      { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
      {
        type: 'chat',
        label: 'Chat',
        uri: 'https://www.rataufdraht.at/chatberatung',
        displayValue: null,
      },
    ],
    ...overrides,
  };
}

class FakeContentItemsInteractor {
  items: ContentItemView[] = [];

  listAll(): Promise<ContentItemView[]> {
    return Promise.resolve(this.items);
  }
}

class FakeSupportServicesInteractor {
  services: SupportServiceView[] = [];
  regions: SupportServiceRegion[] = [];

  listAll(): Promise<SupportServiceView[]> {
    return Promise.resolve(this.services);
  }

  listRegions(): Promise<SupportServiceRegion[]> {
    return Promise.resolve(this.regions);
  }
}

async function setup(
  options: {
    items?: ContentItemView[];
    services?: SupportServiceView[];
    regions?: SupportServiceRegion[];
  } = {},
) {
  const contentItems = new FakeContentItemsInteractor();
  contentItems.items = options.items ?? [];

  const supportServices = new FakeSupportServicesInteractor();
  supportServices.services = options.services ?? [];
  supportServices.regions = options.regions ?? [];

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContentItemsInteractor, useValue: contentItems },
      { provide: SupportServicesInteractor, useValue: supportServices },
    ],
  });

  const fixture = TestBed.createComponent(ContentOverviewPage);
  await fixture.whenStable();

  return {
    element: fixture.nativeElement as HTMLElement,
    whenStable: () => fixture.whenStable(),
  };
}

describe('ContentOverviewPage', () => {
  it('shows Anlaufstellen by default', async () => {
    const { element } = await setup({
      regions: [{ id: 'online', label: 'Online & Telefon' }],
      services: [service()],
    });

    expect(element.textContent).toContain('Rat auf Draht');
  });

  it('exposes a real ARIA tabs widget with the Anlaufstellen tab selected by default', async () => {
    const { element } = await setup();

    expect(element.querySelector('[role="tablist"]')).not.toBeNull();

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    const servicesTab = tabs.find((tab) => tab.textContent?.includes('Anlaufstellen'));
    const collectionTab = tabs.find((tab) => tab.textContent?.includes('Meine Sammlung'));
    expect(servicesTab?.getAttribute('aria-selected')).toBe('true');
    expect(collectionTab?.getAttribute('aria-selected')).toBe('false');

    const panels = Array.from(element.querySelectorAll('[role="tabpanel"]'));
    expect(panels).toHaveLength(2);
    expect(servicesTab?.getAttribute('aria-controls')).toBe(
      panels.find((panel) => !panel.hasAttribute('inert'))?.id,
    );
  });

  it('shows only entries matching the selected region', async () => {
    const { element, whenStable } = await setup({
      regions: [
        { id: 'online', label: 'Online & Telefon' },
        { id: 'vorarlberg', label: 'Vorarlberg' },
      ],
      services: [
        service({ id: 'rat-auf-draht', region: 'online', name: 'Rat auf Draht' }),
        service({ id: 'verein-amazone', region: 'vorarlberg', name: 'Verein Amazone' }),
      ],
    });

    expect(element.textContent).toContain('Rat auf Draht');
    expect(element.textContent).not.toContain('Verein Amazone');

    const regionButtons = Array.from(element.querySelectorAll('button[role="radio"]'));
    const vorarlbergButton = regionButtons.find((button) =>
      button.textContent?.includes('Vorarlberg'),
    );
    (vorarlbergButton as HTMLButtonElement).click();
    await whenStable();

    expect(element.textContent).toContain('Verein Amazone');
    expect(element.textContent).not.toContain('Rat auf Draht');
  });

  it('shows an empty state for a region with no entries', async () => {
    const { element } = await setup({
      regions: [{ id: 'online', label: 'Online & Telefon' }],
      services: [],
    });

    expect(element.textContent).toContain('noch keine Anlaufstellen');
  });

  it('switches to Meine Sammlung and shows the debug content listing there', async () => {
    const { element, whenStable } = await setup({
      items: [item({ id: 'wi-01', title: 'Was tut dir gut?' })],
    });

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs.find((tab) => tab.textContent?.includes('Meine Sammlung'))?.click();
    await whenStable();

    const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href^="/content/"]')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/content/wi-01?returnTo=%2Fcontent',
    ]);
    expect(element.textContent).toContain('Was tut dir gut?');
  });

  it('shows a fallback when there is no content yet in Meine Sammlung', async () => {
    const { element, whenStable } = await setup({ items: [] });

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs.find((tab) => tab.textContent?.includes('Meine Sammlung'))?.click();
    await whenStable();

    expect(element.textContent).toContain('Noch keine Inhalte');
  });
});
