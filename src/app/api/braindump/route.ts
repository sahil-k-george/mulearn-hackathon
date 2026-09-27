import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { requireAIService } from '@/lib/server/ai';
import {
  createGoal,
  createSubject,
  createTask,
  getPreferences,
  listSubjects,
} from '@/lib/server/repo';
import { readDb, transact } from '@/lib/server/store';
import type {
  BrainDumpCollaboration,
  BrainDumpExtraction,
  BrainDumpGoal,
  BrainDumpTask,
  GoalMode,
} from '@/lib/domain';
import type { AppDatabase } from '@/lib/server/store';
import type { SubjectItem } from '@/lib/database.types';

function resolveSubject(db: AppDatabase, userId: string, name: string): SubjectItem {
  const normalized = name.trim().toLowerCase();
  const existing = db.subjects.find(
    (s) => s.user_id === userId && s.name.toLowerCase() === normalized
  );
  if (existing) return existing;
  return createSubject(db, userId, { name: name.trim() || 'General' });
}

/**
 * POST = extract only. The user reviews and edits before anything is saved
 * (plan section 5: "shown to the user before it becomes permanent data").
 */
export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{ text?: string }>(request);
    const text = body.text?.trim() ?? '';
    if (text.length < 5) throw new HttpError('Tell us a little more about what is going on.', 400);

    const db = await readDb();
    const subjects = listSubjects(db, user.id);
    const { service, status } = requireAIService(db, user);

    const extraction = await service.extractBrainDump(text, {
      subjects,
      now: new Date(),
      timezone: user.timezone,
    });

    return json({ extraction, ai: status });
  });
}

/** PUT = commit the (possibly edited) extraction to real data. */
export async function PUT(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      tasks?: BrainDumpTask[];
      goals?: BrainDumpGoal[];
      knowledge_gaps?: BrainDumpExtraction['knowledge_gaps'];
      collaboration?: BrainDumpCollaboration[];
      available_minutes?: number | null;
      mode?: GoalMode;
    }>(request);

    const result = await transact((db) => {
      const createdTasks: string[] = [];
      const createdGoals: string[] = [];
      const subjectsBefore = db.subjects.filter((s) => s.user_id === user.id).length;

      for (const task of body.tasks ?? []) {
        if (!task.title?.trim()) continue;
        const subject = resolveSubject(db, user.id, task.subject_name || 'General');
        const created = createTask(db, user.id, {
          title: task.title,
          subject_id: subject.id,
          subject_name: subject.name,
          due_date: task.deadline,
          estimated_minutes: task.estimated_minutes,
          priority: task.priority,
          description: 'Added from a brain dump.',
        });
        createdTasks.push(created.id);
      }

      for (const goal of body.goals ?? []) {
        if (!goal.title?.trim()) continue;
        const subject = resolveSubject(db, user.id, goal.subject_name || 'General');
        const created = createGoal(db, user.id, {
          title: goal.title,
          subject_id: subject.id,
          mode: goal.mode === 'KEEP_UP' ? 'KEEP_UP' : 'FAST_PREP',
          target_date: goal.target_date,
          priority: 'high',
          description: 'From a brain dump.',
        });
        createdGoals.push(created.id);
      }

      // Knowledge gaps lower the subject's confidence so planning reacts.
      for (const gap of body.knowledge_gaps ?? []) {
        const subject = resolveSubject(db, user.id, gap.subject_name || 'General');
        if (gap.topic) subject.current_topic = gap.topic;
        if (subject.confidence_score > 2) subject.confidence_score = 2;
      }

      // Shared activities become tasks you can plan around.
      for (const collab of body.collaboration ?? []) {
        const created = createTask(db, user.id, {
          title: collab.activity || 'Group activity',
          subject_name: 'General',
          due_date: collab.deadline ?? new Date(Date.now() + 3 * 86_400_000).toISOString(),
          estimated_minutes: 30,
          priority: 'high',
          description: `Shared with ${collab.members.join(', ')}.`,
        });
        createdTasks.push(created.id);
      }

      const pref = getPreferences(db, user.id);
      if (body.available_minutes && body.available_minutes > 0) {
        pref.available_minutes_per_day = Math.round(body.available_minutes);
      }
      if (body.mode) pref.mode = body.mode === 'KEEP_UP' ? 'KEEP_UP' : 'FAST_PREP';

      return {
        created_tasks: createdTasks.length,
        created_goals: createdGoals.length,
        created_subjects:
          db.subjects.filter((s) => s.user_id === user.id).length - subjectsBefore,
        suggested_team:
          (body.collaboration ?? []).length > 0
            ? {
                name: `${(body.collaboration ?? [])[0].members.slice(0, 3).join(' & ')} Study Group`,
                members: (body.collaboration ?? []).flatMap((c) => c.members),
                activity: (body.collaboration ?? [])[0].activity,
              }
            : null,
      };
    });

    return json(result);
  });
}
