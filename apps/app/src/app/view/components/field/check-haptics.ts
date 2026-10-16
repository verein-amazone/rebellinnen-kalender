import { Directive, inject } from '@angular/core';

import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';

/**
 * Makes a switch (`.rk-toggle`) or checkbox (`.rk-check`) felt when it is flipped: one light tick,
 * on and off alike, behind the app-wide vibration setting. Every such input carries it:
 * `<input type="checkbox" class="rk-toggle" appCheckHaptics />`.
 *
 * The haptic belongs to the control rather than to whichever presenter handles its change, so no
 * two switches feel different and no presenter calls `tick()` for one. It is the one view primitive
 * that injects `HapticsInteractor` itself - see docs/architecture/design-system.md § Haptics.
 */
@Directive({
  selector: 'input[type=checkbox][appCheckHaptics]',
  host: { '(change)': 'onChange()' },
})
export class CheckHaptics {
  private readonly haptics = inject(HapticsInteractor);

  protected onChange(): void {
    void this.haptics.tick();
  }
}
