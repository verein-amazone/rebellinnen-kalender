import { Injectable } from '@angular/core';

const THIRD_PARTY_LICENSES_URL = '/3rdpartylicenses.txt';
const IMAGE_ATTRIBUTIONS_URL = '/image-attributions.json';

/** One image's licence, source and attribution — see `public/image-attributions.json`. */
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
 * Reads the two static legal-content assets shown under Settings → Lizenzen & Impressum
 * (`LicensesPage`, `ImageCreditsPage`): the third-party licence file Angular's
 * `extractLicenses` build option generates into the bundled app (see `angular.json`'s production
 * configuration), and the curated image attribution data. Both ship as plain files alongside the
 * app, so they load and work fully offline — no network request ever leaves the device.
 */
@Injectable({ providedIn: 'root' })
export class LegalContentGateway {
  /** `null` on any failure — a missing/unreachable file must never break the settings page. */
  async fetchThirdPartyLicenses(): Promise<string | null> {
    try {
      const response = await fetch(THIRD_PARTY_LICENSES_URL);
      return response.ok ? await response.text() : null;
    } catch {
      return null;
    }
  }

  /** Empty on any failure — same reasoning as `fetchThirdPartyLicenses`. */
  async fetchImageAttributions(): Promise<readonly ImageAttribution[]> {
    try {
      const response = await fetch(IMAGE_ATTRIBUTIONS_URL);
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
