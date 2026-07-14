import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MarkdownRenderer } from '@app/cross-cutting/markdown/markdown-renderer';

/**
 * Reusable primitive that renders a restricted, sanitized Markdown subset.
 *
 * The Markdown is converted by the internal {@link MarkdownRenderer}; the result
 * is bound through `[innerHTML]`, so Angular sanitizes it again. This component
 * never uses `bypassSecurityTrustHtml` and does not touch the DOM directly.
 */
@Component({
  selector: 'app-markdown-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="markdown-content" [innerHTML]="renderedHtml()"></div>`,
})
export class MarkdownContentComponent {
  private readonly renderer = inject(MarkdownRenderer);

  /** Markdown source to render. */
  readonly markdown = input.required<string>();

  protected readonly renderedHtml = computed(() => this.renderer.render(this.markdown()));
}
