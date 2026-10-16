import { Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';

const THIRD_PARTY_LICENSES_URL = '/3rdpartylicenses.txt';
const PRIVACY_POLICY_URL = '/legal/datenschutz.md';
const TERMS_OF_USE_URL = '/legal/nutzungsbedingungen.md';
const IMPRINT_URL = '/legal/impressum.md';

/**
 * Reads the static legal-content assets shown under Settings (`LicensesPage`, `PrivacyPage`,
 * `TermsPage`, `ImprintPage`): the third-party licence file every production build puts into the
 * bundled app (licenses/README.md), the privacy policy, the terms of use and the imprint. All ship as plain files alongside
 * the app, so they load and work fully offline - no network request ever leaves the device. The
 * image credits come from `ImageCatalogGateway`.
 */
@Injectable({ providedIn: 'root' })
export class LegalContentGateway {
  /** `null` on any failure - a missing/unreachable file must never break the settings page. */
  fetchThirdPartyLicenses(): Promise<string | null> {
    return fetchText(THIRD_PARTY_LICENSES_URL);
  }

  /** `null` on any failure - same reasoning as `fetchThirdPartyLicenses`. */
  fetchPrivacyPolicy(): Promise<string | null> {
    return fetchText(PRIVACY_POLICY_URL);
  }

  /** `null` on any failure - same reasoning as `fetchThirdPartyLicenses`. */
  fetchTermsOfUse(): Promise<string | null> {
    return fetchText(TERMS_OF_USE_URL);
  }

  /** `null` on any failure - same reasoning as `fetchThirdPartyLicenses`. */
  fetchImprint(): Promise<string | null> {
    return fetchText(IMPRINT_URL);
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(assetUrl(url));
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}
