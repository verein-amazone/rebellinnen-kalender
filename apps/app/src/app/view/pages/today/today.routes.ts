import { Routes } from '@angular/router';

import { TodayPage } from './today/today.page';

export const TODAY_ROUTES: Routes = [
  { path: '', component: TodayPage, title: 'Heute', data: { tab: 'today' } },
];
