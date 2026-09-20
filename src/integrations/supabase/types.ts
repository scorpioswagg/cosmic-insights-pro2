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
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_email: string | null
          target_report_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_email?: string | null
          target_report_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_email?: string | null
          target_report_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_invites: {
        Row: {
          created_at: string
          email: string
          invited_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          invited_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json
          pdf_url: string | null
          recipient_email: string
          recipient_name: string | null
          resend_id: string | null
          status: string
          template_name: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json
          pdf_url?: string | null
          recipient_email: string
          recipient_name?: string | null
          resend_id?: string | null
          status?: string
          template_name: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json
          pdf_url?: string | null
          recipient_email?: string
          recipient_name?: string | null
          resend_id?: string | null
          status?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          adult_consent: boolean
          created_at: string
          id: string
          updated_at: string
          welcome_message_seen: boolean
        }
        Insert: {
          adult_consent?: boolean
          created_at?: string
          id: string
          updated_at?: string
          welcome_message_seen?: boolean
        }
        Update: {
          adult_consent?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          welcome_message_seen?: boolean
        }
        Relationships: []
      }
      report_entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          purchase_id: string | null
          report_id: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          purchase_id?: string | null
          report_id: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          purchase_id?: string | null
          report_id?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_entitlements_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "report_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_entitlements_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_products"
            referencedColumns: ["id"]
          },
        ]
      }
      report_products: {
        Row: {
          adult: boolean
          category: string
          created_at: string
          currency: string
          icon: string
          id: string
          is_free: boolean
          is_published: boolean
          price_cents: number
          slug: string | null
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          tagline: string
          title: string
          updated_at: string
        }
        Insert: {
          adult?: boolean
          category: string
          created_at?: string
          currency?: string
          icon?: string
          id: string
          is_free?: boolean
          is_published?: boolean
          price_cents?: number
          slug?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tagline?: string
          title: string
          updated_at?: string
        }
        Update: {
          adult?: boolean
          category?: string
          created_at?: string
          currency?: string
          icon?: string
          id?: string
          is_free?: boolean
          is_published?: boolean
          price_cents?: number
          slug?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tagline?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_email: string | null
          email_sent_at: string | null
          id: string
          metadata: Json
          report_id: string
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          email_sent_at?: string | null
          id?: string
          metadata?: Json
          report_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          email_sent_at?: string | null
          id?: string
          metadata?: Json
          report_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_purchases_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed_at: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          payload?: Json
          processed_at?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
