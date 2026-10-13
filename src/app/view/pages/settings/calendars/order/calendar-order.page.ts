import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  resource,
  signal,
} from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideEllipsis,
  LucideGripVertical,
} from '@lucide/angular';

import {
  CalendarFiltersInteractor,
  type CalendarFilterOption,
} from '@app/interactors/calendar/calendar-filters.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';

/** What a row's menu can do. */
export type CalendarOrderAction = 'move-up' | 'move-down';

/**
 * „Reihenfolge“: the order the Kalender screen's filter chips are shown in.
 *
 * Its own screen rather than a mode of the chip row: the calendars are spread over three settings
 * sub-screens (curated, device, subscribed), so this is the only place that shows all of them in
 * one list - and rearranging is a deliberate, occasional act, not something to stumble into while
 * filtering.
 *
 * Dragging is never the only way to move a row - „Nach oben“ and „Nach unten“ in each row's menu
 * are the tap- and keyboard-reachable equivalent, exactly as in the „Nicht vergessen“ list.
 */
@Component({
  selector: 'app-settings-calendar-order',
  host: { class: 'block' },
  imports: [
    CalendarAvatar,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FocusedScreenScaffold,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    LucideArrowDown,
    LucideArrowUp,
    LucideEllipsis,
    LucideGripVertical,
  ],
  templateUrl: './calendar-order.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarOrderPage {
  private readonly calendarFilters = inject(CalendarFiltersInteractor);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly haptics = inject(HapticsInteractor);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly calendars = resource({
    loader: () => this.calendarFilters.listFilterable(),
  });

  /**
   * The order on screen. Held next to the resource rather than read from it: after a move the list
   * must show the new order immediately, and reloading the resource would let the row snap back to
   * its old place for a frame.
   */
  private readonly arranged = signal<readonly CalendarFilterOption[] | null>(null);

  protected readonly rows = computed<readonly CalendarFilterOption[]>(
    () => this.arranged() ?? valueOr(this.calendars, []),
  );

  protected readonly isLoading = computed(() => this.calendars.isLoading());
  protected readonly canReorder = computed(() => this.rows().length > 1);

  /** A row was lifted for dragging. Felt together with the drop, like a detent. */
  protected pickedUp(): void {
    void this.haptics.selection();
  }

  /** A row was dropped somewhere else in the list. */
  protected async drop(event: CdkDragDrop<readonly CalendarFilterOption[]>): Promise<void> {
    void this.haptics.selection();
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    await this.moveTo(event.previousIndex, event.currentIndex);
  }

  /**
   * A move from a row's menu. Focus goes back to the moved calendar's menu trigger afterwards
   * (#151): the menu hands it back as it closes, but re-ordering the rows moves the trigger in the
   * DOM, and a browser blurs an element it moves.
   */
  protected async runAction(action: CalendarOrderAction, index: number): Promise<void> {
    const moved = this.rows()[index];
    if (moved === undefined) {
      return;
    }

    if (await this.moveTo(index, action === 'move-up' ? index - 1 : index + 1)) {
      afterNextRender(
        () =>
          // Matched by value rather than in the selector: an id is not guaranteed to be CSS-safe.
          Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-menu-of]'))
            .find((trigger) => trigger.dataset['menuOf'] === moved.id)
            ?.focus(),
        { injector: this.injector },
      );
    }
  }

  /** Resolves to whether there was a move to make. */
  private async moveTo(from: number, to: number): Promise<boolean> {
    const rows = this.rows();
    const moved = rows[from];
    if (moved === undefined || to < 0 || to >= rows.length) {
      return false;
    }

    const reordered = [...rows];
    moveItemInArray(reordered, from, to);
    this.arranged.set(reordered);

    await this.calendarFilters.move(moved.id, to);

    // Announced and nowhere else: after a drop nothing on screen states where the row ended up,
    // and after a menu selection the menu that was operated has already closed. A second, visible
    // live region would make one move sound like two.
    this.announcer.announce(`„${moved.name}“ ist jetzt an Position ${to + 1} von ${rows.length}`);
    return true;
  }
}
