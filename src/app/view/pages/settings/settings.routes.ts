import { Routes } from '@angular/router';

import { AboutPage } from './about/about.page';
import { AppIconPage } from './app-icon/app-icon.page';
import { CalendarsPage } from './calendars/calendars.page';
import { CuratedCalendarsPage } from './calendars/curated/curated-calendars.page';
import { DeviceCalendarsPage } from './calendars/device/device-calendars.page';
import { IcsCalendarsPage } from './calendars/ics/ics-calendars.page';
import { ContentCatalogPage } from './content-catalog/content-catalog.page';
import { DevToolsPage } from './dev-tools/dev-tools.page';
import { ImageCreditsPage } from './image-credits/image-credits.page';
import { LicensesPage } from './licenses/licenses.page';
import { MotionPage } from './motion/motion.page';
import { ProfilePage } from './profile/profile.page';
import { SettingsOverviewPage } from './overview/overview.page';
import { SettingsRemindersPage } from './reminders/reminders.page';
import { TextSizePage } from './text-size/text-size.page';
import { ThemePage } from './theme/theme.page';

// Settings is reached from Today and is a focused area throughout, so no route declares a `tab`
// and the bottom navigation stays hidden.
export const SETTINGS_ROUTES: Routes = [
  { path: '', component: SettingsOverviewPage, title: 'Einstellungen' },
  { path: 'profile', component: ProfilePage, title: 'Profil' },
  { path: 'theme', component: ThemePage, title: 'Farbthema' },
  { path: 'text-size', component: TextSizePage, title: 'Textgröße' },
  { path: 'app-icon', component: AppIconPage, title: 'App-Symbol' },
  { path: 'motion', component: MotionPage, title: 'Bewegung & Animationen' },
  { path: 'reminders', component: SettingsRemindersPage, title: 'Nicht vergessen' },
  { path: 'calendars', component: CalendarsPage, title: 'Kalender verwalten' },
  {
    path: 'calendars/curated',
    component: CuratedCalendarsPage,
    title: 'Amazone & Partnerkalender',
  },
  { path: 'calendars/device', component: DeviceCalendarsPage, title: 'Gerätekalender' },
  { path: 'calendars/ics', component: IcsCalendarsPage, title: 'Abonnierte Kalender' },
  { path: 'licenses', component: LicensesPage, title: 'Open-Source-Lizenzen' },
  { path: 'image-credits', component: ImageCreditsPage, title: 'Bildnachweise' },
  { path: 'about', component: AboutPage, title: 'Über die App' },
  { path: 'content-catalog', component: ContentCatalogPage, title: 'Alle Inhalte (Debug)' },
  { path: 'dev-tools', component: DevToolsPage, title: 'Entwickler-Werkzeuge' },
];
