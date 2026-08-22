import { inject, Injectable } from '@angular/core';

import { LegalContentGateway } from '@app/data/gateways/legal-content.gateway';

import type { ImageCreditView } from './image-credit.vm';

/** Backs the two "Lizenzen & Impressum" settings pages (#11): licences and image credits. */
@Injectable({ providedIn: 'root' })
export class LegalContentInteractor {
  private readonly gateway = inject(LegalContentGateway);

  thirdPartyLicenses(): Promise<string | null> {
    return this.gateway.fetchThirdPartyLicenses();
  }

  async imageAttributions(): Promise<readonly ImageCreditView[]> {
    return await this.gateway.fetchImageAttributions();
  }
}
