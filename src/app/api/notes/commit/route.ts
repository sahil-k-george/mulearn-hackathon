import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createGoal, createTask, findSubject, findNote } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { NotesPrepPlan } from '@/lib/domain';
import type { TaskItem } from '@/lib/database.types';

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      plan?: NotesPrepPlan;
      subject_id?: string | null;
      note_id?: string | null;
      create_goal?: boolean;
      target_date?: string;
      spread_days?: number;
    }>(request);

    const plan = body.plan;
    if (!plan || !Array.isArray(plan.topics) || plan.topics.length === 0) {
      throw new HttpError('There is no prep plan to add.', 400);
    }

    const spreadDays = Math.min(14, Math.max(1, body.spread_days ?? 3));

    const result = await transact((db) => {
      // Resolve the subject from the request, the note, or the plan name.
      let subjectId = body.subject_id ?? null;
      if (!subjectId && body.note_id) {
        const note = findNote(db, user.id, body.note_id);
        subjectId = note?.subject_id ?? null;
      }
      const subject = subjectId ? findSubject(db, user.id, subjectId) : undefined;

      const flat = plan.topics.flatMap((topic) =>
        topic.subtasks.map((subtask) => ({ topic: topic.topic, subtask }))
      );
      const perDay = Math.max(1, Math.ceil(flat.length / spreadDays));

      const createdIds: string[] = [];
      flat.forEach((entry, index) => {
        const dayOffset = Math.min(spreadDays - 1, Math.floor(index / perDay));
        const due = new Date();
        due.setDate(due.getDate() + dayOffset + 1);
        due.setHours(18, 0, 0, 0);

        const priority: TaskItem['priority'] =
          entry.subtask.kind === 'learn' || entry.subtask.kind === 'practice' ? 'high' : 'medium';

        const created = createTask(db, user.id, {
          title: `${entry.topic}: ${entry.subtask.title}`,
          subject_id: subject?.id ?? subjectId,
          subject_name: subject?.name ?? plan.subject_name,
          due_date: due.toISOString(),
          estimated_minutes: entry.subtask.minutes,
          priority,
          description: `From your notes${plan.subject_name ? ` (${plan.subject_name})` : ''}.`,
        });
        createdIds.push(created.id);
      });

      let goalId: string | null = null;
      if (body.create_goal) {
        const target =
          body.target_date && !Number.isNaN(new Date(body.target_date).getTime())
            ? body.target_date
            : new Date(Date.now() + 7 * 86_400_000).toISOString();
        const goal = createGoal(db, user.id, {
          title: `${subject?.name ?? plan.subject_name} — notes prep`,
          subject_id: subject?.id ?? subjectId,
          mode: 'FAST_PREP',
          target_date: target,
          priority: 'high',
          description: 'Generated from an uploaded notes document.',
        });
        goalId = goal.id;
      }

      return { created_tasks: createdIds.length, goal_id: goalId };
    });

    return json(result, 201);
  });
}
