/**
 * Deterministic planning engine (plan sections 6, 7, 8).
 *
 * The scheduler is intentionally predictable: it ranks tasks by the priority
 * engine, converts them into time-boxed blocks, inserts breaks, and stops when
 * the student's available time is used up. Nothing here calls an LLM.
 */

import type {
  DeferredItem,
  GoalItem,
  PlanEvent,
  PlanItemKind,
  PlanResult,
  PlannedItem,
  SubjectItem,
  TaskItem,
} from '../domain';
import { KNOWLEDGE_LEVEL_LABELS } from '../domain';
import { rankTasks, scoreTask } from './priority';

export type BuildPlanInput = {
  subjects: SubjectItem[];
  tasks: TaskItem[];
  goals: GoalItem[];
  availableMinutes: number;
  mode: 'FAST_PREP' | 'KEEP_UP';
  subjectId: string | null;
  now: Date;
  events?: PlanEvent[];
  /** Break reserve ratio — plan P3: never fill every available minute. */
  breakRatio?: number;
};

function id(prefix: string, n: number): string {
  return `${prefix}_${n}`;
}

/** Apply adaptive events to the task list before re-planning (plan section 9). */
export function applyEventsToTasks(tasks: TaskItem[], events: PlanEvent[]): TaskItem[] {
  if (!events?.length) return tasks;
  const adjustments = new Map<string, number>();
  const deadlineChanges = new Map<string, string>();

  for (const event of events) {
    if (!event.task_id) continue;
    if (event.type === 'TASK_EXTENDED') {
      const extra = Number(event.payload?.extraMinutes ?? 0);
      adjustments.set(event.task_id, (adjustments.get(event.task_id) ?? 0) + extra);
    } else if (event.type === 'TASK_SHORTENED') {
      const less = Number(event.payload?.extraMinutes ?? 0);
      adjustments.set(event.task_id, (adjustments.get(event.task_id) ?? 0) - less);
    } else if (event.type === 'DEADLINE_CHANGED' && typeof event.payload?.deadline === 'string') {
      deadlineChanges.set(event.task_id, event.payload.deadline as string);
    }
  }

  return tasks.map((task) => {
    let next = task;
    const delta = adjustments.get(task.id);
    if (delta) {
      next = { ...next, estimated_minutes: Math.max(5, next.estimated_minutes + delta) };
    }
    const deadline = deadlineChanges.get(task.id);
    if (deadline) next = { ...next, due_date: deadline };
    return next;
  });
}

function breakFor(prevWorkMinutes: number): number {
  if (prevWorkMinutes >= 45) return 10;
  if (prevWorkMinutes >= 25) return 5;
  return 0;
}

function focusTopicFor(subject: SubjectItem | undefined, goal: GoalItem | undefined): string {
  if (subject?.current_topic) return subject.current_topic;
  if (goal) return goal.title;
  return subject?.name ?? 'your current topic';
}

