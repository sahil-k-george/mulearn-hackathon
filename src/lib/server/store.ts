/**
 * Server data layer.
 *
 * Storage is resolved in three tiers, degrading automatically:
 *   1. Supabase (PostgreSQL via PostgREST) when SUPABASE_URL + a key are set.
 *      Durable and shared across instances — required for real deployments.
 *   2. A zero-config JSON file store (`.data/db.json`) when the filesystem is
 *      writable. Good for local dev and long-lived hosts with a volume.
 *   3. An in-memory store as a last resort, so read-only serverless hosts
 *      (Vercel, Netlify) still boot and can sign in. Ephemeral by design.
 *
 * The whole database is a single JSON document, so every adapter exposes the
 * same simple load/save contract. All writes go through `transact`, which
 * serialises mutations in-process to avoid lost updates.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  DiscussionMessage,
  MilestoneItem,
  NotificationItem,
  ResourceItem,
  SubjectItem,
  TaskItem,
  TeamActivityItem,
  TeamCheckinItem,
  TeamItem,
  TeamMemberItem,
  UserProfile,
} from '../database.types';
import type {
  AISettings,
  CredentialRecord,
  GoalItem,
  NoteItem,
  PasswordResetRecord,
  PlanEvent,
  PlanPreferences,
  SessionRecord,
  StudySessionItem,
  WorkloadCheckIn,
} from '../domain';

export type AppDatabase = {
  users: UserProfile[];
  credentials: CredentialRecord[];
  sessions: SessionRecord[];
  passwordResets: PasswordResetRecord[];
  subjects: SubjectItem[];
  goals: GoalItem[];
  tasks: TaskItem[];
  studySessions: StudySessionItem[];
  teams: TeamItem[];
  teamMembers: TeamMemberItem[];
  discussions: DiscussionMessage[];
  teamActivities: TeamActivityItem[];
  resources: ResourceItem[];
  notifications: NotificationItem[];
  milestones: MilestoneItem[];
  planEvents: PlanEvent[];
  workloadCheckIns: WorkloadCheckIn[];
  teamCheckIns: TeamCheckinItem[];
  preferences: PlanPreferences[];
  aiSettings: AISettings[];
  notes: NoteItem[];
};

export type CollectionName = keyof AppDatabase;

export function emptyDatabase(): AppDatabase {
  return {
    users: [],
    credentials: [],
    sessions: [],
    passwordResets: [],
    subjects: [],
    goals: [],
    tasks: [],
    studySessions: [],
    teams: [],
    teamMembers: [],
    discussions: [],
    teamActivities: [],
    resources: [],
    notifications: [],
    milestones: [],
    planEvents: [],
    workloadCheckIns: [],
    teamCheckIns: [],
    preferences: [],
    aiSettings: [],
    notes: [],
  };
}

interface StoreAdapter {
  readonly name: StoreName;
  load(): Promise<AppDatabase>;
  save(db: AppDatabase): Promise<void>;
}

export type StoreName = 'file' | 'supabase' | 'memory';

// ---------------------------------------------------------------------------
// File adapter
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

class FileAdapter implements StoreAdapter {
  readonly name = 'file' as const;

  async load(): Promise<AppDatabase> {
    try {
      const raw = await readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AppDatabase>;
      return { ...emptyDatabase(), ...parsed };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return emptyDatabase();
      console.error('[store] failed to read file database, starting fresh:', error);
      return emptyDatabase();
    }
  }

  async save(db: AppDatabase): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
    await rename(tmp, DATA_FILE);
  }
}

/**
 * Whether the local file store can actually be written.
 *
 * Serverless platforms (Vercel, Netlify functions) ship a read-only bundle
 * filesystem where only `/tmp` is writable, so a naive `mkdir` on `process.cwd()`
 * throws EROFS/EACCES. Probing once up front lets us fall back deliberately
 * instead of turning every write into a 500.
 */
let fileWritable: boolean | null = null;
let warnedReadOnly = false;

function isFileStoreWritable(): boolean {
  if (fileWritable !== null) return fileWritable;
  const probe = path.join(DATA_DIR, `.probe-${process.pid}`);
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(probe, 'ok', 'utf8');
    unlinkSync(probe);
    fileWritable = true;
  } catch (error) {
    fileWritable = false;
    if (!warnedReadOnly) {
      warnedReadOnly = true;
      console.error(
        '[store] local file store is not writable (read-only filesystem?).',
        error,
        'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for durable storage.',
      );
    }
  }
  return fileWritable;
}

// ---------------------------------------------------------------------------
// Memory adapter (last resort on read-only / ephemeral hosts)
// ---------------------------------------------------------------------------

/**
 * Per-instance in-memory fallback so the app still boots and the demo account
 * still signs in on hosts with no writable disk. State is lost when the
 * instance is recycled, so this is for demos only, never for real users.
 */
class MemoryAdapter implements StoreAdapter {
  readonly name = 'memory' as const;
  private db: AppDatabase = emptyDatabase();

