import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProfileInteractor } from '@app/interactors/settings/profile.interactor';

import { ProfilePage } from './profile.page';

class FakeProfileInteractor {
  name = signal<string | null>(null);
  setNameCalls: string[] = [];

  setName(name: string): void {
    this.setNameCalls.push(name);
  }
}

function setup() {
  TestBed.resetTestingModule();
  const profile = new FakeProfileInteractor();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ProfileInteractor, useValue: profile }],
  });

  const fixture = TestBed.createComponent(ProfilePage);
  fixture.detectChanges();

  return { element: fixture.nativeElement as HTMLElement, profile, fixture };
}

describe('ProfilePage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the stored name in the input', () => {
    const profile = new FakeProfileInteractor();
    profile.name.set('Nina');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ProfileInteractor, useValue: profile }],
    });
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Nina');
  });

  it('calls setName as the user types', () => {
    const { element, profile } = setup();

    const input = element.querySelector('input') as HTMLInputElement;
    input.value = 'Mona';
    input.dispatchEvent(new Event('input'));

    expect(profile.setNameCalls).toEqual(['Mona']);
  });

  it('has a real label pointing at the name input', () => {
    const { element } = setup();

    const input = element.querySelector('input') as HTMLInputElement;
    const label = element.querySelector(`label[for="${input.id}"]`);
    expect(label).not.toBeNull();
  });
});
