/**
 * Extended domain types for the Adaptive Academic Companion.
 *
 * These complement the generated Supabase-style types in `database.types.ts`.
 * The core row shapes (users, subjects, tasks, teams, ...) are intentionally
 * reused so the existing UI components keep working unchanged.
 */

import type {
  SubjectItem,
  TaskItem,
  TeamItem,
  TeamMemberItem,
  UserProfile,
} from './database.types';

export type KnowledgeLevel = 1 | 2 | 3 | 4 | 5;

export const KNOWLEDGE_LEVEL_LABELS: Record<number, string> = {
  1: 'Just Starting',
  2: 'Basic Understanding',
  3: 'Moderate',
  4: 'Confident',
  5: 'Strong',
};

export type GoalMode = 'FAST_PREP' | 'KEEP_UP';
export type GoalStatus = 'active' | 'completed' | 'archived';

export type GoalItem = {
  id: string;
  user_id: string;
  subject_id: string | null;
  subject_name: string;
  mode: GoalMode;
  title: string;
  description: string;
  target_date: string;
  priority: 'low' | 'medium' | 'high';
  status: GoalStatus;
  available_minutes_per_day: number;
  created_at: string;
};

export type StudySessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export type StudySessionItem = {
  id: string;
  user_id: string;
  task_id: string | null;
  plan_item_id: string | null;
  title: string;
  subject_name: string;
  start_time: string;
  duration_minutes: number;
  actual_minutes: number | null;
  status: StudySessionStatus;
  created_at: string;
};

export type PlanEventType =
  | 'TASK_COMPLETED'
  | 'TASK_SKIPPED'
  | 'TASK_EXTENDED'
  | 'TASK_SHORTENED'
  | 'DEADLINE_CHANGED'
  | 'TIME_AVAILABLE_CHANGED';

export type PlanEvent = {
  id: string;
  user_id: string;
  type: PlanEventType;
  task_id: string | null;
  /** Free-form payload: { extraMinutes }, { deadline }, { availableMinutes } ... */
  payload: Record<string, unknown>;
  created_at: string;
};

export type WorkloadLevel = 'comfortable' | 'manageable' | 'heavy' | 'overloaded';

export type WorkloadCheckIn = {
  id: string;
  user_id: string;
  /** ISO date (YYYY-MM-DD) the check-in refers to. */
  date: string;
  level: WorkloadLevel;
  available_minutes: number | null;
  created_at: string;
};

/** Per-user planning preferences (the "available time" + active mode). */
export type PlanPreferences = {
  user_id: string;
  available_minutes_per_day: number;
  mode: GoalMode;
  subject_id: string | null;
  active_team_id: string | null;
  updated_at: string;
};

export type CredentialRecord = {
  user_id: string;
  password_hash: string;
  salt: string;
  created_at: string;
};

export type SessionRecord = {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
};

export type PasswordResetRecord = {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  used: boolean;
};

/** Everything the planning engine needs, decoupled from storage. */
export type PlanningContext = {
  user: Pick<UserProfile, 'id' | 'name' | 'timezone'>;
  subjects: SubjectItem[];
  tasks: TaskItem[];
  goals: GoalItem[];
  members: TeamMemberItem[];
  teams: TeamItem[];
  now: Date;
};

export type PlanItemKind =
  | 'task'
  | 'review'
  | 'practice'
  | 'recall'
  | 'mock'
  | 'break'
  | 'peer_session';

export type PlannedItem = {
  id: string;
  task_id: string | null;
  goal_id: string | null;
  title: string;
  subject_name: string;
  minutes: number;
  kind: PlanItemKind;
  /** Human-readable reasons the engine scheduled this item (P2: explainability). */
  reasons: string[];
  priority_score: number;
  /** ISO timestamp the item is planned to start at. */
  start_time: string;
  status: 'planned' | 'done' | 'skipped';
  is_break: boolean;
};

export type DeferredItem = {
  task_id: string;
  title: string;
  subject_name: string;
  minutes: number;
  priority_score: number;
  reason: string;
};

