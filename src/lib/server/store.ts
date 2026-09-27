/**
 * Server data layer.
 *
 * Default: a zero-config JSON file store (`.data/db.json`).
 * Failover: if Supabase credentials exist in the environment, Supabase
 * (PostgreSQL via PostgREST) is used as the primary store, and the file store
 * transparently takes over if Supabase is unreachable or errors.
 *
 * The whole database is a single JSON document, so both adapters expose the
 * same simple load/save contract. All writes go through `transact`, which
 * serialises mutations in-process to avoid lost updates.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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
  readonly name: 'file' | 'supabase';
  load(): Promise<AppDatabase>;
  save(db: AppDatabase): Promise<void>;
}

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
let activeAdapter: 'file' | 'supabase' = 'file';

export function getActiveStoreName(): 'file' | 'supabase' {
  return activeAdapter;
}

export function isSupabaseConfigured(): boolean {
  return createSupabaseAdapter() !== null;
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
      activeAdapter = 'file';
    }
  } else {
    activeAdapter = 'file';
  }
  return new FileAdapter().load();
}

async function saveWithFailover(db: AppDatabase): Promise<void> {
  const supabase = createSupabaseAdapter();
  if (supabase && activeAdapter === 'supabase') {
    try {
      await supabase.save(db);
      return;
    } catch (error) {
      console.error('[store] Supabase save failed, writing to local file store instead:', error);
      activeAdapter = 'file';
    }
  }
  await new FileAdapter().save(db);
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
