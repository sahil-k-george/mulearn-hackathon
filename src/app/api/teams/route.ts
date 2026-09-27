import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createTeam, listDiscoverableTeams, listTeams, getPreferences } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

export async function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const discover = url.searchParams.get('discover');
    const q = url.searchParams.get('q') ?? undefined;

    const result = await transact((db) => ({
      teams: listTeams(db, user.id),
      discoverable: discover ? listDiscoverableTeams(db, user.id, q) : [],
      active_team_id: getPreferences(db, user.id).active_team_id,
    }));

    return json(result);
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      name?: string;
      subject?: string;
      goal?: string;
      target_date?: string;
      description?: string;
      category?: string;
      max_members?: number;
      tags?: string[];
      visibility?: 'private' | 'invite_only' | 'discoverable';
    }>(request);

    if (!body.name?.trim()) throw new HttpError('A team name is required.', 400);
    if (!body.goal?.trim()) throw new HttpError('A shared goal is required.', 400);

    const team = await transact((db) => {
      const created = createTeam(db, user.id, {
        name: body.name as string,
        subject: body.subject,
        goal: body.goal as string,
        target_date: body.target_date,
        description: body.description,
        category: body.category,
        max_members: body.max_members,
        tags: body.tags,
        visibility: body.visibility,
      });
      const pref = getPreferences(db, user.id);
      pref.active_team_id = created.id;
      return created;
    });

    return json({ team }, 201);
  });
}
