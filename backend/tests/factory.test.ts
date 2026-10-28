import request from 'supertest';
import { afterEach, it, expect, vi } from 'vitest';
import { createApp } from '../src/factory.ts';
import type { Database } from '../src/features/todos/types.ts';
import { record, todo } from './fixture.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const database = {
    todo: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([record]),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateManyAndReturn: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { app: createApp(database as unknown as Database), database };
}

it('reports health after querying the database', async () => {
  const { app, database } = setup();
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(database.todo.findFirst).toHaveBeenCalledWith({ select: { id: true } });
});

it('returns 500 from the health check when the database is unavailable', async () => {
  const { app, database } = setup();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('Database unavailable');
  database.todo.findFirst.mockRejectedValue(failure);
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(consoleError).toHaveBeenCalledWith(failure);
});

it('serves the todos API backed by the database', async () => {
  const { app, database } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(database.todo.findMany).toHaveBeenCalledOnce();
});

it('archives completed tasks through the database', async () => {
  const { app, database } = setup();
  database.todo.updateMany.mockResolvedValue({ count: 3 });
  const response = await request(app).post('/api/todos/archive-completed');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ archived: 3 });
  expect(database.todo.updateMany).toHaveBeenCalledOnce();
});

it('lists only archived tasks from the database with archived=true', async () => {
  const { app, database } = setup();
  database.todo.findMany.mockResolvedValue([{ ...record, completed: true, archived: true }]);
  const response = await request(app).get('/api/todos?archived=true');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([{ ...todo, completed: true, archived: true }]);
  expect(database.todo.findMany).toHaveBeenCalledWith({
    where: { archived: true }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
});

it('returns 500 and logs the error when archiving fails in the database', async () => {
  const { app, database } = setup();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('Database unavailable');
  database.todo.updateMany.mockRejectedValue(failure);
  const response = await request(app).post('/api/todos/archive-completed');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(consoleError).toHaveBeenCalledWith(failure);
});

it('describes the archive endpoint in the OpenAPI specification', async () => {
  const { app } = setup();
  const response = await request(app).get('/openapi.json');
  expect(response.body.paths).toHaveProperty(['/api/todos/archive-completed', 'post']);
});

it('does not expose the x-powered-by header', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/health');
  expect(response.headers['x-powered-by']).toBeUndefined();
});

it('serves the OpenAPI specification', async () => {
  const { app } = setup();
  const response = await request(app).get('/openapi.json');
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.body).toHaveProperty('openapi');
  expect(response.body).toHaveProperty('paths');
});

it('serves the Swagger UI under /docs', async () => {
  const { app } = setup();
  const response = await request(app).get('/docs/');
  expect(response.status).toBe(200);
  expect(response.text).toContain('swagger-ui');
});

it.each(['/unknown', '/api/unknown', '/api/todos/1/extra'])('returns 404 JSON for unknown route %s', async (path) => {
  const { app } = setup();
  const response = await request(app).get(path);
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Not Found' });
});

it('returns 422 for malformed JSON without calling the database', async () => {
  const { app, database } = setup();
  const response = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
  expect(response.status).toBe(422);
  expect(response.body).toEqual({ detail: 'Invalid JSON.' });
  expect(database.todo.create).not.toHaveBeenCalled();
});

it('returns 413 for a body larger than the JSON limit without calling the database', async () => {
  const { app, database } = setup();
  const response = await request(app).post('/api/todos').set('Content-Type', 'application/json')
    .send(JSON.stringify({ title: 'Task', description: 'x'.repeat(200 * 1024) }));
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ detail: 'Request body too large.' });
  expect(database.todo.create).not.toHaveBeenCalled();
});

it('returns 500 and logs unexpected repository errors', async () => {
  const { app, database } = setup();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('Database unavailable');
  database.todo.findMany.mockRejectedValue(failure);
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(consoleError).toHaveBeenCalledWith(failure);
});

it('returns 500 for non-object errors', async () => {
  const { app, database } = setup();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  database.todo.findMany.mockRejectedValue('boom');
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(consoleError).toHaveBeenCalledWith('boom');
});
