import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCheck } from '@lucide/angular';

import type { ContentItemKind } from '@app/interactors/daily-content/content-item.vm';

/** One content type as the collection filter shows it, with how many saved items carry it. */
export interface ContentKindFilterOption {
  readonly id: ContentItemKind;
  readonly label: string;
  readonly count: number;
}

/**
 * „Meine Sammlung“'s content-type filter: one toggle chip per content type, every type shown by
 * default, each one switched off and back on independently.
 *
 * This is the calendar source filter's behaviour, deliberately - two filter rows in the same app
 * that look alike must not behave differently. Pressed state is signalled three ways, never by
 * colour alone: `aria-pressed`, the check icon, and bold text; a switched-off chip additionally
 * greys out.
 */
@Component({
  selector: 'app-content-kind-filter',
  host: { class: 'block' },
  imports: [LucideCheck],
  templateUrl: './content-kind-filter.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentKindFilterBlock {
  readonly kinds = input.required<readonly ContentKindFilterOption[]>();
  readonly hiddenIds = input.required<ReadonlySet<ContentItemKind>>();

  readonly toggled = output<ContentItemKind>();

  protected isVisible(kind: ContentItemKind): boolean {
    return !this.hiddenIds().has(kind);
  }
}
