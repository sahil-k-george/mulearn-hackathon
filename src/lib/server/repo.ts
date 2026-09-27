/**
 * Repository helpers.
 *
 * Every function takes the mutable `AppDatabase` from a transaction and returns
 * plain domain objects. Authorization checks (does this row belong to this
 * user?) live here so route handlers and the UI cannot bypass them.
 */

import { randomUUID } from 'node:crypto';

import type {
  ResourceItem,
  SubjectItem,
  TaskItem,
  TeamItem,
  TeamMemberItem,
  UserProfile,
  DiscussionMessage,
  TeamActivityItem,
  TeamCheckinItem,
  NotificationItem,
} from '../database.types';
import type {
  AISettings,
  AISettingsPublic,
  AIProviderKey,
  GoalItem,
  NoteItem,
  PlanEvent,
  PlanPreferences,
  StudySessionItem,
  WorkloadCheckIn,
} from '../domain';
import type { AppDatabase } from './store';
import { generateToken, hashPassword, sessionExpiry, verifyPassword } from './auth';

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export class RepoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Users & auth
// ---------------------------------------------------------------------------

export function findUserByEmail(db: AppDatabase, email: string): UserProfile | undefined {
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized);
}

export function findUserById(db: AppDatabase, id: string): UserProfile | undefined {
  return db.users.find((u) => u.id === id);
}

export function createUser(
  db: AppDatabase,
  input: { name: string; email: string; password: string; timezone?: string }
): UserProfile {
  const user: UserProfile = {
    id: newId('user'),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    avatar_url: '',
    bio: '',
    institution: '',
    course: '',
    academic_year: '',
    location: '',
    timezone: input.timezone ?? 'UTC',
    skills: [],
    interests: [],
    streak_days: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { hash, salt } = hashPassword(input.password);
  db.users.push(user);
  db.credentials.push({
    user_id: user.id,
    password_hash: hash,
    salt,
    created_at: new Date().toISOString(),
  });
  return user;
}

export function authenticate(
  db: AppDatabase,
  email: string,
  password: string
): UserProfile | null {
  const user = findUserByEmail(db, email);
  if (!user) return null;
  const cred = db.credentials.find((c) => c.user_id === user.id);
  if (!cred) return null;
  return verifyPassword(password, cred.password_hash, cred.salt) ? user : null;
}

export function updatePassword(db: AppDatabase, userId: string, password: string): void {
  const { hash, salt } = hashPassword(password);
  const existing = db.credentials.find((c) => c.user_id === userId);
  if (existing) {
    existing.password_hash = hash;
    existing.salt = salt;
  } else {
    db.credentials.push({
      user_id: userId,
      password_hash: hash,
      salt,
      created_at: new Date().toISOString(),
    });
  }
  // Invalidate every existing session after a password change.
  db.sessions = db.sessions.filter((s) => s.user_id !== userId);
}

export function createSession(db: AppDatabase, userId: string): string {
  const token = generateToken();
  db.sessions.push({
    token,
    user_id: userId,
    created_at: new Date().toISOString(),
    expires_at: sessionExpiry(),
  });
  return token;
}

export function getUserForSession(db: AppDatabase, token: string | undefined): UserProfile | null {
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    return null;
  }
  return findUserById(db, session.user_id) ?? null;
}

export function deleteSession(db: AppDatabase, token: string | undefined): void {
  if (!token) return;
  db.sessions = db.sessions.filter((s) => s.token !== token);
}

export function createResetToken(db: AppDatabase, userId: string): string {
  const token = generateToken(24);
  db.passwordResets.push({
    token,
    user_id: userId,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    used: false,
  });
  return token;
}

