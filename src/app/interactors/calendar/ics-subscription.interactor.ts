import { inject, Injectable } from '@angular/core';

import {
  CalendarRepository,
  icsCalendarRowId,
  type CalendarContext,
} from '@app/data/calendar/calendar.repository';
import { parseIcsCalendar } from '@app/data/calendar/ics/ics-parser';
import { normalizeIcsUrl, redactIcsUrl } from '@app/data/calendar/ics/ics-url';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';
import type { CalendarSourceState } from '@app/data/entities/calendar-source.record';
import { EmojiPickerGateway } from '@app/data/gateways/emoji-picker.gateway';
import { IcsHttpGateway } from '@app/data/gateways/ics-http.gateway';

export { IcsUrlInvalidError } from '@app/data/calendar/ics/ics-url';

/** Foreground auto-refresh only bothers the network when the last success is older than this. */
export const ICS_AUTO_REFRESH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export const ICS_SUBSCRIPTION_NAME_MAX_LENGTH = 200;

export class IcsSubscriptionNameInvalidError extends Error {
  constructor() {
    super('Der Name darf nicht leer und höchstens 200 Zeichen lang sein.');
    this.name = 'IcsSubscriptionNameInvalidError';
  }
}

export type IcsRefreshOutcome = 'updated' | 'unchanged' | 'failed';

/** One ICS subscription as the calendar-management screen lists it. */
export interface IcsSubscriptionRow {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly enabled: boolean;
  readonly state: CalendarSourceState;
  readonly lastError: string | null;
}

/**
 * The lifecycle of ICS subscriptions: add, refresh, remove, and — for the management screen —
 * renaming/recolouring, enabling/disabling and listing.
 *
 * A subscription is a read-only calendar source of its own. A refresh only replaces data after
 * download, parse and normalization all succeeded — otherwise the last valid offline copy stays
 * and the source is flagged. The subscription URL is sensitive; every log- or UI-facing string
 * uses its redacted form.
 */
