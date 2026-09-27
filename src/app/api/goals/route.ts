import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createGoal, listGoals } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { GoalItem } from '@/lib/domain';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const goals = await transact((db) => listGoals(db, user.id));
    return json({ goals });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      title?: string;
      subject_id?: string | null;
      mode?: GoalItem['mode'];
      target_date?: string;
      priority?: GoalItem['priority'];
      description?: string;
      available_minutes_per_day?: number;
    }>(request);

    if (!body.title?.trim()) throw new HttpError('A goal title is required.', 400);
    if (!body.target_date) throw new HttpError('A target date is required.', 400);
    if (Number.isNaN(new Date(body.target_date).getTime())) {
      throw new HttpError('The target date is not valid.', 400);
    }

    const goal = await transact((db) =>
      createGoal(db, user.id, {
        title: body.title as string,
        subject_id: body.subject_id ?? null,
        mode: body.mode === 'KEEP_UP' ? 'KEEP_UP' : 'FAST_PREP',
        target_date: body.target_date as string,
        priority: body.priority,
        description: body.description,
        available_minutes_per_day: body.available_minutes_per_day,
      })
    );
    return json({ goal }, 201);
  });
}
