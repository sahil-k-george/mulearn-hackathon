import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createTask, listTasks } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { TaskItem } from '@/lib/database.types';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const tasks = await transact((db) => listTasks(db, user.id));
    return json({ tasks });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      title?: string;
      subject_id?: string | null;
      subject_name?: string;
      description?: string;
      due_date?: string;
      estimated_minutes?: number;
      priority?: TaskItem['priority'];
      team_id?: string | null;
    }>(request);

    if (!body.title?.trim()) throw new HttpError('A task title is required.', 400);
    if (!body.due_date || Number.isNaN(new Date(body.due_date).getTime())) {
      throw new HttpError('A valid due date is required.', 400);
    }

    const task = await transact((db) =>
      createTask(db, user.id, {
        title: body.title as string,
        subject_id: body.subject_id ?? null,
        subject_name: body.subject_name,
        description: body.description,
        due_date: body.due_date as string,
        estimated_minutes: body.estimated_minutes,
        priority: body.priority,
        team_id: body.team_id ?? null,
      })
    );
    return json({ task }, 201);
  });
}
