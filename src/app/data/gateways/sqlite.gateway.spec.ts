import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CapacitorSQLitePlugin } from '@capacitor-community/sqlite';

import { DATABASE_VERSION, MIGRATIONS } from '../migrations/migrations';
import { CAPACITOR_SQLITE } from './capacitor-sqlite';
import { SqliteUnavailableError } from './sqlite-database';
import { SqliteGateway } from './sqlite.gateway';

/**
 * `SQLiteConnection` is a thin wrapper the gateway constructs around the plugin, so stubbing the
 * plugin is what puts the gateway under test. The methods below are the ones the wrapper forwards to.
 */
interface PluginStub {
  readonly calls: string[];
  failOpen: boolean;
}

function createPlugin(): CapacitorSQLitePlugin & PluginStub {
  const calls: string[] = [];

  const plugin = {
    calls,
    failOpen: false,
    checkConnectionsConsistency: async () => {
      calls.push('checkConnectionsConsistency');
      return { result: true };
    },
    addUpgradeStatement: async (options: unknown) => {
      calls.push(`addUpgradeStatement:${JSON.stringify(options)}`);
    },
    isConnection: async () => {
      calls.push('isConnection');
      return { result: false };
    },
    createConnection: async (options: unknown) => {
      calls.push(`createConnection:${JSON.stringify(options)}`);
    },
    open: async () => {
      calls.push('open');
      if (plugin.failOpen) {
        throw new Error('database locked');
      }
    },
    query: async () => {
      calls.push('query');
      return { values: [{ id: 'a' }] };
    },
    run: async () => {
      calls.push('run');
      return { changes: { changes: 1 } };
    },
    saveToStore: async () => {
      calls.push('saveToStore');
    },
    initWebStore: async () => {
      calls.push('initWebStore');
    },
  } as unknown as CapacitorSQLitePlugin & PluginStub;

  return plugin;
}

/**
 * jsdom cannot define the `jeep-sqlite` element, and the stubbed plugin does not need it — the web
 * branch is otherwise exercised as it is on `ng serve`, including `saveToStore`.
 */
@Injectable()
class WebStoreLessGateway extends SqliteGateway {
  protected override initializeWebStore(): Promise<void> {
    return Promise.resolve();
  }
}

function setup(plugin: CapacitorSQLitePlugin): SqliteGateway {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CAPACITOR_SQLITE, useValue: plugin },
      { provide: SqliteGateway, useClass: WebStoreLessGateway },
    ],
  });

  return TestBed.inject(SqliteGateway);
}

describe('SqliteGateway', () => {
  it('registers every migration before it creates the connection', async () => {
    const plugin = createPlugin();

    await setup(plugin).query('SELECT 1');

    const upgrade = plugin.calls.find((call) => call.startsWith('addUpgradeStatement:'));
    const create = plugin.calls.find((call) => call.startsWith('createConnection:'));

    expect(plugin.calls.indexOf(upgrade!)).toBeLessThan(plugin.calls.indexOf(create!));
    expect(upgrade).toContain(`"toVersion":${MIGRATIONS[0].toVersion}`);
    expect(upgrade).toContain('CREATE TABLE IF NOT EXISTS reminders');
    expect(create).toContain(`"version":${DATABASE_VERSION}`);
  });

  it('reconciles stale connections before opening, so a dev-server reload can reconnect', async () => {
    const plugin = createPlugin();

    await setup(plugin).query('SELECT 1');

    expect(plugin.calls[0]).toBe('checkConnectionsConsistency');
  });

  it('opens the database once for concurrent callers', async () => {
    const plugin = createPlugin();
    const gateway = setup(plugin);

    await Promise.all([
      gateway.query('SELECT 1'),
      gateway.query('SELECT 2'),
      gateway.run('DELETE'),
    ]);

    expect(plugin.calls.filter((call) => call === 'open')).toHaveLength(1);
  });

  it('saves to the web store after a write, so the write survives a reload', async () => {
    const plugin = createPlugin();

    await setup(plugin).run('DELETE FROM reminders');

    expect(plugin.calls).toContain('saveToStore');
  });

  it('reports an unavailable database without leaking the plugin error, and allows a retry', async () => {
    const plugin = createPlugin();
    plugin.failOpen = true;
    const gateway = setup(plugin);

    await expect(gateway.query('SELECT 1')).rejects.toBeInstanceOf(SqliteUnavailableError);

    plugin.failOpen = false;
    await expect(gateway.query('SELECT 1')).resolves.toEqual([{ id: 'a' }]);
  });
});
