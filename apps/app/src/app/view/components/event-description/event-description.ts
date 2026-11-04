import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EventDescriptionRenderer } from '@app/cross-cutting/rich-text/event-description-renderer';

/**
 * An imported event's description: plain text with its line breaks, or - when the calendar wrote
 * HTML into it - the sanitized formatting from {@link EventDescriptionRenderer}, bound through
 * `[innerHTML]` so Angular sanitizes it again. Links are ordinary `<a href>`s; the WebView hands
 * them to the system browser, mail or phone app.
 */
@Component({
  selector: 'app-event-description',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (html(); as markup) {
      <div class="rk-event-description" [innerHTML]="markup"></div>
    } @else {
      <p class="whitespace-pre-line">{{ description() }}</p>
    }
  `,
})
export class EventDescriptionComponent {
  private readonly renderer = inject(EventDescriptionRenderer);

  /** The description as it was imported. */
  readonly description = input.required<string>();

  private readonly content = computed(() => this.renderer.render(this.description()));

  protected readonly html = computed(() => {
    const content = this.content();
    return content.format === 'html' ? content.html : null;
  });
}
