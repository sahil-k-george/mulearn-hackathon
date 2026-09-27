import { json, readBody, requireUser, route } from '@/lib/server/http';
import { updateUser } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { UserProfile } from '@/lib/database.types';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return json({ user });
  });
}

export async function PATCH(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const patch = await readBody<Partial<UserProfile>>(request);
    const updated = await transact((db) => updateUser(db, user.id, patch));
    return json({ user: updated });
  });
}