export function consumeResetToken(db: AppDatabase, token: string, newPassword: string): boolean {
  const record = db.passwordResets.find((r) => r.token === token && !r.used);
  if (!record) return false;
  if (new Date(record.expires_at).getTime() < Date.now()) return false;
  record.used = true;
  updatePassword(db, record.user_id, newPassword);
  return true;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export function getPreferences(db: AppDatabase, userId: string): PlanPreferences {
  let pref = db.preferences.find((p) => p.user_id === userId);
  if (!pref) {
    pref = {
      user_id: userId,
      available_minutes_per_day: 120,
      mode: 'KEEP_UP',
      subject_id: null,
      active_team_id: null,
      updated_at: new Date().toISOString(),
    };
    db.preferences.push(pref);
  }
  return pref;
}

export function updatePreferences(
  db: AppDatabase,
  userId: string,
  patch: Partial<PlanPreferences>
): PlanPreferences {
  const pref = getPreferences(db, userId);
  Object.assign(pref, patch, { user_id: userId, updated_at: new Date().toISOString() });
  return pref;
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export function listSubjects(db: AppDatabase, userId: string): SubjectItem[] {
  return db.subjects
    .filter((s) => s.user_id === userId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findSubject(db: AppDatabase, userId: string, id: string): SubjectItem | undefined {
  return db.subjects.find((s) => s.id === id && s.user_id === userId);
}

export function createSubject(
  db: AppDatabase,
  userId: string,
  input: {
    name: string;
    current_topic?: string;
    knowledge_level?: number;
    category?: string;
    color?: string;
  }
): SubjectItem {
  const subject: SubjectItem = {
    id: newId('subj'),
    user_id: userId,
    name: input.name.trim(),
    current_topic: (input.current_topic ?? '').trim(),
    confidence_score: Math.min(5, Math.max(1, input.knowledge_level ?? 3)),
    category: input.category?.trim() || 'General',
    color: input.color?.trim() || '#354E6B',
    created_at: new Date().toISOString(),
  };
  db.subjects.push(subject);
  return subject;
}

export function updateSubject(
  db: AppDatabase,
  userId: string,
  id: string,
  patch: Partial<Pick<SubjectItem, 'name' | 'current_topic' | 'confidence_score' | 'category' | 'color'>>
): SubjectItem {
  const subject = findSubject(db, userId, id);
  if (!subject) throw new RepoError('Subject not found', 404);
  if (patch.name !== undefined) subject.name = patch.name.trim();
  if (patch.current_topic !== undefined) subject.current_topic = patch.current_topic.trim();
  if (patch.confidence_score !== undefined) {
    subject.confidence_score = Math.min(5, Math.max(1, patch.confidence_score));
  }
  if (patch.category !== undefined) subject.category = patch.category.trim();
  if (patch.color !== undefined) subject.color = patch.color.trim();
  return subject;
}

export function deleteSubject(db: AppDatabase, userId: string, id: string): void {
  const subject = findSubject(db, userId, id);
  if (!subject) throw new RepoError('Subject not found', 404);
  db.subjects = db.subjects.filter((s) => s.id !== id);
  db.goals = db.goals.filter((g) => !(g.user_id === userId && g.subject_id === id));
  db.tasks = db.tasks.map((t) =>
    t.user_id === userId && t.subject_id === id ? { ...t, subject_id: null } : t
  );
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function listGoals(db: AppDatabase, userId: string): GoalItem[] {
  return db.goals
    .filter((g) => g.user_id === userId)
    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
}

export function createGoal(
  db: AppDatabase,
  userId: string,
  input: {
    title: string;
    subject_id?: string | null;
    mode: GoalItem['mode'];
    target_date: string;
    priority?: GoalItem['priority'];
    description?: string;
    available_minutes_per_day?: number;
  }
): GoalItem {
  const subject = input.subject_id ? findSubject(db, userId, input.subject_id) : undefined;
  const goal: GoalItem = {
    id: newId('goal'),
    user_id: userId,
    subject_id: input.subject_id ?? null,
    subject_name: subject?.name ?? 'General',
    mode: input.mode === 'KEEP_UP' ? 'KEEP_UP' : 'FAST_PREP',
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    target_date: new Date(input.target_date).toISOString(),
    priority: input.priority ?? 'medium',
    status: 'active',
    available_minutes_per_day: input.available_minutes_per_day ?? 120,
    created_at: new Date().toISOString(),
  };
  db.goals.push(goal);
  return goal;
}

export function updateGoal(
  db: AppDatabase,
  userId: string,
  id: string,
  patch: Partial<GoalItem>
): GoalItem {
  const goal = db.goals.find((g) => g.id === id && g.user_id === userId);
  if (!goal) throw new RepoError('Goal not found', 404);
  if (patch.title !== undefined) goal.title = patch.title.trim();
  if (patch.description !== undefined) goal.description = patch.description.trim();
  if (patch.mode !== undefined) goal.mode = patch.mode === 'KEEP_UP' ? 'KEEP_UP' : 'FAST_PREP';
  if (patch.target_date !== undefined) goal.target_date = new Date(patch.target_date).toISOString();
  if (patch.priority !== undefined) goal.priority = patch.priority;
  if (patch.status !== undefined) goal.status = patch.status;
  if (patch.available_minutes_per_day !== undefined) {
    goal.available_minutes_per_day = patch.available_minutes_per_day;
  }
  if (patch.subject_id !== undefined) {
    goal.subject_id = patch.subject_id;
    goal.subject_name = patch.subject_id
      ? findSubject(db, userId, patch.subject_id)?.name ?? goal.subject_name
      : 'General';
  }
  return goal;
}

export function deleteGoal(db: AppDatabase, userId: string, id: string): void {
  const exists = db.goals.some((g) => g.id === id && g.user_id === userId);
  if (!exists) throw new RepoError('Goal not found', 404);
  db.goals = db.goals.filter((g) => g.id !== id);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function listTasks(db: AppDatabase, userId: string): TaskItem[] {
  return db.tasks
    .filter((t) => t.user_id === userId)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

export function createTask(
  db: AppDatabase,
  userId: string,
  input: {
    title: string;
    subject_id?: string | null;
    subject_name?: string;
    description?: string;
    due_date: string;
    estimated_minutes?: number;
    priority?: TaskItem['priority'];
    team_id?: string | null;
    source?: 'MANUAL' | 'BRAIN_DUMP' | 'AI_GENERATED' | 'TEAM';
  }
): TaskItem {
  const subject = input.subject_id ? findSubject(db, userId, input.subject_id) : undefined;
  const user = findUserById(db, userId);
  const task: TaskItem = {
    id: newId('task'),
    user_id: userId,
    team_id: input.team_id ?? null,
    subject_id: input.subject_id ?? subject?.id ?? null,
    subject_name: subject?.name || input.subject_name?.trim() || 'General',
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status: 'todo',
    priority: input.priority ?? 'medium',
    due_date: new Date(input.due_date).toISOString(),
    estimated_minutes: Math.max(5, input.estimated_minutes ?? 30),
    assignee_id: userId,
    assignee_name: user?.name ?? 'You',
    assignee_avatar: user?.avatar_url ?? null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
  db.tasks.push(task);
  if (task.team_id) {
    logActivity(db, task.team_id, userId, 'task_created', 'created a task', task.title);
  }
  return task;
}

export function updateTask(
  db: AppDatabase,
  userId: string,
  id: string,
  patch: Partial<TaskItem>
): TaskItem {
  const task = db.tasks.find((t) => t.id === id && t.user_id === userId);
  if (!task) throw new RepoError('Task not found', 404);

  if (patch.title !== undefined) task.title = patch.title.trim();
  if (patch.description !== undefined) task.description = patch.description.trim();
  if (patch.due_date !== undefined) task.due_date = new Date(patch.due_date).toISOString();
  if (patch.estimated_minutes !== undefined) {
    task.estimated_minutes = Math.max(5, patch.estimated_minutes);
  }
  if (patch.priority !== undefined) task.priority = patch.priority;
  if (patch.subject_id !== undefined) {
    task.subject_id = patch.subject_id;
    const subject = patch.subject_id ? findSubject(db, userId, patch.subject_id) : undefined;
    if (subject) task.subject_name = subject.name;
  }
  if (patch.status !== undefined) {
    task.status = patch.status;
    task.completed_at = patch.status === 'done' ? new Date().toISOString() : null;
    if (patch.status === 'done' && task.team_id) {
      logActivity(db, task.team_id, userId, 'task_completed', 'completed task', task.title);
    }
  }
  return task;
}

export function deleteTask(db: AppDatabase, userId: string, id: string): void {
  const exists = db.tasks.some((t) => t.id === id && t.user_id === userId);
  if (!exists) throw new RepoError('Task not found', 404);
  db.tasks = db.tasks.filter((t) => t.id !== id);
}

// ---------------------------------------------------------------------------
// Study sessions & plan events
// ---------------------------------------------------------------------------

export function listStudySessions(db: AppDatabase, userId: string): StudySessionItem[] {
  return db.studySessions
    .filter((s) => s.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createStudySession(
  db: AppDatabase,
  userId: string,
  input: {
    task_id?: string | null;
    plan_item_id?: string | null;
    title: string;
    subject_name?: string;
    duration_minutes: number;
    actual_minutes?: number | null;
    status?: StudySessionItem['status'];
  }
): StudySessionItem {
  const session: StudySessionItem = {
    id: newId('session'),
    user_id: userId,
    task_id: input.task_id ?? null,
    plan_item_id: input.plan_item_id ?? null,
    title: input.title,
    subject_name: input.subject_name ?? 'General',
    start_time: new Date().toISOString(),
    duration_minutes: input.duration_minutes,
    actual_minutes: input.actual_minutes ?? null,
    status: input.status ?? 'in_progress',
    created_at: new Date().toISOString(),
  };
  db.studySessions.push(session);
  return session;
}

export function listPlanEvents(db: AppDatabase, userId: string): PlanEvent[] {
  return db.planEvents.filter((e) => e.user_id === userId);
}

export function addPlanEvent(
  db: AppDatabase,
  userId: string,
  input: { type: PlanEvent['type']; task_id?: string | null; payload?: Record<string, unknown> }
): PlanEvent {
  const event: PlanEvent = {
    id: newId('evt'),
    user_id: userId,
    type: input.type,
    task_id: input.task_id ?? null,
    payload: input.payload ?? {},
    created_at: new Date().toISOString(),
  };
  db.planEvents.push(event);
  return event;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function logActivity(
  db: AppDatabase,
  teamId: string,
  userId: string,
  action: TeamActivityItem['action_type'],
  description: string,
  targetTitle: string
): void {
  const user = findUserById(db, userId);
  db.teamActivities.push({
    id: newId('act'),
    team_id: teamId,
    user_name: user?.name ?? 'Someone',
    user_avatar: user?.avatar_url ?? '',
    action_type: action,
    description,
    target_title: targetTitle,
    created_at: new Date().toISOString(),
  });
}

/** Teams the user belongs to (owner or member). */
export function listTeams(db: AppDatabase, userId: string): TeamItem[] {
  const memberTeamIds = new Set(
    db.teamMembers.filter((m) => m.user_id === userId).map((m) => m.team_id)
  );
  const teamIds = new Set([
    ...memberTeamIds,
    ...db.teams.filter((t) => t.owner_id === userId).map((t) => t.id),
  ]);
  return db.teams.filter((t) => teamIds.has(t.id));
}

export function listDiscoverableTeams(db: AppDatabase, userId: string, query?: string): TeamItem[] {
  const memberTeamIds = new Set(
    db.teamMembers.filter((m) => m.user_id === userId).map((m) => m.team_id)
  );
  const q = query?.trim().toLowerCase();
  return db.teams.filter((t) => {
    if (memberTeamIds.has(t.id)) return false;
    if (t.member_count >= t.max_members) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

export function findTeam(db: AppDatabase, teamId: string): TeamItem | undefined {
  return db.teams.find((t) => t.id === teamId);
}

/** Authorization: throws unless the user is a member (or owner) of the team. */
export function assertTeamAccess(db: AppDatabase, userId: string, teamId: string): TeamItem {
  const team = findTeam(db, teamId);
  if (!team) throw new RepoError('Team not found', 404);
  const isMember =
    team.owner_id === userId || db.teamMembers.some((m) => m.team_id === teamId && m.user_id === userId);
  if (!isMember) throw new RepoError('You do not have access to this team', 403);
  return team;
}

export function listTeamMembers(db: AppDatabase, teamId: string): TeamMemberItem[] {
  return db.teamMembers
    .filter((m) => m.team_id === teamId)
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
}

function randomInviteCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'TEAM';
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function createTeam(
  db: AppDatabase,
  userId: string,
  input: {
    name: string;
    subject?: string;
    goal: string;
    target_date?: string;
    description?: string;
    category?: string;
    max_members?: number;
    tags?: string[];
    visibility?: 'private' | 'invite_only' | 'discoverable';
  }
): TeamItem {
  const user = findUserById(db, userId);
  const team: TeamItem = {
    id: newId('team'),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    goal: input.goal.trim(),
    project_topic: input.category?.trim() || input.name.trim(),
    category: input.category?.trim() || 'Academic Study',
    join_code: randomInviteCode(input.name),
    visibility: input.visibility ?? 'invite_only',
    owner_id: userId,
    owner_name: user?.name ?? 'Owner',
    max_members: input.max_members ?? 6,
    member_count: 1,
    progress_pct: 0,
    status: 'active',
    tags: input.tags?.length ? input.tags : input.subject ? [input.subject] : ['Study Group'],
    created_at: new Date().toISOString(),
  };
  db.teams.push(team);
  db.teamMembers.push({
    id: newId('tm'),
    team_id: team.id,
    user_id: userId,
    name: `${user?.name ?? 'You'} (You)`,
    email: user?.email ?? '',
    role: 'owner',
    avatar_url: user?.avatar_url ?? '',
    status: 'active',
    joined_at: new Date().toISOString(),
    confidence_topics: [],
  });
  logActivity(db, team.id, userId, 'member_joined', 'created and initialized the team', team.name);
  return team;
}

export function joinTeamByCode(
  db: AppDatabase,
  userId: string,
  code: string
): { team: TeamItem; alreadyMember: boolean } {
  const team = db.teams.find((t) => t.join_code.toUpperCase() === code.trim().toUpperCase());
  if (!team) throw new RepoError('Invalid invite code', 404);
  return joinTeam(db, userId, team.id);
}

export function joinTeam(
  db: AppDatabase,
  userId: string,
  teamId: string
): { team: TeamItem; alreadyMember: boolean } {
  const team = findTeam(db, teamId);
  if (!team) throw new RepoError('Team not found', 404);
  const existing = db.teamMembers.find((m) => m.team_id === teamId && m.user_id === userId);
  if (existing) return { team, alreadyMember: true };
  if (team.member_count >= team.max_members) {
    throw new RepoError('This team has reached its maximum member capacity', 409);
  }
  const user = findUserById(db, userId);
  db.teamMembers.push({
    id: newId('tm'),
    team_id: teamId,
    user_id: userId,
    name: `${user?.name ?? 'You'} (You)`,
    email: user?.email ?? '',
    role: 'member',
    avatar_url: user?.avatar_url ?? '',
    status: 'active',
    joined_at: new Date().toISOString(),
    confidence_topics: [],
  });
  team.member_count += 1;
  logActivity(db, teamId, userId, 'member_joined', 'joined the team', team.name);
  const pref = getPreferences(db, userId);
  if (!pref.active_team_id) pref.active_team_id = teamId;
  return { team, alreadyMember: false };
}

export function leaveTeam(db: AppDatabase, userId: string, teamId: string): void {
  const team = findTeam(db, teamId);
  if (!team) throw new RepoError('Team not found', 404);
  if (team.owner_id === userId) {
    throw new RepoError('Owners cannot leave their own team. Archive it instead.', 400);
  }
  const before = db.teamMembers.length;
  db.teamMembers = db.teamMembers.filter((m) => !(m.team_id === teamId && m.user_id === userId));
  if (db.teamMembers.length !== before) team.member_count = Math.max(1, team.member_count - 1);
  const pref = getPreferences(db, userId);
  if (pref.active_team_id === teamId) pref.active_team_id = null;
}

export function removeTeamMember(
  db: AppDatabase,
  requesterId: string,
  teamId: string,
  memberId: string
): void {
  const team = findTeam(db, teamId);
  if (!team) throw new RepoError('Team not found', 404);
  if (team.owner_id !== requesterId) {
    throw new RepoError('Only the team owner can remove members', 403);
  }
  const member = db.teamMembers.find((m) => m.id === memberId && m.team_id === teamId);
  if (!member) throw new RepoError('Member not found', 404);
  if (member.user_id === requesterId) throw new RepoError('The owner cannot be removed', 400);
  db.teamMembers = db.teamMembers.filter((m) => m.id !== memberId);
  team.member_count = Math.max(1, team.member_count - 1);
}

export function updateMemberKnowledge(
  db: AppDatabase,
  userId: string,
  teamId: string,
  topics: { topic: string; score: number }[]
): TeamMemberItem {
  const member = db.teamMembers.find((m) => m.team_id === teamId && m.user_id === userId);
  if (!member) throw new RepoError('You are not a member of this team', 403);
  member.confidence_topics = topics
    .map((t) => ({
      topic: t.topic.trim(),
      score: Math.min(5, Math.max(1, Math.round(t.score))),
    }))
    .filter((t) => t.topic);
  return member;
}

// ---------------------------------------------------------------------------
// Discussions / activities / resources / notifications
// ---------------------------------------------------------------------------

export function listDiscussions(db: AppDatabase, teamId: string): DiscussionMessage[] {
  return db.discussions
    .filter((d) => d.team_id === teamId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function sendDiscussion(
  db: AppDatabase,
  userId: string,
  teamId: string,
  content: string
): DiscussionMessage {
  const user = findUserById(db, userId);
  const message: DiscussionMessage = {
    id: newId('disc'),
    team_id: teamId,
    user_id: userId,
    user_name: `${user?.name ?? 'You'} (You)`,
    user_avatar: user?.avatar_url ?? '',
    content: content.trim(),
    created_at: new Date().toISOString(),
    attachments: null,
  };
  db.discussions.push(message);
  logActivity(db, teamId, userId, 'discussion_posted', 'posted a message', content.slice(0, 40));
  return message;
}

export function listActivities(db: AppDatabase, teamId: string): TeamActivityItem[] {
  return db.teamActivities
    .filter((a) => a.team_id === teamId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);
}

export function listResources(
  db: AppDatabase,
  userId: string,
  filter?: { teamId?: string | null; category?: string; search?: string }
): ResourceItem[] {
  const teamIds = new Set(listTeams(db, userId).map((t) => t.id));
  const q = filter?.search?.trim().toLowerCase();
  return db.resources
    .filter((r) => {
      const visible = r.uploader_id === userId || (r.team_id ? teamIds.has(r.team_id) : false);
      if (!visible) return false;
      if (filter?.teamId !== undefined) {
        if (filter.teamId === null ? r.team_id !== null : r.team_id !== filter.teamId) return false;
      }
      if (filter?.category && r.category !== filter.category) return false;
      if (q && !`${r.title} ${r.file_name}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createResource(
  db: AppDatabase,
  userId: string,
  input: {
    title: string;
    url: string;
    type?: ResourceItem['file_type'];
    category?: ResourceItem['category'];
    team_id?: string | null;
    folder?: string;
    file_name?: string;
    file_size_bytes?: number;
  }
): ResourceItem {
  if (input.team_id) assertTeamAccess(db, userId, input.team_id);
  const user = findUserById(db, userId);
  const team = input.team_id ? findTeam(db, input.team_id) : undefined;
  const size = input.file_size_bytes ?? 0;
  const resource: ResourceItem = {
    id: newId('res'),
    title: input.title.trim(),
    file_name: input.file_name ?? input.title.trim(),
    file_type: input.type ?? 'link',
    file_size_bytes: size,
    file_size_formatted:
      size > 1_000_000
        ? `${(size / 1_000_000).toFixed(1)} MB`
        : size > 0
        ? `${Math.round(size / 1000)} KB`
        : 'External Link',
    storage_path: '',
    url: input.url,
    uploader_id: userId,
    uploader_name: user?.name ?? 'You',
    team_id: input.team_id ?? null,
    team_name: team?.name ?? null,
    folder: input.folder ?? 'General',
    category: input.category ?? 'links',
    is_shared: Boolean(input.team_id),
    created_at: new Date().toISOString(),
  };
  db.resources.push(resource);
  if (input.team_id) {
    logActivity(db, input.team_id, userId, 'resource_uploaded', 'shared a resource', resource.title);
  }
  return resource;
}

export function deleteResource(db: AppDatabase, userId: string, resourceId: string): void {
  const resource = db.resources.find((r) => r.id === resourceId);
  if (!resource) throw new RepoError('Resource not found', 404);
  if (resource.uploader_id !== userId) {
    throw new RepoError('You can only remove resources you uploaded', 403);
  }
  db.resources = db.resources.filter((r) => r.id !== resourceId);
}

export function listNotifications(db: AppDatabase, userId: string): NotificationItem[] {
  return db.notifications
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function markNotification(db: AppDatabase, userId: string, id: string): void {
  const notif = db.notifications.find((n) => n.id === id && n.user_id === userId);
  if (!notif) throw new RepoError('Notification not found', 404);
  notif.is_read = true;
}

export function markAllNotifications(db: AppDatabase, userId: string): void {
  db.notifications.forEach((n) => {
    if (n.user_id === userId) n.is_read = true;
  });
}

export function listMilestones(db: AppDatabase, userId: string) {
  return db.milestones.filter((m) => m.user_id === userId);
}

// ---------------------------------------------------------------------------
// Team check-ins & workload check-ins
// ---------------------------------------------------------------------------

export function listTeamCheckIns(db: AppDatabase, teamId: string): TeamCheckinItem[] {
  return db.teamCheckIns
    .filter((c) => c.team_id === teamId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function setTeamCheckIn(
  db: AppDatabase,
  userId: string,
  teamId: string,
  status: TeamCheckinItem['status'],
  note?: string
): TeamCheckinItem {
  const user = findUserById(db, userId);
  db.teamCheckIns = db.teamCheckIns.filter(
    (c) => !(c.team_id === teamId && c.user_id === userId)
  );
  const checkIn: TeamCheckinItem = {
    id: newId('tc'),
    team_id: teamId,
    user_id: userId,
    user_name: user?.name ?? 'You',
    status,
    note,
    created_at: new Date().toISOString(),
  };
  db.teamCheckIns.push(checkIn);
  logActivity(db, teamId, userId, 'discussion_posted', 'updated their status', status);
  return checkIn;
}

export function addWorkloadCheckIn(
  db: AppDatabase,
  userId: string,
  input: { level: WorkloadCheckIn['level']; available_minutes?: number | null }
): WorkloadCheckIn {
  const record: WorkloadCheckIn = {
    id: newId('wc'),
    user_id: userId,
    date: new Date().toISOString().slice(0, 10),
    level: input.level,
    available_minutes: input.available_minutes ?? null,
    created_at: new Date().toISOString(),
  };
  db.workloadCheckIns.push(record);
  return record;
}

// ---------------------------------------------------------------------------
// AI settings & notes
// ---------------------------------------------------------------------------

/** Keep in sync with `DEMO_EMAIL` in seed.ts. */
const DEMO_EMAIL = 'sahil@university.edu';

/** Demo mode is the demo account, or an explicit DEMO_MODE=true deployment. */
export function isDemoUser(user: { email: string }): boolean {
  return (
    user.email.trim().toLowerCase() === DEMO_EMAIL || process.env.DEMO_MODE === 'true'
  );
}

function maskApiKey(key: string): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function toPublicAISettings(settings: AISettings | null): AISettingsPublic {
  if (!settings) {
    return { provider: 'mock', model: '', has_key: false, masked_key: null, updated_at: null };
  }
  return {
    provider: settings.provider,
    model: settings.model,
    has_key: Boolean(settings.api_key),
    masked_key: maskApiKey(settings.api_key),
    updated_at: settings.updated_at,
  };
}

/** Full settings, including the secret key. Server-side use only. */
export function getAISettings(db: AppDatabase, userId: string): AISettings | null {
  return db.aiSettings.find((s) => s.user_id === userId) ?? null;
}

/**
 * Save AI settings. When `api_key` is omitted or empty the existing key is
 * preserved, so users can change the model without re-entering the secret.
 * Passing api_key: '' with clear_key: true removes the stored key.
 */
export function saveAISettings(
  db: AppDatabase,
  userId: string,
  input: { provider: AIProviderKey; api_key?: string; model?: string; clear_key?: boolean }
): AISettings {
  let settings = getAISettings(db, userId);
  if (!settings) {
    settings = {
      user_id: userId,
      provider: 'mock',
      api_key: '',
      model: '',
      updated_at: new Date().toISOString(),
    };
    db.aiSettings.push(settings);
  }
  settings.provider = input.provider;
  if (input.clear_key) {
    settings.api_key = '';
  } else if (input.api_key && input.api_key.trim()) {
    settings.api_key = input.api_key.trim();
  }
  if (input.model !== undefined) settings.model = input.model.trim();
  settings.updated_at = new Date().toISOString();
  return settings;
}

// ---------------------------------------------------------------------------
// Notes (uploaded PDFs)
// ---------------------------------------------------------------------------

export function listNotes(db: AppDatabase, userId: string): NoteItem[] {
  return db.notes
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function findNote(db: AppDatabase, userId: string, id: string): NoteItem | undefined {
  return db.notes.find((n) => n.id === id && n.user_id === userId);
}

export function createNote(
  db: AppDatabase,
  userId: string,
  input: {
    title: string;
    file_name: string;
    subject_id?: string | null;
    page_count?: number;
    text: string;
  }
): NoteItem {
  const subject = input.subject_id ? findSubject(db, userId, input.subject_id) : undefined;
  const note: NoteItem = {
    id: newId('note'),
    user_id: userId,
    subject_id: input.subject_id ?? null,
    subject_name: subject?.name ?? 'General',
    title: input.title.trim() || input.file_name,
    file_name: input.file_name,
    page_count: input.page_count ?? 0,
    char_count: input.text.length,
    text: input.text,
    created_at: new Date().toISOString(),
  };
  db.notes.push(note);
  return note;
}

export function deleteNote(db: AppDatabase, userId: string, id: string): void {
  const note = findNote(db, userId, id);
  if (!note) throw new RepoError('Note not found', 404);
  db.notes = db.notes.filter((n) => n.id !== id);
}

export function updateUser(db: AppDatabase, userId: string, patch: Partial<UserProfile>): UserProfile {
  const user = findUserById(db, userId);
  if (!user) throw new RepoError('User not found', 404);
  const allowed: Partial<UserProfile> = {
    name: patch.name?.trim() ?? user.name,
    avatar_url: patch.avatar_url ?? user.avatar_url,
    bio: patch.bio ?? user.bio,
    institution: patch.institution ?? user.institution,
    course: patch.course ?? user.course,
    academic_year: patch.academic_year ?? user.academic_year,
    location: patch.location ?? user.location,
    timezone: patch.timezone ?? user.timezone,
    skills: patch.skills ?? user.skills,
    interests: patch.interests ?? user.interests,
  };
  Object.assign(user, allowed, { updated_at: new Date().toISOString() });
  return user;
}
