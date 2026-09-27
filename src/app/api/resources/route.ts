import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createResource, listResources } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';
import type { ResourceItem } from '@/lib/database.types';

export async function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const teamParam = url.searchParams.get('teamId');
    const category = url.searchParams.get('category') ?? undefined;
    const search = url.searchParams.get('search') ?? undefined;

    const resources = await transact((db) =>
      listResources(db, user.id, {
        teamId: teamParam === null ? undefined : teamParam === '' ? null : teamParam,
        category: category ?? undefined,
        search,
      })
    );
    return json({ resources });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      title?: string;
      url?: string;
      type?: ResourceItem['file_type'];
      category?: ResourceItem['category'];
      team_id?: string | null;
      folder?: string;
      file_name?: string;
      file_size_bytes?: number;
    }>(request);

    if (!body.title?.trim()) throw new HttpError('A resource title is required.', 400);
    if (!body.url?.trim()) throw new HttpError('A URL is required.', 400);

    const resource = await transact((db) =>
      createResource(db, user.id, {
        title: body.title as string,
        url: body.url as string,
        type: body.type,
        category: body.category,
        team_id: body.team_id ?? null,
        folder: body.folder,
        file_name: body.file_name,
        file_size_bytes: body.file_size_bytes,
      })
    );
    return json({ resource }, 201);
  });
}
