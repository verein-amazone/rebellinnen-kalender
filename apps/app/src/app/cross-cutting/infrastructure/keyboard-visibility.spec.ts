import { TestBed } from '@angular/core/testing';

import {
  KEYBOARD_PLUGIN,
  type KeyboardOpening,
  type KeyboardPlugin,
} from '@app/cross-cutting/plugins/keyboard.plugin';
import { DevicePlatformService, type DevicePlatform } from './device-platform';
import {
  APP_HEIGHT_PROPERTY,
  KEYBOARD_INSET_PROPERTY,
  KeyboardVisibility,
} from './keyboard-visibility';

type KeyboardEvent = 'keyboardWillShow' | 'keyboardWillHide' | 'keyboardDidHide';

/** Records the listeners so a test can play the plugin's events in its own order. */
class StubKeyboardPlugin {
  private readonly listeners = new Map<KeyboardEvent, (info: KeyboardOpening) => void>();

  readonly addListener = ((eventName: KeyboardEvent, listener: (info: KeyboardOpening) => void) => {
    this.listeners.set(eventName, listener);
    return Promise.resolve({ remove: () => Promise.resolve() });
  }) as KeyboardPlugin['addListener'];

  emit(eventName: KeyboardEvent, keyboardHeight = 0): void {
    this.listeners.get(eventName)?.({ keyboardHeight });
  }
}

/** The layout viewport as the code under test reads it, and the resize a platform would fire. */
function resizeViewport(height: number, width = 400): void {
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: height,
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function rootProperty(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

describe('KeyboardVisibility', () => {
  let plugin: StubKeyboardPlugin;

  function setUp(platform: DevicePlatform): KeyboardVisibility {
    plugin = new StubKeyboardPlugin();
    TestBed.configureTestingModule({
      providers: [
        { provide: KEYBOARD_PLUGIN, useValue: plugin },
        { provide: DevicePlatformService, useValue: { platform } },
      ],
    });
    const keyboard = TestBed.inject(KeyboardVisibility);
    TestBed.tick();
    return keyboard;
  }

  beforeEach(() => resizeViewport(800));

  afterEach(() => {
    vi.useRealTimers();
    const root = document.documentElement as unknown as Record<string, unknown>;
    delete root['clientHeight'];
    delete root['clientWidth'];
    document.documentElement.style.removeProperty(KEYBOARD_INSET_PROPERTY);
    document.documentElement.style.removeProperty(APP_HEIGHT_PROPERTY);
  });

  it('insets by the whole keyboard where the viewport keeps its height (iOS)', () => {
    const keyboard = setUp('ios');

    plugin.emit('keyboardWillShow', 300);
    TestBed.tick();

    expect(keyboard.visible()).toBe(true);
    expect(keyboard.inset()).toBe(300);
    expect(rootProperty(KEYBOARD_INSET_PROPERTY)).toBe('300px');
    expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('800px');

    plugin.emit('keyboardWillHide');
    TestBed.tick();
    expect(keyboard.inset()).toBe(0);
    expect(keyboard.visible()).toBe(true);

    plugin.emit('keyboardDidHide');
    expect(keyboard.visible()).toBe(false);
  });

  it('keeps the shell at full height where the platform shrinks the viewport (Android)', () => {
    const keyboard = setUp('android');

    // Android resizes the WebView before it announces the keyboard.
    resizeViewport(490);
    plugin.emit('keyboardWillShow', 336);
    TestBed.tick();

    expect(keyboard.visible()).toBe(true);
    expect(keyboard.inset()).toBe(0);
    expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('800px');

    resizeViewport(800);
    plugin.emit('keyboardWillHide');
    plugin.emit('keyboardDidHide');
    TestBed.tick();

    expect(keyboard.visible()).toBe(false);
    expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('800px');
  });

  it('follows a shrinking viewport once no keyboard has claimed it', () => {
    vi.useFakeTimers();
    setUp('android');

    resizeViewport(600);
    TestBed.tick();
    expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('800px');

    vi.advanceTimersByTime(500);
    TestBed.tick();
    expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('600px');
  });

  it('follows a rotation at once', () => {
    setUp('android');

    resizeViewport(390, 850);
    TestBed.tick();

    expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('390px');
  });

  describe('on the web', () => {
    class StubVisualViewport extends EventTarget {
      height = 800;
      offsetTop = 0;
      scale = 1;
    }

    let viewport: StubVisualViewport;

    beforeEach(() => {
      viewport = new StubVisualViewport();
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    });

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>)['visualViewport'];
    });

    it('measures the keyboard from the visual viewport and never pins the shell', () => {
      const keyboard = setUp('web');

      viewport.height = 480;
      viewport.dispatchEvent(new Event('resize'));
      TestBed.tick();

      expect(keyboard.inset()).toBe(320);
      expect(keyboard.visible()).toBe(true);
      expect(rootProperty(KEYBOARD_INSET_PROPERTY)).toBe('320px');
      expect(rootProperty(APP_HEIGHT_PROPERTY)).toBe('');
    });

    it('does not take a pinch zoom or a collapsing toolbar for a keyboard', () => {
      const keyboard = setUp('web');

      viewport.scale = 2;
      viewport.height = 400;
      viewport.dispatchEvent(new Event('resize'));
      expect(keyboard.inset()).toBe(0);

      viewport.scale = 1;
      viewport.height = 740;
      viewport.dispatchEvent(new Event('resize'));
      expect(keyboard.inset()).toBe(0);
    });
  });
});
