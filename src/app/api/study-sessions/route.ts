import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createStudySession, listStudySessions } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { StudySessionItem } from '@/lib/domain';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const sessions = await transact((db) => listStudySessions(db, user.id));
    return json({ sessions });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      title?: string;
      task_id?: string | null;
      plan_item_id?: string | null;
      subject_name?: string;
      duration_minutes?: number;
      actual_minutes?: number | null;
      status?: StudySessionItem['status'];
    }>(request);

    if (!body.title?.trim()) throw new HttpError('A session title is required.', 400);
    if (!body.duration_minutes || body.duration_minutes <= 0) {
      throw new HttpError('A duration in minutes is required.', 400);
    }

    const session = await transact((db) =>
      createStudySession(db, user.id, {
        title: body.title as string,
        task_id: body.task_id ?? null,
        plan_item_id: body.plan_item_id ?? null,
        subject_name: body.subject_name,
        duration_minutes: body.duration_minutes as number,
        actual_minutes: body.actual_minutes ?? null,
        status: body.status,
      })
    );
    return json({ session }, 201);
  });
}
