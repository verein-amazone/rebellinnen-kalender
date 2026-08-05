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
};

export default config;
