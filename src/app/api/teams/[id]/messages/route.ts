import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { assertTeamAccess, listDiscussions, sendDiscussion } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const messages = await transact((db) => {
      assertTeamAccess(db, user.id, id);
      return listDiscussions(db, id);
    });
    return json({ messages });
  });
}

export async function POST(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const body = await readBody<{ content?: string }>(request);
    const content = body.content?.trim() ?? '';
    if (!content) throw new HttpError('A message cannot be empty.', 400);

    const message = await transact((db) => {
      assertTeamAccess(db, user.id, id);
      return sendDiscussion(db, user.id, id, content);
    });
    return json({ message }, 201);
  });
}
