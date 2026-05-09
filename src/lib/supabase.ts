import { createBrowserClient } from "@supabase/ssr";

import type { AppState, ProfileSummaryRow } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: ProfileSummaryRow;
        Insert: Omit<ProfileSummaryRow, "updated_at"> & { updated_at?: string };
        Update: Partial<ProfileSummaryRow>;
        Relationships: [];
      };
      user_snapshots: {
        Row: {
          user_id: string;
          state: AppState;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          state: AppState;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          state?: AppState;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export function createBrowserSupabase() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
