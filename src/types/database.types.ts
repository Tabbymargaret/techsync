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
          user_id: string;
          full_name: string;
          email: string;
          role: string;
          password_hash: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          full_name: string;
          email: string;
          role: string;
          password_hash: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string;
          email?: string;
          role?: string;
          password_hash?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          profile_id: string;
          user_id: string;
          bio: string | null;
          github_url: string | null;
          max_capacity: number | null;
          created_at: string;
        };
        Insert: {
          profile_id?: string;
          user_id: string;
          bio?: string | null;
          github_url?: string | null;
          max_capacity?: number | null;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          user_id?: string;
          bio?: string | null;
          github_url?: string | null;
          max_capacity?: number | null;
          created_at?: string;
        };
      };
      skills: {
        Row: {
          skill_id: string;
          profile_id: string;
          skill_name: string;
          category: string;
          proficiency_level: number | null;
          weight_score: number | null;
          created_at: string;
        };
        Insert: {
          skill_id?: string;
          profile_id: string;
          skill_name: string;
          category: string;
          proficiency_level?: number | null;
          weight_score?: number | null;
          created_at?: string;
        };
        Update: {
          skill_id?: string;
          profile_id?: string;
          skill_name?: string;
          category?: string;
          proficiency_level?: number | null;
          weight_score?: number | null;
          created_at?: string;
        };
      };
      mentorship_pairing: {
        Row: {
          pairing_id: string;
          student_id: string;
          mentor_id: string;
          start_date: string;
          end_date: string;
          status: string;
          created_at: string;
        };
        Insert: {
          pairing_id?: string;
          student_id: string;
          mentor_id: string;
          start_date: string;
          end_date: string;
          status: string;
          created_at?: string;
        };
        Update: {
          pairing_id?: string;
          student_id?: string;
          mentor_id?: string;
          start_date?: string;
          end_date?: string;
          status?: string;
          created_at?: string;
        };
      };
      milestones: {
        Row: {
          milestone_id: string;
          pairing_id: string;
          title: string;
          description: string | null;
          due_date: string;
          progress_status: string;
          created_at: string;
        };
        Insert: {
          milestone_id?: string;
          pairing_id: string;
          title: string;
          description?: string | null;
          due_date: string;
          progress_status: string;
          created_at?: string;
        };
        Update: {
          milestone_id?: string;
          pairing_id?: string;
          title?: string;
          description?: string | null;
          due_date?: string;
          progress_status?: string;
          created_at?: string;
        };
      };
      sessions: {
        Row: {
          session_id: string;
          pairing_id: string;
          scheduled_time: string;
          meeting_link: string | null;
          attendance_status: string;
          created_at: string;
        };
        Insert: {
          session_id?: string;
          pairing_id: string;
          scheduled_time: string;
          meeting_link?: string | null;
          attendance_status: string;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          pairing_id?: string;
          scheduled_time?: string;
          meeting_link?: string | null;
          attendance_status?: string;
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
