import { json, requireUser, route } from '@/lib/server/http';
import { getProgressOverview } from '@/lib/server/planning';
import { listStudySessions, listTeams, listTeamMembers } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

export async function GET() {
  return route(async () => {
    const user = await requireUser();

    const result = await transact((db) => {
      const teams = listTeams(db, user.id);
      return {
        overview: getProgressOverview(db, user),
        study_sessions: listStudySessions(db, user.id),
        teams: teams.map((team) => {
          const members = listTeamMembers(db, team.id);
          const teamTasks = db.tasks.filter((t) => t.team_id === team.id);
          const done = teamTasks.filter((t) => t.status === 'done').length;
          return {
            team_id: team.id,
            name: team.name,
            goal: team.goal,
            member_count: members.length,
            task_count: teamTasks.length,
            completed_tasks: done,
            progress_pct: teamTasks.length ? Math.round((done / teamTasks.length) * 100) : 0,
          };
        }),
      };
    });

    return json(result);
  });
}
