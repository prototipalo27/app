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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      printers: {
        Row: {
          bed_target: number | null
          bed_temp: number | null
          chamber_temp: number | null
          created_at: string | null
          current_file: string | null
          fan_speed: number | null
          gcode_state: string | null
          id: string
          last_sync_at: string | null
          layer_current: number | null
          layer_total: number | null
          model: string | null
          mqtt_connected: boolean | null
          name: string
          nozzle_target: number | null
          nozzle_temp: number | null
          online: boolean | null
          print_error: number | null
          print_percent: number | null
          raw_status: Json | null
          remaining_minutes: number | null
          serial_number: string
          speed_level: number | null
          updated_at: string | null
        }
        Insert: {
          bed_target?: number | null
          bed_temp?: number | null
          chamber_temp?: number | null
          created_at?: string | null
          current_file?: string | null
          fan_speed?: number | null
          gcode_state?: string | null
          id?: string
          last_sync_at?: string | null
          layer_current?: number | null
          layer_total?: number | null
          model?: string | null
          mqtt_connected?: boolean | null
          name: string
          nozzle_target?: number | null
          nozzle_temp?: number | null
          online?: boolean | null
          print_error?: number | null
          print_percent?: number | null
          raw_status?: Json | null
          remaining_minutes?: number | null
          serial_number: string
          speed_level?: number | null
          updated_at?: string | null
        }
        Update: {
          bed_target?: number | null
          bed_temp?: number | null
          chamber_temp?: number | null
          created_at?: string | null
          current_file?: string | null
          fan_speed?: number | null
          gcode_state?: string | null
          id?: string
          last_sync_at?: string | null
          layer_current?: number | null
          layer_total?: number | null
          model?: string | null
          mqtt_connected?: boolean | null
          name?: string
          nozzle_target?: number | null
          nozzle_temp?: number | null
          online?: boolean | null
          print_error?: number | null
          print_percent?: number | null
          raw_status?: Json | null
          remaining_minutes?: number | null
          serial_number?: string
          speed_level?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_files: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          project_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          project_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          project_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_printer: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          holded_invoice_id: string | null
          holded_proforma_id: string | null
          id: string
          material: string | null
          name: string
          notes: string | null
          price: number | null
          print_time_minutes: number | null
          project_type: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_printer?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          holded_invoice_id?: string | null
          holded_proforma_id?: string | null
          id?: string
          material?: string | null
          name: string
          notes?: string | null
          price?: number | null
          print_time_minutes?: number | null
          project_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_printer?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          holded_invoice_id?: string | null
          holded_proforma_id?: string | null
          id?: string
          material?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          print_time_minutes?: number | null
          project_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_info: {
        Row: {
          address_line: string | null
          carrier: string | null
          city: string | null
          country: string | null
          delivered_at: string | null
          id: string
          notes: string | null
          postal_code: string | null
          project_id: string
          shipped_at: string | null
          tracking_number: string | null
        }
        Insert: {
          address_line?: string | null
          carrier?: string | null
          city?: string | null
          country?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          postal_code?: string | null
          project_id: string
          shipped_at?: string | null
          tracking_number?: string | null
        }
        Update: {
          address_line?: string | null
          carrier?: string | null
          city?: string | null
          country?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          postal_code?: string | null
          project_id?: string
          shipped_at?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_info_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
