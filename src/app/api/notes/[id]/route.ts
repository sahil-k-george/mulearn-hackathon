import { json, requireUser, route } from '@/lib/server/http';
import { deleteNote } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    await transact((db) => {
      deleteNote(db, user.id, id);
    });
    return json({ success: true });
  });
}
