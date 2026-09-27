import { json, readBody, requireUser, route } from '@/lib/server/http';
import { deleteSubject, updateSubject } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { SubjectItem } from '@/lib/database.types';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const patch = await readBody<Partial<SubjectItem>>(request);
    const subject = await transact((db) => updateSubject(db, user.id, id, patch));
    return json({ subject });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    await transact((db) => {
      deleteSubject(db, user.id, id);
    });
    return json({ success: true });
  });
}
