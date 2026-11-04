import type { SearchEntry } from '@app/cross-cutting/infrastructure/siri-and-search';
import { supportServiceRegionLabel } from '@app/data/support-services/support-service-regions';
import {
  contentKindLabel,
  type ContentItemView,
} from '@app/interactors/daily-content/content-item.vm';
import type {
  SupportServiceActionType,
  SupportServiceView,
} from '@app/interactors/support-services/support-service.vm';

import { CONTENT_DESTINATION_PREFIX, SERVICE_DESTINATION_PREFIX } from './app-destination';

/** How a way of reaching an Anlaufstelle is searched for. The button labels are verbs („Anrufen“). */
const ACTION_KEYWORDS: Readonly<Record<SupportServiceActionType, string>> = {
  phone: 'Telefon',
  sms: 'SMS',
  website: 'Webseite',
  chat: 'Chat',
};

/**
 * An Anlaufstelle as iOS search lists it: its name, its teaser, and the words it should be found by
 * besides those - the region and how it is reached („Telefon“, „Chat“). Never a phone number, a link
 * or anything else a result would act on: a search result only opens the entry in the app.
 */
export function supportServiceEntry(service: SupportServiceView): SearchEntry {
  return {
    id: `${SERVICE_DESTINATION_PREFIX}${service.id}`,
    title: service.name,
    description: service.teaser,
    keywords: unique([
      'Anlaufstelle',
      supportServiceRegionLabel(service.region),
      ...service.actions.map((action) => ACTION_KEYWORDS[action.type]),
    ]),
  };
}

/** A bookmarked content item as iOS search lists it: title, teaser and its kind („Wissen“). */
export function bookmarkEntry(item: ContentItemView): SearchEntry {
  return {
    id: `${CONTENT_DESTINATION_PREFIX}${item.id}`,
    title: item.title,
    description: item.teaser,
    keywords: unique([contentKindLabel(item.kind), 'Meine Sammlung']),
  };
}

function unique(words: readonly string[]): string[] {
  return [...new Set(words.map((word) => word.trim()).filter((word) => word !== ''))];
}
