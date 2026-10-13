import { inject, Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';
import { LegalContentGateway } from '@app/data/gateways/legal-content.gateway';

import type { ImageCreditView } from './image-credit.vm';

/** Backs the legal settings pages: licences and image credits (#11), and the privacy policy (#79). */
@Injectable({ providedIn: 'root' })
export class LegalContentInteractor {
  private readonly gateway = inject(LegalContentGateway);

  thirdPartyLicenses(): Promise<string | null> {
    return this.gateway.fetchThirdPartyLicenses();
  }

  privacyPolicy(): Promise<string | null> {
    return this.gateway.fetchPrivacyPolicy();
  }

  async imageAttributions(): Promise<readonly ImageCreditView[]> {
    const attributions = await this.gateway.fetchImageAttributions();
    // The attribution file stores each image as a root-relative path, which only points at the
    // right file once the deployment's base href is applied.
    return attributions.map((attribution) => ({
      ...attribution,
      path: assetUrl(attribution.path),
    }));
  }
}
