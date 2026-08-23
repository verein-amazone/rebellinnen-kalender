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
    // its own plugin source only sets `document.body.style.height` — the viewport itself never
    // changes, so `dvh` units and anything `position: fixed` (the app shell, and every sheet, which
    // is a CDK overlay) stay exactly where they were and the keyboard simply covers them.
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
