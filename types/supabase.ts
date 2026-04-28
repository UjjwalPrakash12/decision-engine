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
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          workspace_name: string | null;
          data_source_preference: "supabase" | "csv" | "sample" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          workspace_name?: string | null;
          data_source_preference?: "supabase" | "csv" | "sample" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          workspace_name?: string | null;
          data_source_preference?: "supabase" | "csv" | "sample" | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_metrics: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          revenue: number;
          customers: number;
          conversion_rate: number;
          churn_rate: number;
          avg_order_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          revenue: number;
          customers: number;
          conversion_rate: number;
          churn_rate: number;
          avg_order_value: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          revenue?: number;
          customers?: number;
          conversion_rate?: number;
          churn_rate?: number;
          avg_order_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_metrics_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
