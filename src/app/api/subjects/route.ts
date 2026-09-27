import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createSubject, listSubjects } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const subjects = await transact((db) => listSubjects(db, user.id));
    return json({ subjects });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      name?: string;
      current_topic?: string;
      knowledge_level?: number;
      category?: string;
      color?: string;
    }>(request);
    if (!body.name?.trim()) throw new HttpError('A subject name is required.', 400);

    const subject = await transact((db) =>
      createSubject(db, user.id, {
        name: body.name as string,
        current_topic: body.current_topic,
        knowledge_level: body.knowledge_level,
        category: body.category,
        color: body.color,
      })
    );
    return json({ subject }, 201);
  });
}
