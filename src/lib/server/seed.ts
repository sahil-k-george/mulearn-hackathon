/**
 * Demo seed (plan section 22).
 *
 * Creates the full "Sahil" demo scenario: an Engineering Mathematics exam in a
 * few days, a physics record due tomorrow, a low-confidence Integration gap and
 * a shared presentation with Arun and Neha. Dates are rebased relative to the
 * anchor so the demo always looks current.
 */

import type { AppDatabase } from './store';
import { hashPassword } from './auth';
import {
  INITIAL_ACTIVITIES,
  INITIAL_DISCUSSIONS,
  INITIAL_MILESTONES,
  INITIAL_NOTIFICATIONS,
  INITIAL_RESOURCES,
  INITIAL_SUBJECTS,
  INITIAL_TASKS,
  INITIAL_TEAM_CHECKINS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_TEAMS,
  INITIAL_USER,
} from '../mockData';

export const DEMO_EMAIL = 'sahil@university.edu';
export const DEMO_PASSWORD = 'demo1234';

const ANCHOR = new Date('2026-09-27T10:00:00Z').getTime();

function shift(iso: string | null | undefined, delta: number): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t + delta).toISOString();
}

export function ensureSeeded(db: AppDatabase): void {
  if (db.users.length > 0) return;

  const delta = Date.now() - ANCHOR;
  const user = {
    ...INITIAL_USER,
    created_at: shift(INITIAL_USER.created_at, delta) ?? INITIAL_USER.created_at,
    updated_at: new Date().toISOString(),
  };

  const { hash, salt } = hashPassword(DEMO_PASSWORD);

  db.users = [user];
  db.credentials = [
    { user_id: user.id, password_hash: hash, salt, created_at: new Date().toISOString() },
  ];
  db.subjects = INITIAL_SUBJECTS.map((s) => ({
    ...s,
    created_at: shift(s.created_at, delta) ?? s.created_at,
  }));

  const subjectsByName = new Map(db.subjects.map((s) => [s.name, s]));
  const maths = subjectsByName.get('Engineering Mathematics');
  const physics = subjectsByName.get('Applied Physics');

  db.goals = [
    {
      id: 'goal_maths_exam',
      user_id: user.id,
      subject_id: maths?.id ?? null,
      subject_name: 'Engineering Mathematics',
      mode: 'FAST_PREP',
      title: 'Engineering Mathematics Exam',
      description: 'Internal assessment covering integration, Fourier series and differential equations.',
      target_date: new Date(Date.now() + 4 * 86_400_000).toISOString(),
      priority: 'high',
      status: 'active',
      available_minutes_per_day: 120,
      created_at: new Date().toISOString(),
    },
    {
      id: 'goal_physics_keepup',
      user_id: user.id,
      subject_id: physics?.id ?? null,
      subject_name: 'Applied Physics',
      mode: 'KEEP_UP',
      title: 'Keep up with Applied Physics',
      description: 'Stay current with Thermodynamics and Optics while exam prep is running.',
      target_date: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      priority: 'medium',
      status: 'active',
      available_minutes_per_day: 60,
      created_at: new Date().toISOString(),
    },
  ];

  db.tasks = INITIAL_TASKS.map((t) => ({
    ...t,
    due_date: shift(t.due_date, delta) ?? t.due_date,
    completed_at: shift(t.completed_at, delta),
    created_at: shift(t.created_at, delta) ?? t.created_at,
  }));

  db.teams = INITIAL_TEAMS.map((t) => ({
    ...t,
    created_at: shift(t.created_at, delta) ?? t.created_at,
  }));
  db.teamMembers = INITIAL_TEAM_MEMBERS.map((m) => ({
    ...m,
    joined_at: shift(m.joined_at, delta) ?? m.joined_at,
  }));
  db.discussions = INITIAL_DISCUSSIONS.map((d) => ({
    ...d,
    created_at: shift(d.created_at, delta) ?? d.created_at,
  }));
  db.teamActivities = INITIAL_ACTIVITIES.map((a) => ({
    ...a,
    created_at: shift(a.created_at, delta) ?? a.created_at,
  }));
  db.resources = INITIAL_RESOURCES.map((r) => ({
    ...r,
    created_at: shift(r.created_at, delta) ?? r.created_at,
  }));
  db.notifications = INITIAL_NOTIFICATIONS.map((n) => ({
    ...n,
    created_at: shift(n.created_at, delta) ?? n.created_at,
  }));
  db.milestones = INITIAL_MILESTONES.map((m) => ({
    ...m,
    due_date: shift(m.due_date, delta) ?? m.due_date,
    completed_at: shift(m.completed_at, delta),
    created_at: shift(m.created_at, delta) ?? m.created_at,
  }));

  db.preferences = [
    {
      user_id: user.id,
      available_minutes_per_day: 120,
      mode: 'FAST_PREP',
      subject_id: maths?.id ?? null,
      active_team_id: 'team_maths_survivors',
      updated_at: new Date().toISOString(),
    },
  ];

  db.teamCheckIns = INITIAL_TEAM_CHECKINS.map((c) => ({
    ...c,
    created_at: shift(c.created_at, delta) ?? c.created_at,
  }));
  db.studySessions = [];
  db.planEvents = [];
  db.workloadCheckIns = [];
  db.passwordResets = [];
  db.sessions = [];
}

/** Create a brand-new isolated student (used by registration). */
export function createStarterData(db: AppDatabase, userId: string): void {
  db.preferences.push({
    user_id: userId,
    available_minutes_per_day: 120,
    mode: 'KEEP_UP',
    subject_id: null,
    active_team_id: null,
    updated_at: new Date().toISOString(),
  });
  db.notifications.push({
    id: `notif_welcome_${userId}`,
    user_id: userId,
    type: 'team_activity',
    title: 'Welcome to Adaptive',
    message: 'Start with a brain dump — tell us what is going on and we will build your first plan.',
    link: '/planner',
    is_read: false,
    created_at: new Date().toISOString(),
  });
}
