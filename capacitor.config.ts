import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.or.amazone.rebellinnenkalender',
  appName: 'Rebell*innen Kalender',
  webDir: 'dist/rebellinnen-kalender/browser',
  ios: {
    // Required by @capacitor/text-zoom: without it the plugin has no effect on iPad, where the
    // WebView would otherwise run in desktop content mode.
    preferredContentMode: 'mobile',
  },
  plugins: {
    // 'native' actually shrinks the WebView's own frame to the space left by the keyboard, the same
    // effect Android's adjustResize (AndroidManifest.xml) has. 'body' looks similar on paper, but per
    // its own plugin source only sets `document.body.style.height` - the viewport itself never
    // changes, so `dvh` units and anything `position: fixed` (the app shell, and every sheet, which
    // is a CDK overlay) stay exactly where they were and the keyboard simply covers them.
    Keyboard: {
      resize: 'native',
    },
    // Appointment reminders (#81). Android draws the status-bar icon as a white silhouette, so it
    // needs its own monochrome drawable rather than the launcher icon; the colour is the brand red.
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#E92F2A',
    },
  },
};

export default config;
