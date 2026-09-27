import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { addWorkloadCheckIn, updatePreferences } from '@/lib/server/repo';
import { buildPlanForUser, assessWorkloadForUser } from '@/lib/server/planning';
import { transact, readDb } from '@/lib/server/store';
import type { WorkloadLevel } from '@/lib/domain';

const LEVELS: WorkloadLevel[] = ['comfortable', 'manageable', 'heavy', 'overloaded'];

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      level?: WorkloadLevel;
      available_minutes?: number | null;
    }>(request);

    if (!body.level || !LEVELS.includes(body.level)) {
      throw new HttpError('Choose how today feels from the options provided.', 400);
    }

    const checkIn = await transact((db) => {
      const record = addWorkloadCheckIn(db, user.id, {
        level: body.level as WorkloadLevel,
        available_minutes: body.available_minutes ?? null,
      });
      if (body.available_minutes && body.available_minutes > 0) {
        updatePreferences(db, user.id, { available_minutes_per_day: Math.round(body.available_minutes) });
      }
      return record;
    });

    const db = await readDb();
    const plan = buildPlanForUser(db, user);
    return json({ check_in: checkIn, plan, workload: assessWorkloadForUser(db, user, plan) });
  });
}
