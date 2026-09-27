import { json, requireUser, route } from '@/lib/server/http';
import { listNotifications, markAllNotifications } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const notifications = await transact((db) => listNotifications(db, user.id));
    return json({ notifications });
  });
}

export async function POST() {
  return route(async () => {
    const user = await requireUser();
    await transact((db) => {
      markAllNotifications(db, user.id);
    });
    return json({ success: true });
  });
}
