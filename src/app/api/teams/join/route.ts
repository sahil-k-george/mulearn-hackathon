import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { getPreferences, joinTeam, joinTeamByCode } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{ code?: string; teamId?: string }>(request);

    if (!body.code?.trim() && !body.teamId) {
      throw new HttpError('Enter a team code or choose a team to join.', 400);
    }

    const result = await transact((db) => {
      const joined = body.code?.trim()
        ? joinTeamByCode(db, user.id, body.code)
        : joinTeam(db, user.id, body.teamId as string);
      const pref = getPreferences(db, user.id);
      pref.active_team_id = joined.team.id;
      return joined;
    });

    return json({
      team: result.team,
      already_member: result.alreadyMember,
      message: result.alreadyMember
        ? `You are already a member of ${result.team.name}.`
        : `Joined ${result.team.name}.`,
    });
  });
}
