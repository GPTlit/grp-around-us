export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          accent: string
          id: string
          name: string
          settings: Json
          tagline: string
          updated_at: string
        }
        Insert: {
          accent?: string
          id?: string
          name?: string
          settings?: Json
          tagline?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          id?: string
          name?: string
          settings?: Json
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          created_at: string
          from_id: string
          id: string
          payload: Json | null
          room_id: string
          to_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          payload?: Json | null
          room_id: string
          to_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          payload?: Json | null
          room_id?: string
          to_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      code_drafts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          language: string
          note: string | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          language?: string
          note?: string | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          language?: string
          note?: string | null
          title?: string
        }
        Relationships: []
      }
      extensions: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_url: string | null
          body: string | null
          card_rank: string | null
          card_suit: string | null
          created_at: string
          id: string
          kind: string
          recipient_id: string | null
          room_id: string
          sender_id: string
        }
        Insert: {
          audio_url?: string | null
          body?: string | null
          card_rank?: string | null
          card_suit?: string | null
          created_at?: string
          id?: string
          kind?: string
          recipient_id?: string | null
          room_id: string
          sender_id: string
        }
        Update: {
          audio_url?: string | null
          body?: string | null
          card_rank?: string | null
          card_suit?: string | null
          created_at?: string
          id?: string
          kind?: string
          recipient_id?: string | null
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          phone: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          phone?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string | null
          username?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          id: string
          lies1: number
          lies2: number
          moderator_id: string
          player1_id: string | null
          player2_id: string | null
          round: number
          score1: number
          score2: number
          status: string
          turn: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          lies1?: number
          lies2?: number
          moderator_id: string
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          score1?: number
          score2?: number
          status?: string
          turn?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          lies1?: number
          lies2?: number
          moderator_id?: string
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          score1?: number
          score2?: number
          status?: string
          turn?: number
        }
        Relationships: []
      }
      studio_runs: {
        Row: {
          changes: Json
          created_at: string
          created_by: string | null
          id: string
          prompt: string
          summary: string | null
        }
        Insert: {
          changes?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          prompt: string
          summary?: string | null
        }
        Update: {
          changes?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          prompt?: string
          summary?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
