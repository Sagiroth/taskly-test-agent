import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

const parts = {
  POSTGRES_USER: 'taskly',
  POSTGRES_PASSWORD: 'secret',
  POSTGRES_HOST: 'db.internal',
  DB_PORT: '5433',
  POSTGRES_DB: 'taskly',
};

function stubParts(values: Record<string, string>) {
  Object.entries(values).forEach(([name, value]) => vi.stubEnv(name, value));
}

describe('resolveDatabaseUrl', () => {
  beforeEach(() => {
    // Never depend on the developer's real environment or .env file.
    stubParts({ DATABASE_URL: '', POSTGRES_USER: '', POSTGRES_PASSWORD: '', POSTGRES_HOST: '', DB_PORT: '', POSTGRES_DB: '' });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns an explicit override unchanged', () => {
    stubParts({ DATABASE_URL: 'postgresql://env:env@env:5432/env' });
    expect(resolveDatabaseUrl('postgresql://a:b@host:5432/db')).toBe('postgresql://a:b@host:5432/db');
  });

  it('uses DATABASE_URL when no override is given', () => {
    stubParts({ ...parts, DATABASE_URL: 'postgresql://env:env@env:5432/env' });
    expect(resolveDatabaseUrl()).toBe('postgresql://env:env@env:5432/env');
  });

  it('falls back to DATABASE_URL when the override is an empty string', () => {
    stubParts({ DATABASE_URL: 'postgresql://env:env@env:5432/env' });
    expect(resolveDatabaseUrl('')).toBe('postgresql://env:env@env:5432/env');
  });

  it.each([
    ['postgresql+psycopg://a:b@host:5432/db', 'postgresql://a:b@host:5432/db'],
    ['postgresql://a:b@host:5432/postgresql+psycopg:', 'postgresql://a:b@host:5432/postgresql+psycopg:'],
  ])('normalises only a leading SQLAlchemy psycopg scheme: %s', (input, expected) => {
    expect(resolveDatabaseUrl(input)).toBe(expected);
  });

  it('builds the URL from the PostgreSQL parts', () => {
    stubParts(parts);
    expect(resolveDatabaseUrl()).toBe('postgresql://taskly:secret@db.internal:5433/taskly');
  });

  it('encodes special characters in credentials and database name', () => {
    stubParts({ ...parts, POSTGRES_USER: 'user@x', POSTGRES_PASSWORD: 'p@ss:w/rd#', POSTGRES_DB: 'my db' });
    const url = new URL(resolveDatabaseUrl());
    expect(decodeURIComponent(url.username)).toBe('user@x');
    expect(decodeURIComponent(url.password)).toBe('p@ss:w/rd#');
    expect(url.hostname).toBe('db.internal');
    expect(url.port).toBe('5433');
    expect(decodeURIComponent(url.pathname)).toBe('/my db');
  });

  it.each(Object.keys(parts))('throws when %s is missing', (name) => {
    stubParts({ ...parts, [name]: '' });
    expect(() => resolveDatabaseUrl()).toThrow(`Missing environment variable: ${name}`);
  });
});
