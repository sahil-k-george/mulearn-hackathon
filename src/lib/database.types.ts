export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          avatar_url: string;
          bio: string;
          institution: string;
          course: string;
          academic_year: string;
          location: string;
          timezone: string;
          skills: string[];
          interests: string[];
          streak_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          avatar_url?: string;
          bio?: string;
          institution?: string;
          course?: string;
          academic_year?: string;
          location?: string;
          timezone?: string;
          skills?: string[];
          interests?: string[];
          streak_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          avatar_url?: string;
          bio?: string;
          institution?: string;
          course?: string;
          academic_year?: string;
          location?: string;
          timezone?: string;
          skills?: string[];
          interests?: string[];
          streak_days?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          current_topic: string;
          confidence_score: number; // 1 to 5
          category: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          current_topic: string;
          confidence_score: number;
          category?: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          current_topic?: string;
          confidence_score?: number;
          category?: string;
          color?: string;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          subject_id: string | null;
          subject_name: string;
          title: string;
          description: string;
          status: 'todo' | 'in_progress' | 'review' | 'done' | 'skipped';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          due_date: string;
          estimated_minutes: number;
          assignee_id: string | null;
          assignee_name: string | null;
          assignee_avatar: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team_id?: string | null;
          subject_id?: string | null;
          subject_name?: string;
          title: string;
          description?: string;
          status?: 'todo' | 'in_progress' | 'review' | 'done' | 'skipped';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          due_date: string;
          estimated_minutes?: number;
          assignee_id?: string | null;
          assignee_name?: string | null;
          assignee_avatar?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          team_id?: string | null;
          subject_id?: string | null;
          subject_name?: string;
          title?: string;
          description?: string;
          status?: 'todo' | 'in_progress' | 'review' | 'done' | 'skipped';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          due_date?: string;
          estimated_minutes?: number;
          assignee_id?: string | null;
          assignee_name?: string | null;
          assignee_avatar?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      milestones: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          title: string;
          category: string;
          status: 'completed' | 'in_progress' | 'upcoming';
          progress_pct: number;
          due_date: string;
          completed_at: string | null;
          tasks_count: number;
          completed_tasks_count: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team_id?: string | null;
          title: string;
          category: string;
          status?: 'completed' | 'in_progress' | 'upcoming';
          progress_pct?: number;
          due_date: string;
          completed_at?: string | null;
          tasks_count?: number;
          completed_tasks_count?: number;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          team_id?: string | null;
          title?: string;
          category?: string;
          status?: 'completed' | 'in_progress' | 'upcoming';
          progress_pct?: number;
          due_date?: string;
          completed_at?: string | null;
          tasks_count?: number;
          completed_tasks_count?: number;
          description?: string;
          created_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          description: string;
          goal: string;
          project_topic: string;
          category: string;
          join_code: string;
          visibility: 'private' | 'invite_only' | 'discoverable';
          owner_id: string;
          owner_name: string;
          max_members: number;
          member_count: number;
          progress_pct: number;
          status: 'active' | 'archived' | 'completed';
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          goal: string;
          project_topic?: string;
          category?: string;
          join_code: string;
          visibility?: 'private' | 'invite_only' | 'discoverable';
          owner_id: string;
          owner_name: string;
          max_members?: number;
          member_count?: number;
          progress_pct?: number;
          status?: 'active' | 'archived' | 'completed';
          tags?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          goal?: string;
          project_topic?: string;
          category?: string;
          join_code?: string;
          visibility?: 'private' | 'invite_only' | 'discoverable';
          owner_id?: string;
          owner_name?: string;
          max_members?: number;
          member_count?: number;
          progress_pct?: number;
          status?: 'active' | 'archived' | 'completed';
          tags?: string[];
          created_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          name: string;
          email: string;
          role: 'owner' | 'member';
          avatar_url: string;
          status: 'active' | 'invited' | 'pending';
          joined_at: string;
          confidence_topics: { topic: string; score: number }[];
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          name: string;
          email: string;
          role?: 'owner' | 'member';
          avatar_url?: string;
          status?: 'active' | 'invited' | 'pending';
          joined_at?: string;
          confidence_topics?: { topic: string; score: number }[];
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          role?: 'owner' | 'member';
          avatar_url?: string;
          status?: 'active' | 'invited' | 'pending';
          joined_at?: string;
          confidence_topics?: { topic: string; score: number }[];
        };
      };
      discussions: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          user_name: string;
          user_avatar: string;
          content: string;
          created_at: string;
          attachments: { name: string; url: string; size: string; type: string }[] | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          user_name: string;
          user_avatar?: string;
          content: string;
          created_at?: string;
          attachments?: { name: string; url: string; size: string; type: string }[] | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          user_name?: string;
          user_avatar?: string;
          content?: string;
          created_at?: string;
          attachments?: { name: string; url: string; size: string; type: string }[] | null;
        };
      };
      team_activities: {
        Row: {
          id: string;
          team_id: string;
          user_name: string;
          user_avatar: string;
          action_type: 'member_joined' | 'task_created' | 'task_completed' | 'task_updated' | 'resource_uploaded' | 'discussion_posted';
          description: string;
          target_title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_name: string;
          user_avatar?: string;
          action_type: 'member_joined' | 'task_created' | 'task_completed' | 'task_updated' | 'resource_uploaded' | 'discussion_posted';
          description: string;
          target_title: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_name?: string;
          user_avatar?: string;
          action_type?: 'member_joined' | 'task_created' | 'task_completed' | 'task_updated' | 'resource_uploaded' | 'discussion_posted';
          description?: string;
          target_title?: string;
          created_at?: string;
        };
      };
      resources: {
        Row: {
          id: string;
          title: string;
          file_name: string;
          file_type: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'image' | 'zip' | 'video' | 'link' | 'other';
          file_size_bytes: number;
          file_size_formatted: string;
          storage_path: string;
          url: string;
          uploader_id: string;
          uploader_name: string;
          team_id: string | null;
          team_name: string | null;
          folder: string;
          category: 'documents' | 'images' | 'presentations' | 'spreadsheets' | 'videos' | 'archives' | 'links' | 'other';
          is_shared: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          file_name: string;
          file_type: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'image' | 'zip' | 'video' | 'link' | 'other';
          file_size_bytes?: number;
          file_size_formatted?: string;
          storage_path?: string;
          url?: string;
          uploader_id: string;
          uploader_name: string;
          team_id?: string | null;
          team_name?: string | null;
          folder?: string;
          category: 'documents' | 'images' | 'presentations' | 'spreadsheets' | 'videos' | 'archives' | 'links' | 'other';
          is_shared?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          file_name?: string;
          file_type?: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'image' | 'zip' | 'video' | 'link' | 'other';
          file_size_bytes?: number;
          file_size_formatted?: string;
          storage_path?: string;
          url?: string;
          uploader_id?: string;
          uploader_name?: string;
          team_id?: string | null;
          team_name?: string | null;
          folder?: string;
          category?: 'documents' | 'images' | 'presentations' | 'spreadsheets' | 'videos' | 'archives' | 'links' | 'other';
          is_shared?: boolean;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'team_invite' | 'team_join' | 'task_assigned' | 'deadline_approaching' | 'resource_shared' | 'team_activity' | 'discussion_mention';
          title: string;
          message: string;
          link: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'team_invite' | 'team_join' | 'task_assigned' | 'deadline_approaching' | 'resource_shared' | 'team_activity' | 'discussion_mention';
          title: string;
          message: string;
          link?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'team_invite' | 'team_join' | 'task_assigned' | 'deadline_approaching' | 'resource_shared' | 'team_activity' | 'discussion_mention';
          title?: string;
          message?: string;
          link?: string;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

export type UserProfile = Database['public']['Tables']['users']['Row'];
export type SubjectItem = Database['public']['Tables']['subjects']['Row'];
export type TaskItem = Database['public']['Tables']['tasks']['Row'];
export type MilestoneItem = Database['public']['Tables']['milestones']['Row'];
export type TeamItem = Database['public']['Tables']['teams']['Row'];
export type TeamMemberItem = Database['public']['Tables']['team_members']['Row'];
export type DiscussionMessage = Database['public']['Tables']['discussions']['Row'];
export type TeamActivityItem = Database['public']['Tables']['team_activities']['Row'];
export type ResourceItem = Database['public']['Tables']['resources']['Row'];
export type NotificationItem = Database['public']['Tables']['notifications']['Row'];

export type WellbeingMood = 'calm' | 'okay' | 'tired' | 'overwhelmed' | 'stressed' | 'need_break';

export type WellbeingCheckin = {
  id: string;
  user_id: string;
  mood: WellbeingMood;
  created_at: string;
};

export type BreakActivity = {
  id: string;
  title: string;
  duration_minutes: number;
  category: 'breathing' | 'movement' | 'reflection' | 'screen_reset' | 'hydration';
  description: string;
  steps: string[];
};

export type SupportResource = {
  id: string;
  title: string;
  category: 'Academic Support' | 'Study & Learning Support' | 'Peer Mentoring' | 'Campus Advising' | 'Career & Skills';
  description: string;
  url: string;
  availability: string;
};

export type TeamCheckinStatus = 'making_progress' | 'need_help' | 'taking_break' | 'almost_finished';

export type TeamCheckinItem = {
  id: string;
  team_id: string;
  user_id: string;
  user_name: string;
  status: TeamCheckinStatus;
  note?: string;
  created_at: string;
};

