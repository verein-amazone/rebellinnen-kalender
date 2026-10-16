import { TestBed } from '@angular/core/testing';

import {
  ImageCatalogGateway,
  type ImageCatalogEntry,
} from '@app/data/gateways/image-catalog.gateway';
import { LegalContentGateway } from '@app/data/gateways/legal-content.gateway';

import { LegalContentInteractor } from './legal-content.interactor';

class FakeLegalContentGateway {
  thirdPartyLicenses: string | null = 'MIT License...';
  imprint: string | null = '## Herausgeberin';

  fetchThirdPartyLicenses(): Promise<string | null> {
    return Promise.resolve(this.thirdPartyLicenses);
  }

  fetchImprint(): Promise<string | null> {
    return Promise.resolve(this.imprint);
  }
}

class FakeImageCatalogGateway {
  entries: readonly ImageCatalogEntry[] = [];

  list(): Promise<readonly ImageCatalogEntry[]> {
    return Promise.resolve(this.entries);
  }
}

function setup(): {
  interactor: LegalContentInteractor;
  gateway: FakeLegalContentGateway;
  images: FakeImageCatalogGateway;
} {
  const gateway = new FakeLegalContentGateway();
  const images = new FakeImageCatalogGateway();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LegalContentGateway, useValue: gateway },
      { provide: ImageCatalogGateway, useValue: images },
    ],
  });

  return { interactor: TestBed.inject(LegalContentInteractor), gateway, images };
}

describe('LegalContentInteractor', () => {
  it('returns the third-party licence text from the gateway', async () => {
    const { interactor, gateway } = setup();
    gateway.thirdPartyLicenses = 'Some licence text';

    expect(await interactor.thirdPartyLicenses()).toBe('Some licence text');
  });

  it('returns the imprint from the gateway', async () => {
    const { interactor, gateway } = setup();
    gateway.imprint = '## Herausgeberin\n\nVerein Amazone';

    expect(await interactor.imprint()).toBe('## Herausgeberin\n\nVerein Amazone');
  });

  it('returns the image credits from the image catalog', async () => {
    const { interactor, images } = setup();
    const attribution: ImageCatalogEntry = {
      id: 'menstruation-hormone-zyklus',
      path: '/content/images/menstruation-hormone-zyklus.webp',
      title: 'Titel',
      alt: 'Viele rote Tropfen auf dunkelblauem Grund.',
      creator: 'Verein Amazone',
      license: 'All rights reserved (used with permission)',
      licenseUrl: null,
      changes: [],
    };
    images.entries = [attribution];

    expect(await interactor.imageAttributions()).toEqual([attribution]);
  });
});
