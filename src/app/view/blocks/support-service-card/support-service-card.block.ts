import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideExternalLink,
  LucideMessageCircle,
  LucideMessageSquare,
  LucidePhone,
  LucideTriangleAlert,
} from '@lucide/angular';

import type {
  SupportServiceActionType,
  SupportServiceView,
} from '@app/interactors/support-services/support-service.vm';
import { SupportServiceAvatar } from '@app/view/components/support-service-avatar/support-service-avatar';

/** `website`/`chat` actions open outside the app; `phone`/`sms` hand off to the OS as-is. */
const EXTERNAL_LINK_TYPES: readonly SupportServiceActionType[] = ['website', 'chat'];

/**
 * One Anlaufstelle as a self-contained, non-tappable card (#24) - only its buttons act.
 *
 * Each entry authors its own list of contact actions (`phone`/`sms`/`website`/`chat`) with an
 * exact `uri` and button label already decided in the catalog data - this component renders
 * whatever it's given rather than inferring the action from a raw phone number at render time
 * (a short number like `147` and a full `+43…` number need different `tel:` handling, which the
 * content author already resolved; see `docs/content-authoring.md`).
 *
 * The crisis marker pairs an icon with an explicit text label rather than colour alone, and each
 * action's accessible name includes the service name so a screen-reader user navigating by
 * control type can still tell which service "Anrufen" belongs to.
 */
@Component({
  selector: 'app-support-service-card',
  host: { class: 'block' },
  imports: [
    LucideExternalLink,
    LucideMessageCircle,
    LucideMessageSquare,
    LucidePhone,
    LucideTriangleAlert,
    SupportServiceAvatar,
  ],
  templateUrl: './support-service-card.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportServiceCardBlock {
  readonly service = input.required<SupportServiceView>();

  protected isExternal(type: SupportServiceActionType): boolean {
    return EXTERNAL_LINK_TYPES.includes(type);
  }

  protected actionAriaLabel(name: string, label: string, displayValue: string | null): string {
    return displayValue === null ? `${name}: ${label}` : `${name}: ${label} (${displayValue})`;
  }
}
