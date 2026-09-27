'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  UserProfile,
  SubjectItem,
  TaskItem,
  MilestoneItem,
  TeamItem,
  TeamMemberItem,
  DiscussionMessage,
  TeamActivityItem,
  ResourceItem,
  NotificationItem,
  WellbeingMood,
  BreakActivity,
  SupportResource,
  TeamCheckinItem,
  TeamCheckinStatus,
} from './database.types';
import {
  GoalItem,
  PlanEvent,
  PlanResult,
  WorkloadAssessment,
  WorkloadLevel,
  BrainDumpExtraction,
  BrainDumpTask,
  BrainDumpGoal,
  BrainDumpCollaboration,
  PlanPreferences,
  AISettingsPublic,
  AIProviderKey,
  NoteSummary,
  NotesPrepPlan,
} from './domain';
import {
  CreateTeamPayload,
  CreateTaskPayload,
  SendDiscussionPayload,
  UploadResourcePayload,
  UpdateProfilePayload,
  ProgressOverviewData,
} from './api';
import { INITIAL_BREAK_ACTIVITIES, INITIAL_SUPPORT_RESOURCES } from './mockData';

export type AuthState = 'loading' | 'authenticated' | 'anonymous';

export type AIStatus = {
  configured: AIProviderKey;
  active: AIProviderKey | 'none';
  source: 'user' | 'env' | 'demo' | 'none';
  model: string;
  mock_fallback: boolean;
  requires_key: boolean;
  demo_mode: boolean;
  message: string;
};

export type StoreInfo = { active: 'file' | 'supabase'; supabase_configured: boolean };

export type CommitBrainDumpPayload = {
  tasks?: BrainDumpTask[];
  goals?: BrainDumpGoal[];
  knowledge_gaps?: BrainDumpExtraction['knowledge_gaps'];
  collaboration?: BrainDumpCollaboration[];
  available_minutes?: number | null;
  mode?: 'FAST_PREP' | 'KEEP_UP';
};

type JoinResult = { success: boolean; message: string; team?: TeamItem };

interface AppContextType {
  isLoaded: boolean;
  authState: AuthState;
  user: UserProfile;
  preferences: PlanPreferences | null;

