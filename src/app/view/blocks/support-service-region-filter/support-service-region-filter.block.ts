import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCheck } from '@lucide/angular';

import type { SupportServiceRegion } from '@app/interactors/support-services/support-service.vm';

/**
 * The Anlaufstellen screen's region filter (#24): one chip per region that has approved content,
 * "Online & Telefon" first. Unlike `app-calendar-source-filter` (many calendars toggled
 * independently), this is a single-select choice, so it uses `role="radiogroup"`/`role="radio"`
 * with `aria-checked` rather than `aria-pressed`.
 *
 * Selected state is signalled three ways, never by colour alone: `aria-checked`, the check icon,
 * and bold text.
 */
@Component({
  selector: 'app-support-service-region-filter',
  host: { class: 'block' },
  imports: [LucideCheck],
  templateUrl: './support-service-region-filter.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportServiceRegionFilterBlock {
  readonly regions = input.required<readonly SupportServiceRegion[]>();
  readonly selectedRegionId = input.required<string>();

  readonly regionSelected = output<string>();
}
