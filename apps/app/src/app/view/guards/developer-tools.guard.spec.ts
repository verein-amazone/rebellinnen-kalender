import { TestBed } from '@angular/core/testing';
import type { Route } from '@angular/router';

import { DEVELOPER_TOOLS_ENABLED } from '@app/cross-cutting/infrastructure/developer-tools';

import { developerToolsGuard } from './developer-tools.guard';

function runGuard(enabled: boolean): ReturnType<typeof developerToolsGuard> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: DEVELOPER_TOOLS_ENABLED, useValue: enabled }],
  });

  return TestBed.runInInjectionContext(() => developerToolsGuard({} as Route, [], {} as never));
}

describe('developerToolsGuard', () => {
  it('lets a prerelease build reach the developer tools', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('keeps a store build away from them, even by URL', () => {
    expect(runGuard(false)).toBe(false);
  });
});