  // Auth
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ message: string; reset_token: string | null }>;
  resetPassword: (token: string, password: string) => Promise<string>;

  // Data
  subjects: SubjectItem[];
  goals: GoalItem[];
  tasks: TaskItem[];
  milestones: MilestoneItem[];
  teams: TeamItem[];
  teamMembers: TeamMemberItem[];
  discussions: DiscussionMessage[];
  activities: TeamActivityItem[];
  resources: ResourceItem[];
  notifications: NotificationItem[];
  teamCheckins: TeamCheckinItem[];
  breakActivities: BreakActivity[];
  supportResources: SupportResource[];
  progressOverview: ProgressOverviewData;
  plan: PlanResult | null;
  workload: WorkloadAssessment | null;
  aiStatus: AIStatus | null;
  aiSettings: AISettingsPublic | null;
  demoMode: boolean;
  notes: NoteSummary[];
  storeInfo: StoreInfo | null;

  activeTeamId: string;
  setActiveTeamId: (teamId: string) => void;

  // Profile / subjects / goals / tasks
  updateUser: (data: UpdateProfilePayload) => Promise<void>;
  addSubject: (input: {
    name: string;
    current_topic?: string;
    knowledge_level?: number;
    category?: string;
  }) => Promise<SubjectItem>;
  updateSubject: (id: string, patch: Partial<SubjectItem>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  addGoal: (input: {
    title: string;
    subject_id?: string | null;
    mode: 'FAST_PREP' | 'KEEP_UP';
    target_date: string;
    priority?: GoalItem['priority'];
    description?: string;
  }) => Promise<GoalItem>;
  updateGoal: (id: string, patch: Partial<GoalItem>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<TaskItem>;
  updateTaskStatus: (taskId: string, status: TaskItem['status'], actualMinutes?: number) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Planning
  updatePreferences: (patch: Partial<PlanPreferences>) => Promise<void>;
  recordPlanEvent: (input: {
    type: PlanEvent['type'];
    task_id?: string | null;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
  extractBrainDump: (text: string) => Promise<BrainDumpExtraction>;
  commitBrainDump: (payload: CommitBrainDumpPayload) => Promise<{
    created_tasks: number;
    created_goals: number;
    created_subjects: number;
    suggested_team: { name: string; members: string[]; activity: string } | null;
  }>;
  logStudySession: (input: {
    title: string;
    task_id?: string | null;
    subject_name?: string;
    duration_minutes: number;
    actual_minutes?: number | null;
    status?: 'planned' | 'in_progress' | 'completed' | 'skipped';
  }) => Promise<void>;
  checkInWorkload: (level: WorkloadLevel, availableMinutes?: number | null) => Promise<void>;

  // AI settings & notes
  saveAISettings: (input: {
    provider: AIProviderKey;
    api_key?: string;
    model?: string;
    clear_key?: boolean;
  }) => Promise<void>;
  uploadNotes: (input: {
    file?: File;
    text?: string;
    subjectId?: string | null;
    title?: string;
    generate?: boolean;
  }) => Promise<{ note: NoteSummary; plan: NotesPrepPlan | null }>;
  commitNotesPlan: (input: {
    plan: NotesPrepPlan;
    subject_id?: string | null;
    note_id?: string | null;
    create_goal?: boolean;
    target_date?: string;
    spread_days?: number;
  }) => Promise<{ created_tasks: number; goal_id: string | null }>;
  deleteNote: (noteId: string) => Promise<void>;

  // Teams
  createTeam: (payload: CreateTeamPayload) => Promise<TeamItem>;
  joinTeamByCode: (code: string) => Promise<JoinResult>;
  joinDiscoverableTeam: (teamId: string) => Promise<{ success: boolean; message: string }>;
  leaveTeam: (teamId: string) => Promise<void>;
  removeTeamMember: (teamId: string, memberId: string) => Promise<void>;
  sendDiscussionMessage: (payload: SendDiscussionPayload) => Promise<void>;
  uploadResource: (payload: UploadResourcePayload) => Promise<void>;
  deleteResource: (resourceId: string) => Promise<void>;

  // Notifications / wellbeing
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  wellbeingMood: WellbeingMood | null;
  setWellbeingMood: (mood: WellbeingMood) => void;
  setTeamCheckin: (teamId: string, status: TeamCheckinStatus, note?: string) => Promise<void>;

  refresh: () => Promise<void>;
}

const PLACEHOLDER_USER: UserProfile = {
  id: '',
  name: 'Student',
  email: '',
  avatar_url: '',
  bio: '',
  institution: '',
  course: '',
  academic_year: '',
  location: '',
  timezone: 'UTC',
  skills: [],
  interests: [],
  streak_days: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const EMPTY_PROGRESS: ProgressOverviewData = {
  overallProgressPercentage: 0,
  completedTasksCount: 0,
  totalTasksCount: 0,
  activeTasksCount: 0,
  upcomingDeadlinesCount: 0,
  currentStreakDays: 0,
  deepStudyTimeHours: 0,
  deepStudyTimeMinutes: 0,
  subjectBreakdown: [],
  milestones: [],
  recentActivities: [],
};

const AppContext = createContext<AppContextType | null>(null);

async function apiForm<T>(url: string, form: FormData): Promise<T> {
  const response = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Upload failed.');
  }
  return data as T;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Something went wrong.');
  }
  return data as T;
}

const WELLBEING_TO_LEVEL: Record<WellbeingMood, WorkloadLevel> = {
  calm: 'comfortable',
  okay: 'manageable',
  tired: 'manageable',
  overwhelmed: 'overloaded',
  stressed: 'overloaded',
  need_break: 'heavy',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [isLoaded, setIsLoaded] = useState(false);

  const [user, setUser] = useState<UserProfile>(PLACEHOLDER_USER);
  const [preferences, setPreferences] = useState<PlanPreferences | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionMessage[]>([]);
  const [activities, setActivities] = useState<TeamActivityItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [teamCheckins, setTeamCheckins] = useState<TeamCheckinItem[]>([]);
  const [progressOverview, setProgressOverview] = useState<ProgressOverviewData>(EMPTY_PROGRESS);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [workload, setWorkload] = useState<WorkloadAssessment | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettingsPublic | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [wellbeingMood, setWellbeingMoodState] = useState<WellbeingMood | null>(null);
  const [activeTeamOverride, setActiveTeamOverride] = useState<string | null>(null);

  const [breakActivities] = useState<BreakActivity[]>(INITIAL_BREAK_ACTIVITIES);
  const [supportResources] = useState<SupportResource[]>(INITIAL_SUPPORT_RESOURCES);

  const applyBootstrap = useCallback((data: Record<string, unknown>) => {
    setUser(data.user as UserProfile);
    setPreferences((data.preferences as PlanPreferences) ?? null);
    setSubjects((data.subjects as SubjectItem[]) ?? []);
    setGoals((data.goals as GoalItem[]) ?? []);
    setTasks((data.tasks as TaskItem[]) ?? []);
    setMilestones((data.milestones as MilestoneItem[]) ?? []);
    setTeams((data.teams as TeamItem[]) ?? []);
    setTeamMembers((data.teamMembers as TeamMemberItem[]) ?? []);
    setDiscussions((data.discussions as DiscussionMessage[]) ?? []);
    setActivities((data.activities as TeamActivityItem[]) ?? []);
    setResources((data.resources as ResourceItem[]) ?? []);
    setNotifications((data.notifications as NotificationItem[]) ?? []);
    setTeamCheckins((data.teamCheckIns as TeamCheckinItem[]) ?? []);
    setProgressOverview((data.progress as ProgressOverviewData) ?? EMPTY_PROGRESS);
    setPlan((data.plan as PlanResult) ?? null);
    setWorkload((data.workload as WorkloadAssessment) ?? null);
    setAiStatus((data.ai as AIStatus) ?? null);
    setAiSettings((data.ai_settings as AISettingsPublic) ?? null);
    setDemoMode(Boolean(data.demo_mode));
    setNotes((data.notes as NoteSummary[]) ?? []);
    setStoreInfo((data.store as StoreInfo) ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/bootstrap');
      applyBootstrap(data);
      setAuthState('authenticated');
    } catch (error) {
      if (error instanceof Error && /signed in|expired/i.test(error.message)) {
        setAuthState('anonymous');
      } else {
        console.error('[store] bootstrap failed:', error);
        setAuthState('anonymous');
      }
    } finally {
      setIsLoaded(true);
    }
  }, [applyBootstrap]);

  useEffect(() => {
    // Subscribe to the server data source on mount. State updates happen
    // asynchronously once the request resolves, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>): Promise<void> => {
      await fn();
      await refresh();
    },
    [refresh]
  );

  // --- Auth ---------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string) => {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await refresh();
    },
    [refresh]
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthState('anonymous');
    setUser(PLACEHOLDER_USER);
    setPreferences(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    return apiFetch<{ message: string; reset_token: string | null }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    const result = await apiFetch<{ message: string }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ token, password }),
    });
    return result.message;
  }, []);

  // --- Profile / subjects / goals / tasks ---------------------------------
  const updateUser = useCallback(
    (data: UpdateProfilePayload) =>
      run(async () => {
        await apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify(data) });
      }),
    [run]
  );

  const addSubject = useCallback(
    async (input: {
      name: string;
      current_topic?: string;
      knowledge_level?: number;
      category?: string;
    }) => {
      const result = await apiFetch<{ subject: SubjectItem }>('/api/subjects', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await refresh();
      return result.subject;
    },
    [refresh]
  );

  const updateSubject = useCallback(
    (id: string, patch: Partial<SubjectItem>) =>
      run(async () => {
        await apiFetch(`/api/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      }),
    [run]
  );

  const deleteSubject = useCallback(
    (id: string) =>
      run(async () => {
        await apiFetch(`/api/subjects/${id}`, { method: 'DELETE' });
      }),
    [run]
  );

  const addGoal = useCallback(
    async (input: {
      title: string;
      subject_id?: string | null;
      mode: 'FAST_PREP' | 'KEEP_UP';
      target_date: string;
      priority?: GoalItem['priority'];
      description?: string;
    }) => {
      const result = await apiFetch<{ goal: GoalItem }>('/api/goals', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await refresh();
      return result.goal;
    },
    [refresh]
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<GoalItem>) =>
      run(async () => {
        await apiFetch(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      }),
    [run]
  );

  const deleteGoal = useCallback(
    (id: string) =>
      run(async () => {
        await apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
      }),
    [run]
  );

  const createTask = useCallback(
    async (payload: CreateTaskPayload) => {
      const result = await apiFetch<{ task: TaskItem }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          subject_name: payload.subjectName,
          description: payload.description,
          due_date: payload.dueDate,
          estimated_minutes: payload.estimatedMinutes,
          priority: payload.priority,
          team_id: payload.teamId ?? null,
        }),
      });
      await refresh();
      return result.task;
    },
    [refresh]
  );

  const updateTaskStatus = useCallback(
    (taskId: string, status: TaskItem['status'], actualMinutes?: number) =>
      run(async () => {
        await apiFetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status, actual_minutes: actualMinutes }),
        });
      }),
    [run]
  );

  const deleteTask = useCallback(
    (taskId: string) =>
      run(async () => {
        await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      }),
    [run]
  );

  // --- Planning -----------------------------------------------------------
  const updatePreferences = useCallback(
    (patch: Partial<PlanPreferences>) =>
      run(async () => {
        await apiFetch('/api/plan', { method: 'PATCH', body: JSON.stringify(patch) });
      }),
    [run]
  );

  const recordPlanEvent = useCallback(
    (input: { type: PlanEvent['type']; task_id?: string | null; payload?: Record<string, unknown> }) =>
      run(async () => {
        await apiFetch('/api/plan', { method: 'POST', body: JSON.stringify(input) });
      }),
    [run]
  );

  const extractBrainDump = useCallback(async (text: string) => {
    const result = await apiFetch<{ extraction: BrainDumpExtraction }>('/api/braindump', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return result.extraction;
  }, []);

  const commitBrainDump = useCallback(
    async (payload: CommitBrainDumpPayload) => {
      const result = await apiFetch<{
        created_tasks: number;
        created_goals: number;
        created_subjects: number;
        suggested_team: { name: string; members: string[]; activity: string } | null;
      }>('/api/braindump', { method: 'PUT', body: JSON.stringify(payload) });
      await refresh();
      return result;
    },
    [refresh]
  );

  const logStudySession = useCallback(
    (input: {
      title: string;
      task_id?: string | null;
      subject_name?: string;
      duration_minutes: number;
      actual_minutes?: number | null;
      status?: 'planned' | 'in_progress' | 'completed' | 'skipped';
    }) =>
      run(async () => {
        await apiFetch('/api/study-sessions', { method: 'POST', body: JSON.stringify(input) });
      }),
    [run]
  );

  const checkInWorkload = useCallback(
    (level: WorkloadLevel, availableMinutes?: number | null) =>
      run(async () => {
        await apiFetch('/api/wellbeing', {
          method: 'POST',
          body: JSON.stringify({ level, available_minutes: availableMinutes ?? null }),
        });
      }),
    [run]
  );

  // --- Teams --------------------------------------------------------------
  const createTeam = useCallback(
    async (payload: CreateTeamPayload) => {
      const result = await apiFetch<{ team: TeamItem }>('/api/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          goal: payload.goal,
          category: payload.projectTopic || payload.category,
          max_members: payload.maxMembers,
          tags: payload.tags,
          visibility: payload.visibility,
        }),
      });
      await refresh();
      return result.team;
    },
    [refresh]
  );

  const joinTeamByCode = useCallback(
    async (code: string): Promise<JoinResult> => {
      try {
        const result = await apiFetch<{ team: TeamItem; already_member: boolean; message: string }>(
          '/api/teams/join',
          { method: 'POST', body: JSON.stringify({ code }) }
        );
        await refresh();
        return { success: true, message: result.message, team: result.team };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Could not join.' };
      }
    },
    [refresh]
  );

  const joinDiscoverableTeam = useCallback(
    async (teamId: string): Promise<{ success: boolean; message: string }> => {
      try {
        const result = await apiFetch<{ message: string }>('/api/teams/join', {
          method: 'POST',
          body: JSON.stringify({ teamId }),
        });
        await refresh();
        return { success: true, message: result.message };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Could not join.' };
      }
    },
    [refresh]
  );

  const leaveTeam = useCallback(
    (teamId: string) =>
      run(async () => {
        await apiFetch(`/api/teams/${teamId}`, { method: 'DELETE' });
      }),
    [run]
  );

  const removeTeamMember = useCallback(
    (teamId: string, memberId: string) =>
      run(async () => {
        await apiFetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' });
      }),
    [run]
  );

  const sendDiscussionMessage = useCallback(
    (payload: SendDiscussionPayload) =>
      run(async () => {
        await apiFetch(`/api/teams/${payload.teamId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: payload.content }),
        });
      }),
    [run]
  );

  const uploadResource = useCallback(
    (payload: UploadResourcePayload) =>
      run(async () => {
        await apiFetch('/api/resources', {
          method: 'POST',
          body: JSON.stringify({
            title: payload.title,
            url: payload.url || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: payload.fileType,
            category: payload.category,
            team_id: payload.teamId ?? null,
            folder: payload.folder,
            file_name: payload.fileName,
            file_size_bytes: payload.fileSizeBytes,
          }),
        });
      }),
    [run]
  );

  const deleteResource = useCallback(
    (resourceId: string) =>
      run(async () => {
        await apiFetch(`/api/resources/${resourceId}`, { method: 'DELETE' });
      }),
    [run]
  );

  // --- Notifications / wellbeing -----------------------------------------
  const markNotificationAsRead = useCallback(
    (id: string) =>
      run(async () => {
        await apiFetch(`/api/notifications/${id}`, { method: 'PATCH' });
      }),
    [run]
  );

  const markAllNotificationsAsRead = useCallback(
    () =>
      run(async () => {
        await apiFetch('/api/notifications', { method: 'POST' });
      }),
    [run]
  );

  const setWellbeingMood = useCallback(
    (mood: WellbeingMood) => {
      setWellbeingMoodState(mood);
      void checkInWorkload(WELLBEING_TO_LEVEL[mood]);
    },
    [checkInWorkload]
  );

  const setTeamCheckin = useCallback(
    (teamId: string, status: TeamCheckinStatus, note?: string) =>
      run(async () => {
        await apiFetch(`/api/teams/${teamId}/checkins`, {
          method: 'POST',
          body: JSON.stringify({ status, note }),
        });
      }),
    [run]
  );

  // --- AI settings & notes ------------------------------------------------
  const saveAISettings = useCallback(
    async (input: { provider: AIProviderKey; api_key?: string; model?: string; clear_key?: boolean }) => {
      await apiFetch('/api/settings/ai', { method: 'PATCH', body: JSON.stringify(input) });
      await refresh();
    },
    [refresh]
  );

  const uploadNotes = useCallback(
    async (input: {
      file?: File;
      text?: string;
      subjectId?: string | null;
      title?: string;
      generate?: boolean;
    }) => {
      if (input.file) {
        const form = new FormData();
        form.append('file', input.file);
        if (input.subjectId) form.append('subject_id', input.subjectId);
        if (input.title) form.append('title', input.title);
        form.append('generate', input.generate === false ? 'false' : 'true');
        const result = await apiForm<{ note: NoteSummary; plan: NotesPrepPlan | null }>(
          '/api/notes',
          form
        );
        await refresh();
        return result;
      }
      const result = await apiFetch<{ note: NoteSummary; plan: NotesPrepPlan | null }>(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            text: input.text,
            subject_id: input.subjectId ?? null,
            title: input.title,
            generate: input.generate !== false,
          }),
        }
      );
      await refresh();
      return result;
    },
    [refresh]
  );

  const commitNotesPlan = useCallback(
    async (input: {
      plan: NotesPrepPlan;
      subject_id?: string | null;
      note_id?: string | null;
      create_goal?: boolean;
      target_date?: string;
      spread_days?: number;
    }) => {
      const result = await apiFetch<{ created_tasks: number; goal_id: string | null }>(
        '/api/notes/commit',
        { method: 'POST', body: JSON.stringify(input) }
      );
      await refresh();
      return result;
    },
    [refresh]
  );

  const deleteNote = useCallback(
    (noteId: string) =>
      run(async () => {
        await apiFetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      }),
    [run]
  );

  const setActiveTeamId = useCallback(
    (teamId: string) => {
      setActiveTeamOverride(teamId);
      void apiFetch('/api/plan', {
        method: 'PATCH',
        body: JSON.stringify({ active_team_id: teamId }),
      }).catch(() => undefined);
    },
    []
  );

  const activeTeamId = useMemo(() => {
    if (activeTeamOverride) return activeTeamOverride;
    return preferences?.active_team_id ?? '';
  }, [activeTeamOverride, preferences]);

  const value: AppContextType = {
    isLoaded,
    authState,
    user,
    preferences,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    resetPassword,
    subjects,
    goals,
    tasks,
    milestones,
    teams,
    teamMembers,
    discussions,
    activities,
    resources,
    notifications,
    teamCheckins,
    breakActivities,
    supportResources,
    progressOverview,
    plan,
    workload,
    aiStatus,
    aiSettings,
    demoMode,
    notes,
    storeInfo,
    activeTeamId,
    setActiveTeamId,
    updateUser,
    addSubject,
    updateSubject,
    deleteSubject,
    addGoal,
    updateGoal,
    deleteGoal,
    createTask,
    updateTaskStatus,
    deleteTask,
    updatePreferences,
    recordPlanEvent,
    extractBrainDump,
    commitBrainDump,
    logStudySession,
    checkInWorkload,
    saveAISettings,
    uploadNotes,
    commitNotesPlan,
    deleteNote,
    createTeam,
    joinTeamByCode,
    joinDiscoverableTeam,
    leaveTeam,
    removeTeamMember,
    sendDiscussionMessage,
    uploadResource,
    deleteResource,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    wellbeingMood,
    setWellbeingMood,
    setTeamCheckin,
    refresh,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
