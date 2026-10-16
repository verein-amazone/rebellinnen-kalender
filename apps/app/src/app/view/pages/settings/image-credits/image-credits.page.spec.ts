import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ImageCreditView } from '@app/interactors/settings/image-credit.vm';
import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';

import { ImageCreditsPage } from './image-credits.page';

function attribution(overrides: Partial<ImageCreditView> = {}): ImageCreditView {
  return {
    id: 'menstruation-hormone-zyklus',
    path: '/content/images/menstruation-hormone-zyklus.webp',
    title: 'Menstruation, Hormone & Zyklus',
    creator: 'Verein Amazone',
    source: 'Verein Amazone',
    license: 'All rights reserved (used with permission)',
    licenseUrl: null,
    changes: ['resized'],
    ...overrides,
  };
}

class FakeLegalContentInteractor {
  items: readonly ImageCreditView[] = [attribution()];

  imageAttributions(): Promise<readonly ImageCreditView[]> {
    return Promise.resolve(this.items);
  }
}

async function setup(config: { items?: readonly ImageCreditView[] } = {}) {
  const legalContent = new FakeLegalContentInteractor();
  legalContent.items = config.items ?? legalContent.items;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LegalContentInteractor, useValue: legalContent }],
  });

  const fixture = TestBed.createComponent(ImageCreditsPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('ImageCreditsPage', () => {
  it('shows title, creator and licence for each credited image', async () => {
    const { element } = await setup({
      items: [attribution({ title: 'Menstruation', creator: 'Verein Amazone' })],
    });

    expect(element.textContent).toContain('Menstruation');
    expect(element.textContent).toContain('Verein Amazone');
    expect(element.textContent).toContain('All rights reserved (used with permission)');
  });

  it('links to the licence text when one is known', async () => {
    const { element } = await setup({
      items: [
        attribution({
          license: 'CC-BY-4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        }),
      ],
    });

    const link = element.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]');
    expect(link).not.toBeNull();
  });

  it('shows the credited image itself alongside its credit', async () => {
    const { element } = await setup({
      items: [attribution({ id: 'hedy-lamarr', path: '/content/images/hedy-lamarr.webp' })],
    });

    const image = element.querySelector('img[src="/content/images/hedy-lamarr.webp"]');
    expect(image).not.toBeNull();
  });

  it('says so when who made a picture is unknown', async () => {
    const { element } = await setup({ items: [attribution({ creator: undefined })] });

    expect(element.textContent).toContain('Urheber*in unbekannt');
  });

  it('lists the changes made to a picture in German', async () => {
    const { element } = await setup({
      items: [attribution({ changes: ['resized', 'cropped', 'converted to WebP'] })],
    });

    expect(element.textContent).toContain(
      'Änderungen: verkleinert, zugeschnitten, in WebP umgewandelt',
    );
  });

  it('shows the source as a link when it has an address, and as text otherwise', async () => {
    const { element } = await setup({
      items: [
        attribution({ id: 'a', sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg' }),
        attribution({ id: 'b', source: 'Verein Amazone' }),
      ],
    });

    expect(
      element.querySelector('a[href="https://commons.wikimedia.org/wiki/File:A.jpg"]'),
    ).not.toBeNull();
    expect(element.textContent).toContain('Quelle: Verein Amazone');
  });

  it('shows a fallback when there are no credited images', async () => {
    const { element } = await setup({ items: [] });

    expect(element.textContent).toContain('Keine Bildnachweise verfügbar.');
  });
});