  async load(): Promise<AppDatabase> {
    return structuredClone(this.db);
  }

  async save(db: AppDatabase): Promise<void> {
    this.db = structuredClone(db);
  }
}

let memoryAdapter: MemoryAdapter | null = null;

function getMemoryAdapter(): MemoryAdapter {
  if (!memoryAdapter) {
    memoryAdapter = new MemoryAdapter();
    console.warn(
      '[store] using in-memory storage: data will NOT survive a server restart. ' +
        'Configure Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) for a real deployment.',
    );
  }
  return memoryAdapter;
}

// ---------------------------------------------------------------------------
// Supabase adapter (PostgREST, no SDK required)
// ---------------------------------------------------------------------------

const SUPABASE_TABLE = 'app_state';
const SUPABASE_KEY = 'db';

class SupabaseAdapter implements StoreAdapter {
  readonly name = 'supabase' as const;
  private url: string;
  private apiKey: string;

  constructor(url: string, apiKey: string) {
    this.url = url.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async load(): Promise<AppDatabase> {
    const endpoint = `${this.url}/rest/v1/${SUPABASE_TABLE}?key=eq.${SUPABASE_KEY}&select=value`;
    const response = await fetch(endpoint, { headers: this.headers(), cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Supabase load failed (${response.status})`);
    }
    const rows = (await response.json()) as { value?: Partial<AppDatabase> }[];
    if (!Array.isArray(rows) || !rows.length || !rows[0].value) return emptyDatabase();
    return { ...emptyDatabase(), ...rows[0].value };
  }

  async save(db: AppDatabase): Promise<void> {
    const endpoint = `${this.url}/rest/v1/${SUPABASE_TABLE}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...this.headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: SUPABASE_KEY, value: db }]),
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase save failed (${response.status}): ${detail.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Adapter selection + failover
// ---------------------------------------------------------------------------

let warnSupabase = false;

function createSupabaseAdapter(): SupabaseAdapter | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !apiKey) return null;
  if (url.includes('placeholder')) return null;
  return new SupabaseAdapter(url, apiKey);
}

/** Which backend is currently serving requests (for status reporting). */
let activeAdapter: StoreName = 'file';

export function getActiveStoreName(): StoreName {
  return activeAdapter;
}

export function isSupabaseConfigured(): boolean {
  return createSupabaseAdapter() !== null;
}

/** True when the active store cannot survive a restart (memory fallback). */
export function isEphemeralStore(): boolean {
  return activeAdapter === 'memory';
}

async function loadWithFailover(): Promise<AppDatabase> {
  const supabase = createSupabaseAdapter();
  if (supabase) {
    try {
      const db = await supabase.load();
      activeAdapter = 'supabase';
      return db;
    } catch (error) {
      if (!warnSupabase) {
        warnSupabase = true;
        console.error('[store] Supabase unavailable, failing over to local file store:', error);
      }
    }
  }
  if (isFileStoreWritable()) {
    activeAdapter = 'file';
    return new FileAdapter().load();
  }
  activeAdapter = 'memory';
  return getMemoryAdapter().load();
}

async function saveWithFailover(db: AppDatabase): Promise<void> {
  const supabase = createSupabaseAdapter();
  if (supabase && activeAdapter === 'supabase') {
    try {
      await supabase.save(db);
      return;
    } catch (error) {
      console.error('[store] Supabase save failed, falling back to local storage:', error);
    }
  }
  if (isFileStoreWritable()) {
    activeAdapter = 'file';
    try {
      await new FileAdapter().save(db);
      return;
    } catch (error) {
      // The probe passed but the write still failed (full disk, permissions
      // revoked mid-flight, ...). Degrade rather than 500 the request.
      console.error('[store] file save failed, falling back to in-memory storage:', error);
      fileWritable = false;
    }
  }
  activeAdapter = 'memory';
  await getMemoryAdapter().save(db);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve();

/** Read-only access to the loaded database (never persists). */
export async function readDb(): Promise<AppDatabase> {
  await queue.catch(() => undefined);
  return loadWithFailover();
}

/**
 * Mutate the database atomically. The mutator receives a mutable copy; its
 * return value is passed back to the caller and always persisted.
 */
export async function transact<T>(mutator: (db: AppDatabase) => T | Promise<T>): Promise<T> {
  let result!: T;
  const task = queue
    .catch(() => undefined)
    .then(async () => {
      const db = await loadWithFailover();
      result = await mutator(db);
      await saveWithFailover(db);
    });
  queue = task.catch(() => undefined);
  await task;
  return result;
}

/** Convenience helper for the common "load, seed if empty, return" case. */
export async function readDbSeeded(): Promise<AppDatabase> {
  const { ensureSeeded } = await import('./seed');
  if (isDatabaseEmpty(await readDb())) {
    await transact((db) => {
      ensureSeeded(db);
    });
  }
  return readDb();
}

export function isDatabaseEmpty(db: AppDatabase): boolean {
  return db.users.length === 0;
}
