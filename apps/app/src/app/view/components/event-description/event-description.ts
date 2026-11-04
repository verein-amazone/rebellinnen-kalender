import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EventDescriptionRenderer } from '@app/cross-cutting/rich-text/event-description-renderer';

/**
 * An imported event's description, plain text or the HTML a calendar wrote into it, as the sanitized
 * HTML from {@link EventDescriptionRenderer}: formatting, line breaks and links kept. Bound through
 * `[innerHTML]`, so Angular sanitizes it again. Links are ordinary `<a href>`s; the WebView hands
 * them to the system browser, mail or phone app.
 */
@Component({
  selector: 'app-event-description',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  template: `<div class="rk-event-description" [innerHTML]="html()"></div>`,
})
export class EventDescriptionComponent {
  private readonly renderer = inject(EventDescriptionRenderer);

  /** The description as it was imported. */
  readonly description = input.required<string>();

  protected readonly html = computed(() => this.renderer.render(this.description()));
}
