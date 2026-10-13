import { Injectable } from '@angular/core';

import { assetUrl } from '@app/cross-cutting/helpers/asset-url';

const THIRD_PARTY_LICENSES_URL = '/3rdpartylicenses.txt';
const IMAGE_ATTRIBUTIONS_URL = '/image-attributions.json';
const PRIVACY_POLICY_URL = '/legal/datenschutz.md';
const TERMS_OF_USE_URL = '/legal/nutzungsbedingungen.md';

/** One image's licence, source and attribution - see `public/image-attributions.json`. */
export interface ImageAttribution {
  readonly path: string;
  readonly title: string;
  readonly creator: string;
  readonly sourceUrl?: string;
  readonly source?: string;
  readonly license: string;
  readonly licenseUrl: string | null;
  readonly changes: readonly string[];
  readonly permissionRef?: string;
  readonly publicDomainBasis?: string;
  readonly needsReview?: boolean;
  readonly reviewNote?: string;
}

/**
 * Reads the static legal-content assets shown under Settings (`LicensesPage`, `ImageCreditsPage`,
 * `PrivacyPage`, `TermsPage`): the third-party licence file every production build puts into the
 * bundled app (licenses/README.md), the curated image attribution data, the privacy policy and the
 * terms of use. All ship as
 * plain files alongside the app, so they load and work fully offline - no network request ever
 * leaves the device.
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

  /** Empty on any failure - same reasoning as `fetchThirdPartyLicenses`. */
  async fetchImageAttributions(): Promise<readonly ImageAttribution[]> {
    try {
      const response = await fetch(assetUrl(IMAGE_ATTRIBUTIONS_URL));
      if (!response.ok) {
        return [];
      }

      const data: unknown = await response.json();
      return isImageAttributionList(data) ? data : [];
    } catch {
      return [];
    }
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

function isImageAttributionList(value: unknown): value is readonly ImageAttribution[] {
  return Array.isArray(value) && value.every(isImageAttribution);
}

function isImageAttribution(value: unknown): value is ImageAttribution {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ImageAttribution>;
  return (
    typeof candidate.path === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.creator === 'string' &&
    typeof candidate.license === 'string' &&
    Array.isArray(candidate.changes)
  );
}