/** Derived study blocks for a goal when there are not enough concrete tasks. */
function derivedBlocks(
  goal: GoalItem,
  subject: SubjectItem | undefined,
  startIndex: number
): { title: string; minutes: number; kind: PlanItemKind; reasons: string[]; score: number }[] {
  const topic = focusTopicFor(subject, goal);
  const level = subject?.confidence_score ?? 3;
  const blocks: { title: string; minutes: number; kind: PlanItemKind; reasons: string[]; score: number }[] = [];

  if (goal.mode === 'FAST_PREP') {
    blocks.push({
      title: `Learn fundamentals — ${topic}`,
      minutes: level <= 2 ? 30 : 20,
      kind: 'review',
      reasons: [
        level <= 2 ? `Low confidence (${level}/5) in this topic` : 'Reinforce core concepts',
        'Highest-impact topic for the upcoming assessment',
      ],
      score: 52 + startIndex,
    });
    blocks.push({
      title: `Standard problems — ${topic}`,
      minutes: 30,
      kind: 'practice',
      reasons: ['Practice under exam-like conditions', 'Converts understanding into speed'],
      score: 48 + startIndex,
    });
    blocks.push({
      title: 'Active recall check',
      minutes: 15,
      kind: 'recall',
      reasons: ['Spaced recall strengthens memory', 'Reveals remaining gaps'],
      score: 42 + startIndex,
    });
    blocks.push({
      title: 'Mock questions',
      minutes: 30,
      kind: 'mock',
      reasons: ['Simulates real assessment pressure', 'Exposes weak spots before it counts'],
      score: 38 + startIndex,
    });
  } else {
    blocks.push({
      title: `Review prerequisite — ${topic}`,
      minutes: 20,
      kind: 'review',
      reasons: ['Prerequisite for the topic your class is on', 'Closes a knowledge gap early'],
      score: 46 + startIndex,
    });
    blocks.push({
      title: `Continue ${topic}`,
      minutes: 30,
      kind: 'task',
      reasons: ['Keeps pace with your current syllabus', 'Continuous progress beats cramming'],
      score: 44 + startIndex,
    });
    blocks.push({
      title: 'Practice — 5 problems',
      minutes: 20,
      kind: 'practice',
      reasons: ['Active practice consolidates the topic', 'Builds fluency'],
      score: 40 + startIndex,
    });
  }

  return blocks;
}

