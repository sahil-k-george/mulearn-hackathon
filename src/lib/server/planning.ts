/**
 * Planning composition.
 *
 * Bridges storage and the pure engines: reads the user's context, runs the
 * deterministic planner, and shapes the result for the dashboard and progress
 * views. No scheduling logic lives here.
 */

import type { AppDatabase } from './store';
import type {
  DashboardData,
  PlanEvent,
  PlanResult,
  UserProfile,
  WorkloadAssessment,
} from '../domain';
import { buildPlan } from '../engine/planner';
import { assessWorkload } from '../engine/workload';
import type { ProgressOverviewData } from '../api';
import {
  getPreferences,
  listGoals,
  listMilestones,
  listSubjects,
  listTasks,
} from './repo';

export function buildPlanForUser(
  db: AppDatabase,
  user: UserProfile,
  overrides?: { availableMinutes?: number; mode?: 'FAST_PREP' | 'KEEP_UP'; subjectId?: string | null }
): PlanResult {
  const pref = getPreferences(db, user.id);
  const subjects = listSubjects(db, user.id);
  const tasks = listTasks(db, user.id);
  const goals = listGoals(db, user.id);
  const events: PlanEvent[] = db.planEvents.filter((e) => e.user_id === user.id);

  const mode = overrides?.mode ?? pref.mode;
  const subjectId = overrides?.subjectId !== undefined ? overrides.subjectId : pref.subject_id;
  const availableMinutes = overrides?.availableMinutes ?? pref.available_minutes_per_day;

  return buildPlan({
    subjects,
    tasks,
    goals,
    availableMinutes,
    mode,
    subjectId,
    now: new Date(),
    events,
  });
}

export function assessWorkloadForUser(
  db: AppDatabase,
  user: UserProfile,
  plan: PlanResult
): WorkloadAssessment {
  const latestCheckIn = db.workloadCheckIns
    .filter((c) => c.user_id === user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  return assessWorkload({
    plannedMinutes: plan.planned_minutes,
    availableMinutes: plan.available_minutes,
    preferredLevel: latestCheckIn?.level ?? null,
  });
}

export function getDashboardData(
  db: AppDatabase,
  user: UserProfile,
  overrides?: { availableMinutes?: number; mode?: 'FAST_PREP' | 'KEEP_UP'; subjectId?: string | null }
): DashboardData {
  const plan = buildPlanForUser(db, user, overrides);
  const workload = assessWorkloadForUser(db, user, plan);
  const nextStep =
    plan.items.find((item) => !item.is_break && item.status === 'planned') ?? null;

  return {
    user,
    preferences: getPreferences(db, user.id),
    subjects: listSubjects(db, user.id),
    goals: listGoals(db, user.id),
    tasks: listTasks(db, user.id),
    plan,
    workload,
    next_step: nextStep,
  };
}

export function getProgressOverview(db: AppDatabase, user: UserProfile): ProgressOverviewData {
  const tasks = listTasks(db, user.id);
  const subjects = listSubjects(db, user.id);
  const milestones = listMilestones(db, user.id);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'done').length;
  const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length;
  const overall = total ? Math.round((completed / total) * 100) : 0;

  const now = Date.now();
  const in7 = now + 7 * 86_400_000;
  const upcoming = tasks.filter((t) => {
    if (t.status === 'done') return false;
    const due = new Date(t.due_date).getTime();
    return due >= now && due <= in7;
  }).length;

  const subjectMap = new Map<string, { total: number; done: number; category: string }>();
  subjects.forEach((s) => subjectMap.set(s.name, { total: 0, done: 0, category: s.category }));
  tasks.forEach((t) => {
    const name = t.subject_name || 'Other';
    if (!subjectMap.has(name)) subjectMap.set(name, { total: 0, done: 0, category: 'General' });
    const entry = subjectMap.get(name)!;
    entry.total += 1;
    if (t.status === 'done') entry.done += 1;
  });

  const subjectBreakdown = Array.from(subjectMap.entries()).map(([name, data]) => {
    const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
    return {
      subjectId: name,
      subjectName: name,
      progressPercentage: pct,
      category: data.category,
      status: pct >= 80 ? 'Mastered' : pct >= 50 ? 'In Progress' : 'Needs Focus',
    };
  });

  const sessions = db.studySessions.filter((s) => s.user_id === user.id);
  const deepStudyMinutes = sessions
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + (s.actual_minutes ?? s.duration_minutes), 0);

  const recentActivities: ProgressOverviewData['recentActivities'] = [
    ...sessions
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        id: `prog_session_${s.id}`,
        type: 'task_completed' as const,
        title: `Studied: ${s.title}`,
        description: `${s.subject_name} • ${s.actual_minutes ?? s.duration_minutes} min`,
        timestamp: s.created_at,
        subjectName: s.subject_name,
      })),
    ...tasks
      .filter((t) => t.completed_at)
      .map((t) => ({
        id: `prog_task_${t.id}`,
        type: 'task_completed' as const,
        title: `Completed: ${t.title}`,
        description: `${t.subject_name} • Marked finished`,
        timestamp: t.completed_at as string,
        subjectName: t.subject_name,
      })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  return {
    overallProgressPercentage: overall,
    completedTasksCount: completed,
    totalTasksCount: total,
    activeTasksCount: active,
    upcomingDeadlinesCount: upcoming,
    currentStreakDays: user.streak_days,
    deepStudyTimeHours: Math.floor(deepStudyMinutes / 60),
    deepStudyTimeMinutes: deepStudyMinutes % 60,
    subjectBreakdown,
    milestones,
    recentActivities,
  };
}
