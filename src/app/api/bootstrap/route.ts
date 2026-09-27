import { json, requireUser, route } from '@/lib/server/http';
import { readDb } from '@/lib/server/store';
import {
  getPreferences,
  listActivities,
  listDiscussions,
  listDiscoverableTeams,
  listGoals,
  listMilestones,
  listNotifications,
  listResources,
  listSubjects,
  listTasks,
  listNotes,
  listTeamCheckIns,
  listTeams,
  toPublicAISettings,
  getAISettings,
} from '@/lib/server/repo';
import { assessWorkloadForUser, buildPlanForUser, getProgressOverview } from '@/lib/server/planning';
import { resolveAIForUser, isDemo } from '@/lib/server/ai';
import { getActiveStoreName, isEphemeralStore, isSupabaseConfigured } from '@/lib/server/store';

/**
 * One round trip for the whole client store (plan section 13: "what to do now",
 * not analytics overload). Mutations call their own endpoint and re-bootstrap.
 */
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const db = await readDb();

    const myTeams = listTeams(db, user.id);
    const myTeamIds = new Set(myTeams.map((t) => t.id));
    const discoverable = listDiscoverableTeams(db, user.id);
    const plan = buildPlanForUser(db, user);
    const { status } = resolveAIForUser(db, user);

    return json({
      user,
      preferences: getPreferences(db, user.id),
      subjects: listSubjects(db, user.id),
      goals: listGoals(db, user.id),
      tasks: listTasks(db, user.id),
      teams: [...myTeams, ...discoverable],
      my_team_ids: [...myTeamIds],
      teamMembers: db.teamMembers.filter((m) => myTeamIds.has(m.team_id)),
      discussions: myTeams.flatMap((t) => listDiscussions(db, t.id)),
      activities: myTeams.flatMap((t) => listActivities(db, t.id)),
      resources: listResources(db, user.id),
      notifications: listNotifications(db, user.id),
      milestones: listMilestones(db, user.id),
      teamCheckIns: myTeams.flatMap((t) => listTeamCheckIns(db, t.id)),
      plan,
      workload: assessWorkloadForUser(db, user, plan),
      progress: getProgressOverview(db, user),
      notes: listNotes(db, user.id).map((n) => ({
        id: n.id,
        subject_id: n.subject_id,
        subject_name: n.subject_name,
        title: n.title,
        file_name: n.file_name,
        page_count: n.page_count,
        char_count: n.char_count,
        preview: n.text.slice(0, 240),
        created_at: n.created_at,
      })),
      ai: status,
      ai_settings: toPublicAISettings(getAISettings(db, user.id)),
      demo_mode: isDemo(db, user),
      store: {
        active: getActiveStoreName(),
        supabase_configured: isSupabaseConfigured(),
        ephemeral: isEphemeralStore(),
      },
    });
  });
}
