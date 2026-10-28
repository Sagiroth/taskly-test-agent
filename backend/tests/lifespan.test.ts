import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';
import { createApp } from '../src/factory.ts';
import { start } from '../src/core/lifespan.ts';

vi.mock('../src/core/database.ts', () => ({ createDatabase: vi.fn(), initialize: vi.fn() }));
vi.mock('../src/factory.ts', () => ({ createApp: vi.fn() }));

type Handler = () => void;

function setup({ listenError }: { listenError?: Error } = {}) {
  const database = { $connect: vi.fn().mockResolvedValue(undefined), $disconnect: vi.fn().mockResolvedValue(undefined) };
  vi.mocked(createDatabase).mockReturnValue(database as never);
  vi.mocked(initialize).mockResolvedValue(undefined);
  const server = Object.assign(new EventEmitter(), {
    address: vi.fn(() => ({ port: 8123 })),
    close: vi.fn(),
  });
  const app = {
    listen: vi.fn((port: number, host: string, callback: () => void) => {
      queueMicrotask(() => (listenError ? server.emit('error', listenError) : callback()));
      return server;
    }),
  };
  vi.mocked(createApp).mockReturnValue(app as never);
  const handlers: Record<string, Handler> = {};
  vi.spyOn(process, 'once').mockImplementation(((event: string, handler: Handler) => {
    handlers[event] = handler;
    return process;
  }) as never);
  return { database, server, app, handlers };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  vi.stubEnv('API_PORT', '');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

it('connects, initialises the schema and listens on port 8000 by default', async () => {
  const { database, app, server } = setup();
  const result = await start();
  expect(createDatabase).toHaveBeenCalledWith('postgresql://test:test@localhost:5432/test');
  expect(database.$connect).toHaveBeenCalledOnce();
  expect(initialize).toHaveBeenCalledWith(database);
  expect(createApp).toHaveBeenCalledWith(database);
  expect(app.listen).toHaveBeenCalledWith(8000, '0.0.0.0', expect.any(Function));
  expect(console.log).toHaveBeenCalledWith('Taskly App Node API listening on port 8123');
  expect(result).toEqual({ server, database });
});

it('listens on API_PORT when set', async () => {
  vi.stubEnv('API_PORT', '9001');
  const { app } = setup();
  await start();
  expect(app.listen).toHaveBeenCalledWith(9001, '0.0.0.0', expect.any(Function));
});

it('registers graceful shutdown for SIGTERM and SIGINT', async () => {
  const { handlers } = setup();
  await start();
  expect(Object.keys(handlers).sort()).toEqual(['SIGINT', 'SIGTERM']);
  expect(handlers.SIGINT).toBe(handlers.SIGTERM);
});

it('closes the server and disconnects the database on shutdown', async () => {
  vi.useFakeTimers();
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const { handlers, server, database } = setup();
  await start();
  handlers.SIGTERM();
  expect(server.close).toHaveBeenCalledOnce();
  expect(database.$disconnect).not.toHaveBeenCalled();
  await server.close.mock.calls[0][0]();
  expect(database.$disconnect).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(10000);
  expect(exit).not.toHaveBeenCalled();
  expect(process.exitCode).toBeUndefined();
});

it('sets a failing exit code when disconnecting fails during shutdown', async () => {
  vi.useFakeTimers();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { handlers, server, database } = setup();
  const failure = new Error('disconnect failed');
  await start();
  database.$disconnect.mockRejectedValue(failure);
  handlers.SIGINT();
  await server.close.mock.calls[0][0]();
  expect(consoleError).toHaveBeenCalledWith(failure);
  expect(process.exitCode).toBe(1);
});

it('forces exit with code 1 when the server does not close within 10 seconds', async () => {
  vi.useFakeTimers();
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const { handlers } = setup();
  await start();
  handlers.SIGTERM();
  vi.advanceTimersByTime(9999);
  expect(exit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(exit).toHaveBeenCalledWith(1);
});

it('disconnects and rethrows when connecting fails', async () => {
  const { database, app } = setup();
  database.$connect.mockRejectedValue(new Error('connection refused'));
  await expect(start()).rejects.toThrow('connection refused');
  expect(database.$disconnect).toHaveBeenCalledOnce();
  expect(initialize).not.toHaveBeenCalled();
  expect(app.listen).not.toHaveBeenCalled();
});

it('disconnects and rethrows when schema initialisation fails', async () => {
  const { database, app } = setup();
  vi.mocked(initialize).mockRejectedValue(new Error('permission denied'));
  await expect(start()).rejects.toThrow('permission denied');
  expect(database.$disconnect).toHaveBeenCalledOnce();
  expect(app.listen).not.toHaveBeenCalled();
});

it('disconnects and rethrows when the server cannot listen', async () => {
  const { database, handlers } = setup({ listenError: new Error('EADDRINUSE') });
  await expect(start()).rejects.toThrow('EADDRINUSE');
  expect(database.$disconnect).toHaveBeenCalledOnce();
  expect(handlers).toEqual({});
});

it('throws without connecting when no database configuration is available', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('POSTGRES_USER', '');
  setup();
  await expect(start()).rejects.toThrow('Missing environment variable: POSTGRES_USER');
  expect(createDatabase).not.toHaveBeenCalled();
});
