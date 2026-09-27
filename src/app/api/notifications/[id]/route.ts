import { json, requireUser, route } from '@/lib/server/http';
import { markNotification } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    await transact((db) => {
      markNotification(db, user.id, id);
    });
    return json({ success: true });
  });
}
