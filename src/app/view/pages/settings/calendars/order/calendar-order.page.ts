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
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

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
    () => this.arranged() ?? this.calendars.value() ?? [],
  );

  protected readonly isLoading = computed(() => this.calendars.isLoading());
  protected readonly canReorder = computed(() => this.rows().length > 1);

  /** A row was dropped somewhere else in the list. */
  protected async drop(event: CdkDragDrop<readonly CalendarFilterOption[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    await this.moveTo(event.previousIndex, event.currentIndex);
  }

  protected async runAction(action: CalendarOrderAction, index: number): Promise<void> {
    await this.moveTo(index, action === 'move-up' ? index - 1 : index + 1);
  }

  private async moveTo(from: number, to: number): Promise<void> {
    const rows = this.rows();
    const moved = rows[from];
    if (moved === undefined || to < 0 || to >= rows.length) {
      return;
    }

    const reordered = [...rows];
    moveItemInArray(reordered, from, to);
    this.arranged.set(reordered);

    await this.calendarFilters.move(moved.id, to);

    // Announced and nowhere else: after a drop nothing on screen states where the row ended up,
    // and after a menu selection the menu that was operated has already closed. A second, visible
    // live region would make one move sound like two.
    this.announcer.announce(`„${moved.name}“ ist jetzt an Position ${to + 1} von ${rows.length}`);
  }
}
