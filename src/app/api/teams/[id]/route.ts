import { json, readBody, requireUser, route } from '@/lib/server/http';
import {
  assertTeamAccess,
  findTeam,
  leaveTeam,
  listActivities,
  listDiscussions,
  listTeamCheckIns,
  listTeamMembers,
  updateMemberKnowledge,
} from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import { buildTeamIntelligence } from '@/lib/engine/team';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;

    const detail = await transact((db) => {
      assertTeamAccess(db, user.id, id);
      const members = listTeamMembers(db, id);
      return {
        team: findTeam(db, id)!,
        members,
        tasks: db.tasks.filter((t) => t.team_id === id),
        discussions: listDiscussions(db, id),
        activities: listActivities(db, id),
        checkins: listTeamCheckIns(db, id),
        intelligence: buildTeamIntelligence(id, members),
      };
    });

    return json(detail);
  });
}

/** Update the caller's own knowledge map for a team. */
export async function PATCH(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const body = await readBody<{ topics?: { topic: string; score: number }[] }>(request);

    const result = await transact((db) => {
      assertTeamAccess(db, user.id, id);
      if (body.topics) updateMemberKnowledge(db, user.id, id, body.topics);
      const members = listTeamMembers(db, id);
      return { members, intelligence: buildTeamIntelligence(id, members) };
    });

    return json(result);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    await transact((db) => {
      leaveTeam(db, user.id, id);
    });
    return json({ success: true });
  });
}
