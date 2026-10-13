import { inject, Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';
import { ImageCatalogGateway } from '@app/data/gateways/image-catalog.gateway';
import { LegalContentGateway } from '@app/data/gateways/legal-content.gateway';

import type { ImageCreditView } from './image-credit.vm';

/**
 * Backs the legal settings pages: licences and image credits (#11), the privacy policy and the terms
 * of use (#79).
 */
@Injectable({ providedIn: 'root' })
export class LegalContentInteractor {
  private readonly gateway = inject(LegalContentGateway);
  private readonly images = inject(ImageCatalogGateway);

  thirdPartyLicenses(): Promise<string | null> {
    return this.gateway.fetchThirdPartyLicenses();
  }

  privacyPolicy(): Promise<string | null> {
    return this.gateway.fetchPrivacyPolicy();
  }

  termsOfUse(): Promise<string | null> {
    return this.gateway.fetchTermsOfUse();
  }

  async imageAttributions(): Promise<readonly ImageCreditView[]> {
    const attributions = await this.images.list();
    // The image catalog gives each image a root-relative path, which only points at the right
    // file once the deployment's base href is applied.
    return attributions.map((attribution) => ({
      ...attribution,
      path: assetUrl(attribution.path),
    }));
  }
}
