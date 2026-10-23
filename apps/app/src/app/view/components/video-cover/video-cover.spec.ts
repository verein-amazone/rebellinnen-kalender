import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { VideoView } from '@app/interactors/daily-content/content-item.vm';

import { VideoCover } from './video-cover';

const VIDEO: VideoView = { provider: 'youtube', id: 'teTZq72DAlM', orientation: 'landscape' };

async function setup(config: { video?: VideoView; online?: boolean } = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(config.online ?? true);

  const fixture = TestBed.createComponent(VideoCover);
  fixture.componentRef.setInput('video', config.video ?? VIDEO);
  fixture.componentRef.setInput('title', 'body rEVOLution!');
  fixture.componentRef.setInput('posterPath', '/content/images/body.webp');
  fixture.componentRef.setInput('posterAlt', 'Junge Frau, nah an der Kamera.');
  fixture.componentRef.setInput('returnTo', '/content/wi-301');
  const plays: number[] = [];
  fixture.componentInstance.playRequested.subscribe(() => plays.push(1));
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  return {
    element,
    plays,
    settle: () => fixture.whenStable(),
    button: () => element.querySelector<HTMLButtonElement>('button'),
  };
}

describe('VideoCover', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names the play button by its visible label first, then the item', async () => {
    const { button } = await setup();

    expect(button()?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Video abspielen: body rEVOLution!',
    );
  });

  it('shows the picture as decoration and reads its description with the notice', async () => {
    const { element, button } = await setup();
    const notice = element.querySelector(`#${button()?.getAttribute('aria-describedby')}`);

    expect(element.querySelector('button img')?.getAttribute('alt')).toBe('');
    expect(notice?.textContent).toContain('Standbild: Junge Frau, nah an der Kamera.');
    expect(notice?.textContent).toContain('Daten an Google übertragen');
  });

  it('links the privacy policy, coming back to this screen', async () => {
    const { element } = await setup();

    expect(
      element
        .querySelector<HTMLAnchorElement>('a[href^="/settings/privacy"]')
        ?.getAttribute('href'),
    ).toBe('/settings/privacy?returnTo=%2Fcontent%2Fwi-301');
  });

  it('asks to play on a tap, and loads nothing itself', async () => {
    const { element, plays, button, settle } = await setup();

    button()?.click();
    await settle();

    expect(plays).toHaveLength(1);
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('says why nothing happens while offline, and does not ask to play', async () => {
    const { element, plays, button, settle } = await setup({ online: false });

    button()?.click();
    await settle();

    expect(plays).toHaveLength(0);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Du bist offline');
  });

  it('always offers the video on YouTube itself', async () => {
    const { element } = await setup();

    expect(element.querySelector<HTMLAnchorElement>('a[target="_blank"]')?.href).toBe(
      'https://www.youtube.com/watch?v=teTZq72DAlM',
    );
  });

  it('offers only the link, with the picture described, for an id that cannot be played', async () => {
    const { element, button } = await setup({ video: { ...VIDEO, id: 'not-an-id' } });

    expect(button()).toBeNull();
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(
      'Junge Frau, nah an der Kamera.',
    );
    expect(element.querySelector('a[target="_blank"]')).not.toBeNull();
  });
});
