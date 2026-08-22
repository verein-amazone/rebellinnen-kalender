import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A support service's colour identity as a small rounded-square badge (Anlaufstellen, #24
 * follow-up) — `CalendarAvatar`'s sibling, but square rather than circular so the two identities
 * read as visually distinct contexts, and able to show a real organisation logo once one is
 * sourced and its usage rights are cleared (`logoPath`), falling back to the icon/colour badge if
 * the image 404s or `logoPath` is absent. Purely decorative either way — the service is always
 * named in text next to it — so it is `aria-hidden`.
 */
@Component({
  selector: 'app-support-service-avatar',
  host: { class: 'inline-block' },
  templateUrl: './support-service-avatar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportServiceAvatar {
  readonly icon = input.required<string>();
  readonly color = input.required<string>();
  readonly logoPath = input<string | null>(null);

  private readonly logoFailed = signal(false);
  protected readonly showLogo = computed(() => this.logoPath() !== null && !this.logoFailed());

  protected onLogoError(): void {
    this.logoFailed.set(true);
  }
}
