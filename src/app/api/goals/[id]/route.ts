import { json, readBody, requireUser, route } from '@/lib/server/http';
import { deleteGoal, updateGoal } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { GoalItem } from '@/lib/domain';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const patch = await readBody<Partial<GoalItem>>(request);
    const goal = await transact((db) => updateGoal(db, user.id, id, patch));
    return json({ goal });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    await transact((db) => {
      deleteGoal(db, user.id, id);
    });
    return json({ success: true });
  });
}