export function buildPlan(input: BuildPlanInput): PlanResult {
  const {
    subjects,
    tasks,
    goals,
    availableMinutes,
    mode,
    subjectId,
    now,
    events = [],
    breakRatio = 0.05,
  } = input;

  const effectiveTasks = applyEventsToTasks(tasks, events);

  // Adaptive: a TIME_AVAILABLE_CHANGED event overrides the request value.
  let budget = Math.max(0, Math.round(availableMinutes));
  const timeEvents = events.filter((e) => e.type === 'TIME_AVAILABLE_CHANGED');
  if (timeEvents.length) {
    const latest = timeEvents[timeEvents.length - 1];
    const override = Number(latest.payload?.availableMinutes);
    if (Number.isFinite(override) && override >= 0) budget = Math.round(override);
  }

  const activeGoals = goals.filter((g) => g.status === 'active');
  const focusGoal =
    activeGoals.find((g) => subjectId && g.subject_id === subjectId) ??
    activeGoals.find((g) => g.mode === mode) ??
    activeGoals[0];
  const focusSubject = subjects.find(
    (s) => s.id === subjectId || s.id === focusGoal?.subject_id
  );

  const ranked = rankTasks(effectiveTasks, subjects, activeGoals, now);
  const deferred: DeferredItem[] = [];
  const items: PlannedItem[] = [];

  const workBudget = Math.max(0, Math.round(budget * (1 - breakRatio)));

  type Candidate = {
    taskId: string | null;
    goalId: string | null;
    title: string;
    subjectName: string;
    minutes: number;
    kind: PlanItemKind;
    reasons: string[];
    score: number;
  };

  const queue: Candidate[] = ranked.map(({ task, priority }) => ({
    taskId: task.id,
    goalId:
      focusGoal && focusGoal.subject_id === task.subject_id ? focusGoal.id : focusGoal?.id ?? null,
    title: task.title,
    subjectName: task.subject_name || 'General',
    minutes: task.estimated_minutes,
    kind: 'task',
    reasons: priority.reasons,
    score: priority.score,
  }));

  const scheduledMinutes = queue.reduce((sum, c) => sum + c.minutes, 0);
  if (focusGoal && scheduledMinutes < workBudget) {
    let idx = 0;
    for (const block of derivedBlocks(focusGoal, focusSubject, idx)) {
      queue.push({
        taskId: null,
        goalId: focusGoal.id,
        title: block.title,
        subjectName: focusSubject?.name ?? focusGoal.subject_name,
        minutes: block.minutes,
        kind: block.kind,
        reasons: block.reasons,
        score: block.score,
      });
      idx += 1;
    }
  }

  let cursor = new Date(now);
  let usedMinutes = 0;
  let breakMinutes = 0;
  let lastWork = 0;
  let counter = 1;
  let trimmed = false;

  for (const candidate of queue) {
    const needsBreak = items.length > 0 && breakFor(lastWork) > 0;
    const breakLen = needsBreak ? breakFor(lastWork) : 0;
    const projected = usedMinutes + breakLen + candidate.minutes;

    if (projected > budget) {
      // Before deferring, fit one trimmed block into whatever time remains so
      // the day is useful rather than half-empty.
      const remaining = Math.floor((budget - usedMinutes - breakLen) / 5) * 5;
      if (!trimmed && remaining >= 15 && candidate.minutes > remaining) {
        candidate.minutes = remaining;
        candidate.reasons = [
          ...candidate.reasons.slice(0, 2),
          `Shortened to ${remaining} min to fit your remaining time`,
        ];
        trimmed = true;
      } else {
        deferred.push({
          task_id: candidate.taskId ?? candidate.title,
          title: candidate.title,
          subject_name: candidate.subjectName,
          minutes: candidate.minutes,
          priority_score: candidate.score,
          reason: 'Moved to tomorrow — not enough time left today',
        });
        continue;
      }
    }

    if (breakLen > 0) {
      const breakItem: PlannedItem = {
        id: id('plan_break', counter++),
        task_id: null,
        goal_id: null,
        title: breakLen >= 10 ? 'Proper break — step away' : 'Short break — breathe',
        subject_name: 'Break',
        minutes: breakLen,
        kind: 'break',
        reasons: ['Breaks keep focus realistic, not maximal (P3)'],
        priority_score: 0,
        start_time: new Date(cursor).toISOString(),
        status: 'planned',
        is_break: true,
      };
      items.push(breakItem);
      cursor = new Date(cursor.getTime() + breakLen * 60_000);
      usedMinutes += breakLen;
      breakMinutes += breakLen;
    }

    items.push({
      id: id('plan', counter++),
      task_id: candidate.taskId,
      goal_id: candidate.goalId,
      title: candidate.title,
      subject_name: candidate.subjectName,
      minutes: candidate.minutes,
      kind: candidate.kind,
      reasons: candidate.reasons.slice(0, 3),
      priority_score: candidate.score,
      start_time: new Date(cursor).toISOString(),
      status: 'planned',
      is_break: false,
    });
    cursor = new Date(cursor.getTime() + candidate.minutes * 60_000);
    usedMinutes += candidate.minutes;
    lastWork = candidate.minutes;
  }

  const gapSubjects = subjects.filter((s) => s.confidence_score <= 3);
  const focus_areas = (focusSubject ? [focusSubject, ...gapSubjects.filter((s) => s.id !== focusSubject.id)] : gapSubjects)
    .slice(0, 3)
    .map((s) => ({
      topic: s.current_topic || s.name,
      knowledge_level: s.confidence_score,
      note:
        s.confidence_score <= 2
          ? `${KNOWLEDGE_LEVEL_LABELS[s.confidence_score]} — allocate extra time`
          : `${KNOWLEDGE_LEVEL_LABELS[s.confidence_score] ?? 'Moderate'} — light reinforcement`,
    }));

  const totalMinutes = budget;
  const headline = focusGoal
    ? `${mode === 'FAST_PREP' ? 'Fast Prep' : 'Keep Up'} — ${focusSubject?.name ?? focusGoal.subject_name}`
    : 'Your study plan';

  const summary =
    items.filter((i) => !i.is_break).length === 0
      ? 'Nothing to plan yet — add a brain dump or a subject to get started.'
      : `${items.filter((i) => !i.is_break).length} focused blocks using ${usedMinutes - breakMinutes} min of your ${totalMinutes} min, with ${breakMinutes} min of breaks.`;

  return {
    generated_at: now.toISOString(),
    mode,
    subject_id: focusSubject?.id ?? subjectId ?? null,
    subject_name: focusSubject?.name ?? focusGoal?.subject_name ?? null,
    headline,
    summary,
    available_minutes: budget,
    planned_minutes: usedMinutes - breakMinutes,
    break_minutes: breakMinutes,
    items,
    deferred: deferred.slice(0, 6),
    focus_areas,
  };
}

export { scoreTask };