export type PlanResult = {
  generated_at: string;
  mode: GoalMode;
  subject_id: string | null;
  subject_name: string | null;
  headline: string;
  summary: string;
  available_minutes: number;
  planned_minutes: number;
  break_minutes: number;
  items: PlannedItem[];
  deferred: DeferredItem[];
  focus_areas: { topic: string; knowledge_level: number; note: string }[];
};

export type BrainDumpTask = {
  title: string;
  subject_name: string;
  deadline: string;
  deadline_label: string;
  estimated_minutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
};

export type BrainDumpKnowledgeGap = {
  subject_name: string;
  topic: string;
  confidence: number;
};

export type BrainDumpCollaboration = {
  activity: string;
  members: string[];
  deadline: string | null;
  deadline_label: string | null;
};

export type BrainDumpGoal = {
  title: string;
  subject_name: string;
  mode: GoalMode;
  target_date: string;
  target_label: string;
};

export type BrainDumpExtraction = {
  provider: string;
  tasks: BrainDumpTask[];
  knowledge_gaps: BrainDumpKnowledgeGap[];
  collaboration: BrainDumpCollaboration[];
  goals: BrainDumpGoal[];
  time_constraints: { label: string; minutes: number | null }[];
  notes: string[];
};

export type TeamStrength = {
  topic: string;
  member_name: string;
  member_id: string;
  score: number;
};

export type TeamGap = {
  topic: string;
  average_score: number;
  members_needing_help: { member_id: string; name: string; score: number }[];
};

export type PeerRecommendation = {
  topic: string;
  mentor_id: string;
  mentor_name: string;
  mentor_score: number;
  learners: { member_id: string; name: string; score: number }[];
  suggestion: string;
};

export type TeamIntelligence = {
  team_id: string;
  knowledge_map: {
    topic: string;
    entries: { member_id: string; name: string; score: number }[];
    average_score: number;
  }[];
  strengths: TeamStrength[];
  gaps: TeamGap[];
  recommendations: PeerRecommendation[];
};

export type WorkloadAssessment = {
  level: WorkloadLevel;
  planned_minutes: number;
  available_minutes: number;
  ratio: number;
  message: string;
  suggestion: string;
  should_rebalance: boolean;
};

// ---------------------------------------------------------------------------
// Notes (PDF) → prep splitting
// ---------------------------------------------------------------------------

export type NotesPrepSubtaskKind = 'learn' | 'practice' | 'recall' | 'review';

export type NotesPrepSubtask = {
  title: string;
  minutes: number;
  kind: NotesPrepSubtaskKind;
};

export type NotesPrepTopic = {
  topic: string;
  summary: string;
  subtasks: NotesPrepSubtask[];
};

export type NotesPrepPlan = {
  provider: string;
  subject_name: string;
  topics: NotesPrepTopic[];
  total_minutes: number;
  notes: string[];
};

/** Client-facing note metadata (no full text). */
export type NoteSummary = Omit<NoteItem, 'text'> & { preview: string };

/** A stored uploaded notes document (text extracted from the PDF). */
export type NoteItem = {
  id: string;
  user_id: string;
  subject_id: string | null;
  subject_name: string;
  title: string;
  file_name: string;
  page_count: number;
  char_count: number;
  text: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// AI settings (per-user provider + key + model)
// ---------------------------------------------------------------------------

export type AIProviderKey = 'mock' | 'openai' | 'gemini' | 'openrouter' | 'grok' | 'env';

export type AISettings = {
  user_id: string;
  provider: AIProviderKey;
  api_key: string;
  model: string;
  updated_at: string;
};

/** Safe (client-facing) view of a user's AI settings — never includes the key. */
export type AISettingsPublic = {
  provider: AIProviderKey;
  model: string;
  has_key: boolean;
  masked_key: string | null;
  updated_at: string | null;
};

/** Full snapshot returned to the client dashboard. */
export type DashboardData = {
  user: UserProfile;
  preferences: PlanPreferences;
  subjects: SubjectItem[];
  goals: GoalItem[];
  tasks: TaskItem[];
  plan: PlanResult;
  workload: WorkloadAssessment;
  next_step: PlannedItem | null;
};

export type { SubjectItem, TaskItem, TeamItem, TeamMemberItem, UserProfile };
