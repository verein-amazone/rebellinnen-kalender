import { Routes } from '@angular/router';

import { CalendarOverviewPage } from './overview/overview.page';
import { EventDetailPage } from './event-detail/event-detail.page';
import { NewEventPage } from './new-event/new-event.page';

export const CALENDAR_ROUTES: Routes = [
  { path: '', component: CalendarOverviewPage, title: 'Kalender', data: { tab: 'calendar' } },
  // Focused screens: no `tab`, so the bottom navigation is hidden while they are open.
  { path: 'event/new', component: NewEventPage, title: 'Neuer Termin' },
  { path: 'event/:id', component: EventDetailPage, title: 'Termin' },
];
