import express from 'express';
import request from 'supertest';
import { it, expect, vi } from 'vitest';
import { createTodosRouter } from '../src/features/todos/router.ts';
import { todo } from './fixture.ts';

function setup() {
  const repository = {
    list: vi.fn().mockResolvedValue([todo]), create: vi.fn().mockResolvedValue(todo), get: vi.fn(), update: vi.fn(), delete: vi.fn(),
    archiveCompleted: vi.fn(),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
it('lists tasks from the repository', async () => {
  const { app, repository } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(repository.list).toHaveBeenCalledOnce();
});
it('lists only non-archived tasks by default', async () => {
  const { app, repository } = setup();
  await request(app).get('/api/todos');
  expect(repository.list).toHaveBeenCalledWith({ archived: false });
});
it('lists only archived tasks with archived=true', async () => {
  const { app, repository } = setup();
  const archivedTodo = { ...todo, completed: true, archived: true };
  repository.list.mockResolvedValue([archivedTodo]);
  const response = await request(app).get('/api/todos?archived=true');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([archivedTodo]);
  expect(repository.list).toHaveBeenCalledWith({ archived: true });
});
it.each(['false', 'TRUE', '1', '', 'true&archived=true'])(
  'rejects archived=%s with 422 without calling the repository', async (value) => {
    const { app, repository } = setup();
    const response = await request(app).get(`/api/todos?archived=${value}`);
    expect(response.status).toBe(422);
    expect(Array.isArray(response.body.detail)).toBe(true);
    expect(repository.list).not.toHaveBeenCalled();
  },
);
it('archives completed tasks and returns the number archived', async () => {
  const { app, repository } = setup();
  repository.archiveCompleted.mockResolvedValue(2);
  const response = await request(app).post('/api/todos/archive-completed');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ archived: 2 });
  expect(repository.archiveCompleted).toHaveBeenCalledOnce();
  expect(repository.create).not.toHaveBeenCalled();
});
it('returns 200 with archived 0 when there is nothing to archive', async () => {
  const { app, repository } = setup();
  repository.archiveCompleted.mockResolvedValue(0);
  const response = await request(app).post('/api/todos/archive-completed');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ archived: 0 });
});
it('restores an archived task with archived false', async () => {
  const { app, repository } = setup();
  const restored = { ...todo, completed: true, archived: false };
  repository.update.mockResolvedValue(restored);
  const response = await request(app).patch('/api/todos/1').send({ archived: false });
  expect(response.status).toBe(200);
  expect(response.body).toEqual(restored);
  expect(repository.update).toHaveBeenCalledWith(1, { archived: false });
});
it('creates tasks with trimmed input and defaults', async () => {
  const { app, repository } = setup();
  const response = await request(app).post('/api/todos').send({ title: '  Plan the sprint  ', priority: 'high' });
  expect(response.status).toBe(201);
  expect(response.body).toEqual(todo);
  expect(repository.create).toHaveBeenCalledWith({ title: 'Plan the sprint', description: '', priority: 'high', due_date: null, completed: false });
});
it.each([{ title: '  ' }, { title: 'x'.repeat(121) }, { title: 'Task', priority: 'urgent' }, { title: 'Task', due_date: '2026-02-30' }, { title: 'Task', archived: true }])(
  'rejects invalid create input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    expect((await request(app).post('/api/todos').send(payload)).status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  },
);
it('gets a task by ID', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValue(todo);
  const response = await request(app).get('/api/todos/1');
  expect(response.status).toBe(200);
  expect(response.body).toEqual(todo);
  expect(repository.get).toHaveBeenCalledWith(1);
});
it('returns 404 when getting a missing task', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValue(null);
  const response = await request(app).get('/api/todos/99');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it.each(['0', '-1', '1.5', 'abc', '9007199254740992'])('rejects invalid ID %s on every ID route without calling the repository', async (id) => {
  const { app, repository } = setup();
  const responses = [
    await request(app).get(`/api/todos/${id}`),
    await request(app).patch(`/api/todos/${id}`).send({ completed: true }),
    await request(app).delete(`/api/todos/${id}`),
  ];
  expect(responses.map((response) => response.status)).toEqual([422, 422, 422]);
  expect(responses[0].body.detail).toContainEqual(expect.objectContaining({ path: [] }));
  expect(repository.get).not.toHaveBeenCalled();
  expect(repository.update).not.toHaveBeenCalled();
  expect(repository.delete).not.toHaveBeenCalled();
});
it('updates a task with trimmed fields', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue({ ...todo, title: 'Renamed', completed: true });
  const response = await request(app).patch('/api/todos/1').send({ title: '  Renamed  ', completed: true });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ...todo, title: 'Renamed', completed: true });
  expect(repository.update).toHaveBeenCalledWith(1, { title: 'Renamed', completed: true });
});
it('clears a due date with null', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue({ ...todo, due_date: null });
  const response = await request(app).patch('/api/todos/1').send({ due_date: null });
  expect(response.status).toBe(200);
  expect(repository.update).toHaveBeenCalledWith(1, { due_date: null });
});
it('returns 404 when updating a missing task', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue(null);
  const response = await request(app).patch('/api/todos/99').send({ completed: true });
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it.each([{}, { id: 2 }, { title: '  ' }, { priority: 'urgent' }, { due_date: '2026-02-30' }, { completed: 'yes' }, { title: null }, { archived: 'false' }, { archived: null }])(
  'rejects invalid update input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    const response = await request(app).patch('/api/todos/1').send(payload);
    expect(response.status).toBe(422);
    expect(Array.isArray(response.body.detail)).toBe(true);
    expect(repository.update).not.toHaveBeenCalled();
  },
);
it('explains that an empty patch needs at least one field', async () => {
  const { app } = setup();
  const response = await request(app).patch('/api/todos/1').send({});
  expect(response.body.detail).toEqual([expect.objectContaining({ message: 'Provide at least one field to update.' })]);
});
it('deletes a task and returns 204 without a body', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValue(true);
  const response = await request(app).delete('/api/todos/1');
  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(repository.delete).toHaveBeenCalledWith(1);
});
it('returns 404 when deleting a missing task', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValue(false);
  const response = await request(app).delete('/api/todos/99');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
