/**
 * Deterministic priority scoring (plan section 6).
 *
 * The scheduler must stay predictable and explainable (P2). Every score carries
 * the human-readable reasons that produced it, so the UI can always answer
 * "why did you pick this?".
 */

import type { GoalItem, PlannedItem, SubjectItem, TaskItem } from '../domain';

export type PriorityFactors = {
  deadline_urgency: number;
  knowledge_gap: number;
  goal_importance: number;
  prerequisite_importance: number;
  effort: number;
  progress: number;
};

export type PriorityResult = {
  score: number;
  reasons: string[];
  factors: PriorityFactors;
};

const HOUR = 3_600_000;

function knowledgeLevelFor(task: TaskItem, subjects: SubjectItem[]): number {
  if (task.subject_id) {
    const subject = subjects.find((s) => s.id === task.subject_id);
    if (subject) return subject.confidence_score;
  }
  const byName = subjects.find(
    (s) => s.name.toLowerCase() === (task.subject_name || '').toLowerCase()
  );
  return byName ? byName.confidence_score : 3;
}

function goalPriorityWeight(priority: GoalItem['priority']): number {
  if (priority === 'high') return 15;
  if (priority === 'medium') return 8;
  return 3;
}

/** Does an unfinished prerequisite task block a later topic? */
function prerequisiteWeight(task: TaskItem): { weight: number; reason: string | null } {
  const text = `${task.title} ${task.description}`.toLowerCase();
  const prerequisiteTopics = ['integration', 'fundamental', 'basics', 'prerequisite', 'foundation'];
  const isPrerequisite = prerequisiteTopics.some((topic) => text.includes(topic));
  if (isPrerequisite) {
    return {
      weight: 12,
      reason: 'Foundational topic that later work depends on',
    };
  }
  return { weight: 0, reason: null };
}

export function scoreTask(
  task: TaskItem,
  subjects: SubjectItem[],
  goals: GoalItem[],
  now: Date = new Date()
): PriorityResult {
  const reasons: string[] = [];
  const deadline = new Date(task.due_date).getTime();
  const hoursLeft = (deadline - now.getTime()) / HOUR;

  // 1. Deadline urgency (max 40)
  let deadline_urgency = 4;
  if (hoursLeft <= 0) {
    deadline_urgency = 40;
    reasons.push('Overdue — needs attention first');
  } else if (hoursLeft <= 24) {
    deadline_urgency = 34;
    reasons.push('Due within 24 hours');
  } else if (hoursLeft <= 72) {
    deadline_urgency = 24;
    reasons.push('Due within 3 days');
  } else if (hoursLeft <= 168) {
    deadline_urgency = 12;
    reasons.push('Due this week');
  } else {
    reasons.push('Due later');
  }

  // 2. Knowledge gap (max 25)
  const knowledgeLevel = knowledgeLevelFor(task, subjects);
  const knowledge_gap = (5 - knowledgeLevel) * 5;
  if (knowledgeLevel <= 2) {
    reasons.push(`Low confidence in ${task.subject_name || 'this subject'} (${knowledgeLevel}/5)`);
  } else if (knowledgeLevel === 3) {
    reasons.push('Moderate confidence — some reinforcement needed');
  }

  // 3. Goal importance (max 15)
  const linkedGoals = goals.filter(
    (g) =>
      g.status === 'active' &&
      (g.subject_id === task.subject_id ||
        g.subject_name.toLowerCase() === (task.subject_name || '').toLowerCase())
  );
  const goal_importance = linkedGoals.reduce(
    (max, goal) => Math.max(max, goalPriorityWeight(goal.priority)),
    0
  );
  if (goal_importance > 0) {
    reasons.push(`Supports your active ${linkedGoals[0].mode === 'FAST_PREP' ? 'exam prep' : 'keep-up'} goal`);
  }

  // 4. Prerequisite importance (max 12)
  const prereq = prerequisiteWeight(task);
  const prerequisite_importance = prereq.weight;
  if (prereq.reason) reasons.push(prereq.reason);

  // 5. Effort balance (max 8) — favour short wins for momentum, cap big blocks.
  let effort = 0;
  if (task.estimated_minutes <= 25) {
    effort = 8;
    reasons.push('Short task — quick win');
  } else if (task.estimated_minutes <= 45) {
    effort = 5;
  } else {
    effort = 2;
  }

  // 6. Progress (max 8) — prefer finishing what is already underway.
  let progress = 0;
  if (task.status === 'in_progress') {
    progress = 8;
    reasons.push('Already in progress — finish it');
  } else if (task.status === 'review') {
    progress = 5;
    reasons.push('In review — almost done');
  }

  const score = Math.round(
    deadline_urgency + knowledge_gap + goal_importance + prerequisite_importance + effort + progress
  );

  return {
    score,
    reasons,
    factors: {
      deadline_urgency,
      knowledge_gap,
      goal_importance,
      prerequisite_importance,
      effort,
      progress,
    },
  };
}

/** Rank all actionable tasks (not done / skipped) highest score first. */
export function rankTasks(
  tasks: TaskItem[],
  subjects: SubjectItem[],
  goals: GoalItem[],
  now: Date = new Date()
): { task: TaskItem; priority: PriorityResult }[] {
  return tasks
    .filter((task) => task.status !== 'done')
    .map((task) => ({ task, priority: scoreTask(task, subjects, goals, now) }))
    .sort((a, b) => b.priority.score - a.priority.score);
}

export function scorePlannedItem(item: PlannedItem): number {
  return item.priority_score;
}
