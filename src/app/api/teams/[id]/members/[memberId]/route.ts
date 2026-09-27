import { json, requireUser, route } from '@/lib/server/http';
import { removeTeamMember } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

type Params = { params: Promise<{ id: string; memberId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id, memberId } = await params;
    await transact((db) => {
      removeTeamMember(db, user.id, id, memberId);
    });
    return json({ success: true });
  });
}
