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
    run: async (options: { statement: string; transaction?: boolean }) => {
      calls.push(`run:${options.statement}:tx=${String(options.transaction ?? true)}`);
      return { changes: { changes: 1 } };
    },
    execute: async (options: { statements: string; transaction?: boolean }) => {
      calls.push(`execute:${options.statements.trim()}`);
      return { changes: { changes: 0 } };
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
 * jsdom cannot define the `jeep-sqlite` element, and the stubbed plugin does not need it - the web
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

  it('commits a transaction around the callback statements and saves the store once afterwards', async () => {
    const plugin = createPlugin();
    const gateway = setup(plugin);

    await gateway.transaction(async (tx) => {
      await tx.run('INSERT INTO a VALUES (?)', ['1']);
      await tx.run('INSERT INTO b VALUES (?)', ['2']);
    });

    const begin = plugin.calls.indexOf('execute:BEGIN IMMEDIATE;');
    const first = plugin.calls.indexOf('run:INSERT INTO a VALUES (?):tx=false');
    const second = plugin.calls.indexOf('run:INSERT INTO b VALUES (?):tx=false');
    const commit = plugin.calls.indexOf('execute:COMMIT;');
    const save = plugin.calls.indexOf('saveToStore');

    // Every statement runs between BEGIN and COMMIT, opted out of the plugin's own per-statement
    // transaction, and the web store is written exactly once after the commit.
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(first).toBeGreaterThan(begin);
    expect(second).toBeGreaterThan(first);
    expect(commit).toBeGreaterThan(second);
    expect(save).toBeGreaterThan(commit);
    expect(plugin.calls.filter((call) => call === 'saveToStore')).toHaveLength(1);
  });

  it('rolls back when the callback throws, rethrows, and never touches the web store', async () => {
    const plugin = createPlugin();
    const gateway = setup(plugin);

    await expect(
      gateway.transaction(async (tx) => {
        await tx.run('INSERT INTO a VALUES (?)', ['1']);
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');

    expect(plugin.calls).toContain('execute:ROLLBACK;');
    expect(plugin.calls).not.toContain('execute:COMMIT;');
    expect(plugin.calls).not.toContain('saveToStore');
  });

  it('holds concurrent writes back until an open transaction has committed', async () => {
    const plugin = createPlugin();
    const gateway = setup(plugin);

    let releaseWork!: () => void;
    const workGate = new Promise<void>((resolve) => (releaseWork = resolve));

    const transaction = gateway.transaction(async (tx) => {
      await workGate;
      await tx.run('INSERT INTO a VALUES (?)', ['1']);
    });
    // Give the concurrent write a real chance to jump the queue before the gate opens.
    const write = gateway.run('DELETE FROM b');
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseWork();
    await Promise.all([transaction, write]);

    const commit = plugin.calls.indexOf('execute:COMMIT;');
    const concurrent = plugin.calls.indexOf('run:DELETE FROM b:tx=true');

    expect(concurrent).toBeGreaterThan(commit);
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
