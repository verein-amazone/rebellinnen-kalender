import { Routes } from '@angular/router';

import { AboutPage } from './about/about.page';
import { CalendarsPage } from './calendars/calendars.page';
import { ContentCatalogPage } from './content-catalog/content-catalog.page';
import { ImageCreditsPage } from './image-credits/image-credits.page';
import { ImprintPage } from './imprint/imprint.page';
import { LicensesPage } from './licenses/licenses.page';
import { MotionPage } from './motion/motion.page';
import { PrivacyPage } from './privacy/privacy.page';
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
  { path: 'motion', component: MotionPage, title: 'Bewegung & Animationen' },
  { path: 'reminders', component: SettingsRemindersPage, title: 'Nicht vergessen' },
  { path: 'calendars', component: CalendarsPage, title: 'Kalender verwalten' },
  { path: 'privacy', component: PrivacyPage, title: 'Datenschutz' },
  { path: 'imprint', component: ImprintPage, title: 'Impressum' },
  { path: 'licenses', component: LicensesPage, title: 'Open-Source-Lizenzen' },
  { path: 'image-credits', component: ImageCreditsPage, title: 'Bildnachweise' },
  { path: 'about', component: AboutPage, title: 'Über die App' },
  { path: 'content-catalog', component: ContentCatalogPage, title: 'Alle Inhalte (Debug)' },
];
