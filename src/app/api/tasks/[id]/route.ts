import { json, readBody, requireUser, route } from '@/lib/server/http';
import { addPlanEvent, deleteTask, updateTask } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { TaskItem } from '@/lib/database.types';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const patch = await readBody<Partial<TaskItem> & { actual_minutes?: number }>(request);

    const task = await transact((db) => {
      const updated = updateTask(db, user.id, id, patch);
      // Adaptive planning: completion / skip becomes an event the planner reads.
      if (patch.status === 'done') {
        addPlanEvent(db, user.id, {
          type: 'TASK_COMPLETED',
          task_id: id,
          payload: { actualMinutes: patch.actual_minutes ?? updated.estimated_minutes },
        });
        if (patch.actual_minutes && patch.actual_minutes !== updated.estimated_minutes) {
          if (patch.actual_minutes > updated.estimated_minutes) {
            addPlanEvent(db, user.id, {
              type: 'TASK_EXTENDED',
              task_id: id,
              payload: { extraMinutes: patch.actual_minutes - updated.estimated_minutes },
            });
          } else {
            addPlanEvent(db, user.id, {
              type: 'TASK_SHORTENED',
              task_id: id,
              payload: { extraMinutes: updated.estimated_minutes - patch.actual_minutes },
            });
          }
        }
      } else if (patch.status === ('skipped' as TaskItem['status'])) {
        addPlanEvent(db, user.id, { type: 'TASK_SKIPPED', task_id: id, payload: {} });
      }
      return updated;
    });

    return json({ task });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    await transact((db) => {
      deleteTask(db, user.id, id);
    });
    return json({ success: true });
  });
}
