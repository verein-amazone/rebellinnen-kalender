import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A support service's lead visual (Anlaufstellen, #24 follow-up): a real organisation logo once
 * one is sourced and its usage rights are cleared (`logoPath`), and the entry's emoji when the
 * image 404s or `logoPath` is absent. A logo keeps a white framed tile because it brings its own
 * opaque background; an emoji is drawn plain, like the greeting emoji on the Today screen, because
 * a frame around it only competed with the card's own. Purely decorative either way - the service
 * is always named in text next to it - so it is `aria-hidden`.
 */
@Component({
  selector: 'app-support-service-avatar',
  host: { class: 'inline-block' },
  templateUrl: './support-service-avatar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportServiceAvatar {
  readonly icon = input.required<string>();
  readonly logoPath = input<string | null>(null);

  private readonly logoFailed = signal(false);
  protected readonly showLogo = computed(() => this.logoPath() !== null && !this.logoFailed());

  protected onLogoError(): void {
    this.logoFailed.set(true);
  }
}
