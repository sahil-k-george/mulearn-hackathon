/**
 * Storage degradation tests.
 *
 * Regression cover for the Vercel login failure: the serverless bundle
 * filesystem is read-only, so the zero-config file store used to throw on
 * write and every login returned a generic 500.
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSession, authenticate } from '../src/lib/server/repo';

const originalCwd = process.cwd();
let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'adaptive-store-'));
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Load a fresh copy of the store with DATA_DIR bound to the temp cwd. */
async function loadStore() {
  return import('../src/lib/server/store');
}

describe('store fallback', () => {
  it('uses the file store when the filesystem is writable', async () => {
    const store = await loadStore();
    await store.readDbSeeded();

    expect(store.getActiveStoreName()).toBe('file');
    expect(store.isEphemeralStore()).toBe(false);
  });

  it('seeds and authenticates on a writable filesystem', async () => {
    const store = await loadStore();
    await store.readDbSeeded();

    const result = await store.transact((db) => {
      const user = authenticate(db, 'sahil@university.edu', 'demo1234');
      if (!user) return null;
      return { user, token: createSession(db, user.id) };
    });

    expect(result).not.toBeNull();
    expect(result?.user.email).toBe('sahil@university.edu');
    expect(result?.token).toBeTruthy();
  });

  it('degrades to memory instead of throwing when the filesystem is read-only', async () => {
    // Make `.data` unwritable by occupying the path with a regular file, so the
    // store's writability probe fails exactly as it does on Vercel (EROFS).
    writeFileSync(path.join(workdir, '.data'), 'not a directory', 'utf8');

    const store = await loadStore();

    // The whole login path, including the seed write, must not throw.
    const result = await store.transact((db) => {
      if (store.isDatabaseEmpty(db)) {
        return import('../src/lib/server/seed').then((seed) => seed.ensureSeeded(db));
      }
      return undefined;
    });
    expect(result).toBeUndefined();

    expect(store.getActiveStoreName()).toBe('memory');
    expect(store.isEphemeralStore()).toBe(true);
  });

  it('still signs the demo user in on a read-only filesystem', async () => {
    writeFileSync(path.join(workdir, '.data'), 'not a directory', 'utf8');

    const store = await loadStore();
    await store.readDbSeeded();

    const result = await store.transact((db) => {
      const user = authenticate(db, 'sahil@university.edu', 'demo1234');
      if (!user) return null;
      return { user, token: createSession(db, user.id) };
    });

    expect(result).not.toBeNull();
    expect(result?.user.email).toBe('sahil@university.edu');
    expect(store.getActiveStoreName()).toBe('memory');
  });

  it('rejects a bad password without leaking the store type', async () => {
    writeFileSync(path.join(workdir, '.data'), 'not a directory', 'utf8');

    const store = await loadStore();
    await store.readDbSeeded();

    const result = await store.transact((db) => authenticate(db, 'sahil@university.edu', 'wrongpass'));
    expect(result).toBeNull();
  });
});

describe('writeFileSync probe guard', () => {
  it('does not leave a stale probe file behind', async () => {
    const dir = path.join(workdir, '.data');
    mkdirSync(dir, { recursive: true });
    await loadStore();

    const { readdirSync } = await import('node:fs');
    expect(readdirSync(dir).filter((f) => f.startsWith('.probe-'))).toHaveLength(0);
  });
});
