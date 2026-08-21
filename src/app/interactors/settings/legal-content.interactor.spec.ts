import { TestBed } from '@angular/core/testing';

import type { ImageAttribution } from '@app/data/gateways/legal-content.gateway';
import { LegalContentGateway } from '@app/data/gateways/legal-content.gateway';

import { LegalContentInteractor } from './legal-content.interactor';

class FakeLegalContentGateway {
  thirdPartyLicenses: string | null = 'MIT License...';
  imageAttributions: readonly ImageAttribution[] = [];

  fetchThirdPartyLicenses(): Promise<string | null> {
    return Promise.resolve(this.thirdPartyLicenses);
  }

  fetchImageAttributions(): Promise<readonly ImageAttribution[]> {
    return Promise.resolve(this.imageAttributions);
  }
}

function setup(): { interactor: LegalContentInteractor; gateway: FakeLegalContentGateway } {
  const gateway = new FakeLegalContentGateway();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: LegalContentGateway, useValue: gateway }],
  });

  return { interactor: TestBed.inject(LegalContentInteractor), gateway };
}

describe('LegalContentInteractor', () => {
  it('returns the third-party licence text from the gateway', async () => {
    const { interactor, gateway } = setup();
    gateway.thirdPartyLicenses = 'Some licence text';

    expect(await interactor.thirdPartyLicenses()).toBe('Some licence text');
  });

  it('returns the image attributions from the gateway', async () => {
    const { interactor, gateway } = setup();
    const attribution: ImageAttribution = {
      path: '/content/wissensimpulse/wi-01.webp',
      title: 'Titel',
      creator: 'Verein Amazone',
      license: 'All rights reserved (used with permission)',
      licenseUrl: null,
      changes: [],
    };
    gateway.imageAttributions = [attribution];

    expect(await interactor.imageAttributions()).toEqual([attribution]);
  });
});
