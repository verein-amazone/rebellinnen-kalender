import { TestBed } from '@angular/core/testing';

import { DeviceSiriAndSearch } from '@app/cross-cutting/infrastructure/siri-and-search';

import type { AppDestination } from './app-destination';
import { ExternalDestinationsInteractor } from './external-destinations.interactor';

describe('ExternalDestinationsInteractor', () => {
  it('hands on the destinations it knows, and drops the rest', () => {
    const device: { deliver: (destination: string) => void } = { deliver: () => undefined };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DeviceSiriAndSearch,
          useValue: {
            onDestinationOpened: (handler: (destination: string) => void) => {
              device.deliver = handler;
              return () => undefined;
            },
          },
        },
      ],
    });
    const opened: AppDestination[] = [];

    TestBed.inject(ExternalDestinationsInteractor).onDestinationOpened((destination) =>
      opened.push(destination),
    );
    device.deliver('content:wi-01');
    device.deliver('something-newer');

    expect(opened).toEqual([{ commands: ['/content', 'wi-01'] }]);
  });
});
