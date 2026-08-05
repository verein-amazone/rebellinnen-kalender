import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from '@app/app';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-text-size');
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.style.removeProperty('--rk-os-scale');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should host the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should apply the default appearance to the document root', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('amazone');
    // Text size and motion default to the device setting, which means no attribute at all.
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
    // The OS scale always reaches the document; on the web it is the neutral 1.
    expect(document.documentElement.style.getPropertyValue('--rk-os-scale')).toBe('1');
  });

  it('should reapply the appearance when the selection changes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    TestBed.inject(AppearanceInteractor).selectTheme('nacht');
    TestBed.inject(AppearanceInteractor).selectTextSize('large');
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('nacht');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
  });
});
