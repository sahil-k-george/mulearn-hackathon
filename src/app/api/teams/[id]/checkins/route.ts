import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { assertTeamAccess, listTeamCheckIns, setTeamCheckIn } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { TeamCheckinStatus } from '@/lib/database.types';

type Params = { params: Promise<{ id: string }> };

const VALID: TeamCheckinStatus[] = ['making_progress', 'need_help', 'taking_break', 'almost_finished'];

export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const checkins = await transact((db) => {
      assertTeamAccess(db, user.id, id);
      return listTeamCheckIns(db, id);
    });
    return json({ checkins });
  });
}

export async function POST(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const body = await readBody<{ status?: TeamCheckinStatus; note?: string }>(request);
    if (!body.status || !VALID.includes(body.status)) {
      throw new HttpError('Choose a valid status.', 400);
    }

    const checkin = await transact((db) => {
      assertTeamAccess(db, user.id, id);
      return setTeamCheckIn(db, user.id, id, body.status as TeamCheckinStatus, body.note);
    });
    return json({ checkin }, 201);
  });
}
