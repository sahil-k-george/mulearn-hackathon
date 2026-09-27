import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { readDb, transact } from '@/lib/server/store';
import { addPlanEvent, updatePreferences, updateTask } from '@/lib/server/repo';
import { assessWorkloadForUser, buildPlanForUser, getDashboardData } from '@/lib/server/planning';
import type { GoalMode, PlanEvent, WorkloadCheckIn } from '@/lib/domain';

export async function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const view = url.searchParams.get('view') ?? 'dashboard';
    const availableParam = url.searchParams.get('availableMinutes');
    const modeParam = url.searchParams.get('mode');
    const subjectParam = url.searchParams.get('subjectId');

    const overrides = {
      availableMinutes: availableParam ? Math.max(0, Number(availableParam)) : undefined,
      mode: modeParam === 'FAST_PREP' || modeParam === 'KEEP_UP' ? (modeParam as GoalMode) : undefined,
      subjectId: subjectParam === 'all' ? null : subjectParam ?? undefined,
    };

    const db = await readDb();

    if (view === 'plan') {
      const plan = buildPlanForUser(db, user, overrides);
      return json({ plan, workload: assessWorkloadForUser(db, user, plan) });
    }

    return json(getDashboardData(db, user, overrides));
  });
}

/** Record an adaptive-planning event and return the recalculated plan. */
export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      type?: PlanEvent['type'];
      task_id?: string | null;
      payload?: Record<string, unknown>;
    }>(request);

    const validTypes: PlanEvent['type'][] = [
      'TASK_COMPLETED',
      'TASK_SKIPPED',
      'TASK_EXTENDED',
      'TASK_SHORTENED',
      'DEADLINE_CHANGED',
      'TIME_AVAILABLE_CHANGED',
    ];
    if (!body.type || !validTypes.includes(body.type)) {
      throw new HttpError('Unknown plan event type.', 400);
    }

    const plan = await transact((db) => {
      const payload = body.payload ?? {};
      // Apply the concrete side effects of an event before re-planning.
      if (body.type === 'TIME_AVAILABLE_CHANGED') {
        const minutes = Number(payload.availableMinutes);
        if (Number.isFinite(minutes) && minutes >= 0) {
          updatePreferences(db, user.id, { available_minutes_per_day: Math.round(minutes) });
          const checkIn: WorkloadCheckIn = {
            id: `wc_${Date.now()}`,
            user_id: user.id,
            date: new Date().toISOString().slice(0, 10),
            level: 'manageable',
            available_minutes: Math.round(minutes),
            created_at: new Date().toISOString(),
          };
          db.workloadCheckIns.push(checkIn);
        }
      }
      if (body.type === 'DEADLINE_CHANGED' && body.task_id && typeof payload.deadline === 'string') {
        updateTask(db, user.id, body.task_id, { due_date: payload.deadline });
      }
      // Note: TASK_EXTENDED / TASK_SHORTENED are applied by the planner from the
      // event log (applyEventsToTasks). Do not also mutate estimated_minutes here
      // or the adjustment would be counted twice.
      if (body.type === 'TASK_SKIPPED' && body.task_id) {
        updateTask(db, user.id, body.task_id, { status: 'skipped' });
      }

      addPlanEvent(db, user.id, { type: body.type as PlanEvent['type'], task_id: body.task_id ?? null, payload });

      const nextPlan = buildPlanForUser(db, user);
      return nextPlan;
    });

    const db = await readDb();
    return json({ plan, workload: assessWorkloadForUser(db, user, plan) });
  });
}

/** Update planning preferences (available time, mode, focus subject, team). */
export async function PATCH(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      available_minutes_per_day?: number;
      mode?: GoalMode;
      subject_id?: string | null;
      active_team_id?: string | null;
    }>(request);

    const preferences = await transact((db) => {
      return updatePreferences(db, user.id, {
        available_minutes_per_day:
          body.available_minutes_per_day !== undefined
            ? Math.max(0, Math.round(body.available_minutes_per_day))
            : undefined,
        mode: body.mode === 'KEEP_UP' ? 'KEEP_UP' : body.mode === 'FAST_PREP' ? 'FAST_PREP' : undefined,
        subject_id: body.subject_id !== undefined ? body.subject_id : undefined,
        active_team_id: body.active_team_id !== undefined ? body.active_team_id : undefined,
      });
    });

    const db = await readDb();
    return json({ preferences, plan: buildPlanForUser(db, user) });
  });
}
