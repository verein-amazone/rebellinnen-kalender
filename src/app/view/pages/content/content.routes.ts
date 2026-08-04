import { Routes } from '@angular/router';

import { ContentDetailPage } from './detail/detail.page';
import { ContentOverviewPage } from './overview/overview.page';

export const CONTENT_ROUTES: Routes = [
  { path: '', component: ContentOverviewPage, title: 'Inhalte', data: { tab: 'content' } },
  { path: ':id', component: ContentDetailPage, title: 'Inhalt' },
];
