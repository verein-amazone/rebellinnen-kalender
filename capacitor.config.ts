import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.or.amazone.rebellinnenkalender',
  appName: 'Rebell*innen Kalender',
  webDir: 'dist/rebellinnen-kalender/browser',
  // An Android System WebView older than the `.browserslistrc` floor cannot run the app - it shows a
  // white screen. Below this version Capacitor loads `server.errorPath` instead - a static page that
  // asks for the WebView update through the Play Store, and that both platforms also show when the
  // app's own page fails to load. Keep the number equal to the Chrome floor
  // in `.browserslistrc`. On iOS the WebView comes with the OS, and the deployment target already
  // guarantees it.
  android: {
    minWebViewVersion: 108,
  },
  server: {
    errorPath: 'startup-error.html',
  },
  ios: {
    // Required by @capacitor/text-zoom: without it the plugin has no effect on iPad, where the
    // WebView would otherwise run in desktop content mode.
    preferredContentMode: 'mobile',
  },
  plugins: {
    // 'none': the WebView keeps its full height while the keyboard is open, the same as Android's
    // adjustNothing (AndroidManifest.xml). Resizing it ('native') squeezed the whole shell into the
    // space above the keyboard - the tab bar pushed up, and even the emoji keyboard behind the
    // native emoji picker shrinking the page beneath it. The keyboard height is published as
    // `--rk-keyboard-inset` instead (cross-cutting/infrastructure/keyboard-visibility.ts), and the
    // sheet body and the scroll region pad themselves by it. 'body' is not an option: it only sets
    // `document.body.style.height`, which a `position: fixed` sheet does not follow.
    Keyboard: {
      resize: 'none',
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