@Injectable({ providedIn: 'root' })
export class IcsSubscriptionInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly http = inject(IcsHttpGateway);
  private readonly emojiPicker = inject(EmojiPickerGateway);
  private readonly sources = inject(CalendarSourceDao);

  /**
   * Adds a subscription and loads it once. Throws `IcsUrlInvalidError` for an unusable link; a
   * failing first download keeps the subscription with an error state the UI can explain.
   */
  async add(
    name: string,
    url: string,
    options: { allowInsecure?: boolean } = {},
  ): Promise<{ subscriptionId: string; outcome: IcsRefreshOutcome }> {
    const allowInsecure = options.allowInsecure ?? false;
    const normalizedUrl = normalizeIcsUrl(url, { allowInsecure });
    const trimmedName = validatedName(name);
    const context = this.context();
    const subscriptionId = crypto.randomUUID();

    await this.repository.createIcsSubscription(
      {
        id: subscriptionId,
        type: 'ics',
        name: trimmedName,
        enabled: true,
        state: 'ok',
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
      },
      {
        id: icsCalendarRowId(subscriptionId),
        sourceId: subscriptionId,
        name: trimmedName,
        color: null,
        emoji: null,
        enabled: true,
        writable: false,
        externalId: null,
        nativeSourceId: null,
        nativeSourceName: null,
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
      },
      {
        id: subscriptionId,
        url: normalizedUrl,
        allowInsecure,
        etag: null,
        lastModified: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        activeRevisionId: null,
        rawIcs: null,
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
        curatedId: null,
      },
    );

    const outcome = await this.refresh(subscriptionId, { force: true });
    return { subscriptionId, outcome };
  }

  /** Refreshes one subscription; without `force` it respects the conditional-request metadata. */
  async refresh(
    subscriptionId: string,
    options: { force?: boolean } = {},
  ): Promise<IcsRefreshOutcome> {
    const context = this.context();
    const subscription = await this.repository.findIcsSubscription(subscriptionId);
    if (subscription === null) {
      return 'failed';
    }

    try {
      const result = await this.http.download({
        url: subscription.url,
        etag: options.force === true ? null : subscription.etag,
        lastModified: options.force === true ? null : subscription.lastModified,
      });

      if (result.status === 'not-modified') {
        await this.repository.recordIcsNotModified(subscriptionId, context);
        return 'unchanged';
      }

      const revisionId = crypto.randomUUID();
      const parsed = parseIcsCalendar(result.body, subscriptionId, revisionId);
      if (parsed.warnings.length > 0) {
        // Individually unusable components are skipped rather than failing the whole feed, but
        // that must leave a trace instead of silently losing data.
        console.warn(
          `ICS subscription ${redactIcsUrl(subscription.url)}: skipped ${parsed.warnings.length} unusable entr${parsed.warnings.length === 1 ? 'y' : 'ies'}.`,
          parsed.warnings,
        );
      }
      await this.repository.activateIcsRevision(
        subscriptionId,
        revisionId,
        parsed,
        result.body,
        result.etag,
        result.lastModified,
        context,
      );
      return 'updated';
    } catch (error) {
      // Never the URL itself: the message plus the redacted origin is enough to diagnose.
      const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';
      await this.repository.recordIcsFailure(
        subscriptionId,
        `${reason} (${redactIcsUrl(subscription.url)})`,
        context,
      );
      return 'failed';
    }
  }

  /** Refreshes every subscription whose last success is older than the auto-refresh age. */
  async refreshAllDue(): Promise<void> {
    const now = Date.now();
    for (const subscription of await this.repository.listIcsSubscriptions()) {
      const lastSuccess =
        subscription.lastSuccessAt === null ? 0 : Date.parse(subscription.lastSuccessAt);
      if (now - lastSuccess >= ICS_AUTO_REFRESH_MAX_AGE_MS) {
        await this.refresh(subscription.id);
      }
    }
  }

  /** Removes the subscription with its source, calendar, normalized data and derived rows. */
  async remove(subscriptionId: string): Promise<void> {
    await this.repository.removeIcsSubscription(subscriptionId);
  }

  /** Renames the subscription's calendar or changes its colour/emoji identity. */
  async updateIdentity(
    subscriptionId: string,
    identity: { name: string; color: string | null; emoji: string | null },
  ): Promise<void> {
    const trimmedName = validatedName(identity.name);
    await this.repository.updateCalendarIdentity(
      icsCalendarRowId(subscriptionId),
      { name: trimmedName, color: identity.color, emoji: identity.emoji },
      this.context(),
    );
  }

  /** Enables or disables the subscription; its source and calendar flip together. */
  async setEnabled(subscriptionId: string, enabled: boolean): Promise<void> {
    await this.repository.setIcsSubscriptionEnabled(subscriptionId, enabled, this.context());
  }

  /** Opens the emoji picker; resolves `null` when the user dismisses it without a selection. */
  pickEmoji(): Promise<string | null> {
    return this.emojiPicker.pickEmoji();
  }

  /** Lists every ICS subscription joined with its calendar identity, for the management screen. */
  async listForManagement(): Promise<IcsSubscriptionRow[]> {
    const [sources, calendars, subscriptions] = await Promise.all([
      this.sources.listSources(),
      this.sources.listCalendars(),
      this.repository.listIcsSubscriptions(),
    ]);

    const calendarBySourceId = new Map(calendars.map((calendar) => [calendar.sourceId, calendar]));
    const subscriptionById = new Map(
      subscriptions.map((subscription) => [subscription.id, subscription]),
    );

    return sources
      .filter(
        (source) => source.type === 'ics' && subscriptionById.get(source.id)?.curatedId == null,
      )
      .map((source) => {
        const calendar = calendarBySourceId.get(source.id);
        return {
          id: source.id,
          name: calendar?.name ?? source.name,
          color: calendar?.color ?? null,
          emoji: calendar?.emoji ?? null,
          enabled: source.enabled,
          state: source.state,
          lastError: subscriptionById.get(source.id)?.lastError ?? null,
        };
      });
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

function validatedName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > ICS_SUBSCRIPTION_NAME_MAX_LENGTH) {
    throw new IcsSubscriptionNameInvalidError();
  }

  return trimmed;
}
