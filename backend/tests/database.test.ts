import { it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';
import type { Database } from '../src/features/todos/types.ts';

it('creates a Prisma client without opening a connection', () => {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  expect(typeof database.todo.findMany).toBe('function');
  expect(typeof database.$connect).toBe('function');
});

it('creates the todos table once with its constraints', async () => {
  const executeRaw = vi.fn().mockResolvedValue(0);
  await initialize({ $executeRaw: executeRaw } as unknown as Database);
  expect(executeRaw).toHaveBeenCalledOnce();
  const sql = executeRaw.mock.calls[0][0].join('');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS todos');
  expect(sql).toContain('title VARCHAR(120) NOT NULL');
  expect(sql).toContain("CHECK (priority IN ('low', 'medium', 'high'))");
  expect(sql).toContain('due_date DATE');
  expect(executeRaw.mock.calls[0]).toHaveLength(1);
});

it('propagates errors from table creation', async () => {
  const executeRaw = vi.fn().mockRejectedValue(new Error('permission denied'));
  await expect(initialize({ $executeRaw: executeRaw } as unknown as Database)).rejects.toThrow('permission denied');
});
