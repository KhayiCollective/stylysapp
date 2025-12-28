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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          shopify_access_token: string | null
          shopify_connected_at: string | null
          shopify_store_domain: string | null
          shopify_storefront_token: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_store_domain?: string | null
          shopify_storefront_token?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_store_domain?: string | null
          shopify_storefront_token?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          avoided_colors: Json | null
          body_shape: string | null
          brand_id: string
          budget_range: Json | null
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          occasions: Json | null
          preferred_colors: Json | null
          quiz_completed_at: string | null
          size_info: Json | null
          style_preferences: Json | null
          updated_at: string
        }
        Insert: {
          avoided_colors?: Json | null
          body_shape?: string | null
          brand_id: string
          budget_range?: Json | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          occasions?: Json | null
          preferred_colors?: Json | null
          quiz_completed_at?: string | null
          size_info?: Json | null
          style_preferences?: Json | null
          updated_at?: string
        }
        Update: {
          avoided_colors?: Json | null
          body_shape?: string | null
          brand_id?: string
          budget_range?: Json | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          occasions?: Json | null
          preferred_colors?: Json | null
          quiz_completed_at?: string | null
          size_info?: Json | null
          style_preferences?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_items: {
        Row: {
          created_at: string
          id: string
          outfit_id: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_id: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          anchor_product_id: string | null
          brand_id: string
          conversions: number
          created_at: string
          id: string
          name: string | null
          total_price: number
          updated_at: string
          views: number
        }
        Insert: {
          anchor_product_id?: string | null
          brand_id: string
          conversions?: number
          created_at?: string
          id?: string
          name?: string | null
          total_price?: number
          updated_at?: string
          views?: number
        }
        Update: {
          anchor_product_id?: string | null
          brand_id?: string
          conversions?: number
          created_at?: string
          id?: string
          name?: string | null
          total_price?: number
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "outfits_anchor_product_id_fkey"
            columns: ["anchor_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          category: string
          color: string | null
          created_at: string
          fit: string | null
          id: string
          image_url: string | null
          inventory_status: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          category: string
          color?: string | null
          created_at?: string
          fit?: string | null
          id?: string
          image_url?: string | null
          inventory_status?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category?: string
          color?: string | null
          created_at?: string
          fit?: string | null
          id?: string
          image_url?: string | null
          inventory_status?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          brand_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          brand_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          brand_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          added_to_cart_at: string | null
          brand_id: string
          clicked_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          occasion: string | null
          outfit_id: string | null
          purchased_at: string | null
          reason: string | null
          viewed_at: string | null
        }
        Insert: {
          added_to_cart_at?: string | null
          brand_id: string
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          occasion?: string | null
          outfit_id?: string | null
          purchased_at?: string | null
          reason?: string | null
          viewed_at?: string | null
        }
        Update: {
          added_to_cart_at?: string | null
          brand_id?: string
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          occasion?: string | null
          outfit_id?: string | null
          purchased_at?: string | null
          reason?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          brand_id: string
          category: string
          config: Json | null
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          category: string
          config?: Json | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category?: string
          config?: Json | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      widget_config: {
        Row: {
          border_radius: string | null
          brand_id: string
          cart_api_endpoint: string | null
          cart_integration_type: string | null
          created_at: string
          font_family: string | null
          id: string
          max_recommendations: number | null
          primary_color: string | null
          quiz_enabled: boolean | null
          quiz_questions: Json | null
          secondary_color: string | null
          show_prices: boolean | null
          updated_at: string
        }
        Insert: {
          border_radius?: string | null
          brand_id: string
          cart_api_endpoint?: string | null
          cart_integration_type?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          max_recommendations?: number | null
          primary_color?: string | null
          quiz_enabled?: boolean | null
          quiz_questions?: Json | null
          secondary_color?: string | null
          show_prices?: boolean | null
          updated_at?: string
        }
        Update: {
          border_radius?: string | null
          brand_id?: string
          cart_api_endpoint?: string | null
          cart_integration_type?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          max_recommendations?: number | null
          primary_color?: string | null
          quiz_enabled?: boolean | null
          quiz_questions?: Json | null
          secondary_color?: string | null
          show_prices?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_config_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_brand_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "owner" | "member"
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
    Enums: {
      app_role: ["admin", "owner", "member"],
    },
  },
} as const
