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
      app_metadata: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          created_at: string | null
          drive_folder_id: string | null
          file_name: string | null
          id: string
          month: number
          pending_count: number
          total_count: number
          transactions: Json
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          drive_folder_id?: string | null
          file_name?: string | null
          id?: string
          month: number
          pending_count?: number
          total_count?: number
          transactions: Json
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          drive_folder_id?: string | null
          file_name?: string | null
          id?: string
          month?: number
          pending_count?: number
          total_count?: number
          transactions?: Json
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      blocked_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      box_presets: {
        Row: {
          created_at: string | null
          height_cm: number
          id: string
          length_cm: number
          name: string
          weight_kg: number
          width_cm: number
        }
        Insert: {
          created_at?: string | null
          height_cm: number
          id?: string
          length_cm: number
          name: string
          weight_kg: number
          width_cm: number
        }
        Update: {
          created_at?: string | null
          height_cm?: number
          id?: string
          length_cm?: number
          name?: string
          weight_kg?: number
          width_cm?: number
        }
        Relationships: []
      }
      client_drive_folders: {
        Row: {
          client_name: string
          created_at: string | null
          drive_folder_id: string
          holded_contact_id: string
          id: string
        }
        Insert: {
          client_name: string
          created_at?: string | null
          drive_folder_id: string
          holded_contact_id: string
          id?: string
        }
        Update: {
          client_name?: string
          created_at?: string | null
          drive_folder_id?: string
          holded_contact_id?: string
          id?: string
        }
        Relationships: []
      }
      client_verifications: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          project_id: string
          session_token: string | null
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          project_id: string
          session_token?: string | null
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          project_id?: string
          session_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_verifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_snippets: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          amount: number
          bank_vendor_name: string | null
          category: string
          created_at: string | null
          day_of_month: number | null
          frequency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_vendor_name?: string | null
          category?: string
          created_at?: string | null
          day_of_month?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_vendor_name?: string | null
          category?: string
          created_at?: string | null
          day_of_month?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      holded_contacts: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          contact_type: string | null
          country: string | null
          country_code: string | null
          email: string | null
          holded_id: string
          mobile: string | null
          name: string
          note: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          contact_type?: string | null
          country?: string | null
          country_code?: string | null
          email?: string | null
          holded_id: string
          mobile?: string | null
          name: string
          note?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          contact_type?: string | null
          country?: string | null
          country_code?: string | null
          email?: string | null
          holded_id?: string
          mobile?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      holded_sync_exclusions: {
        Row: {
          created_at: string | null
          doc_type: string
          holded_document_id: string
          id: string
          project_name: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type: string
          holded_document_id: string
          id?: string
          project_name?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type?: string
          holded_document_id?: string
          id?: string
          project_name?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      improvement_requests: {
        Row: {
          confirmed_at: string | null
          created_at: string
          description: string
          id: string
          manager_notes: string | null
          priority: string | null
          request_type: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          resolved_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          description: string
          id?: string
          manager_notes?: string | null
          priority?: string | null
          request_type: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          manager_notes?: string | null
          priority?: string | null
          request_type?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "improvement_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "improvement_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "improvement_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_claims: {
        Row: {
          claim_date: string | null
          created_at: string | null
          created_by: string | null
          email_sent_to: string
          id: string
          response_notes: string | null
          status: string | null
          supplier_id: string | null
          total_amount: number
          transactions: Json
        }
        Insert: {
          claim_date?: string | null
          created_at?: string | null
          created_by?: string | null
          email_sent_to: string
          id?: string
          response_notes?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount: number
          transactions: Json
        }
        Update: {
          claim_date?: string | null
          created_at?: string | null
          created_by?: string | null
          email_sent_to?: string
          id?: string
          response_notes?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
          transactions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoice_claims_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          metadata: Json | null
          thread_id: string | null
        }
        Insert: {
          activity_type: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          thread_id?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          attachments: string | null
          company: string | null
          created_at: string
          email: string | null
          email_subject_tag: string | null
          full_name: string
          id: string
          lost_reason: string | null
          message: string | null
          phone: string | null
          source: string
          status: string
          updated_at: string
          webflow_submission_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachments?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_subject_tag?: string | null
          full_name: string
          id?: string
          lost_reason?: string | null
          message?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          webflow_submission_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachments?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_subject_tag?: string | null
          full_name?: string
          id?: string
          lost_reason?: string | null
          message?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          webflow_submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          batch_number: number
          completed_at: string | null
          created_at: string | null
          estimated_minutes: number
          id: string
          pieces_in_batch: number
          position: number
          printer_id: string | null
          printer_type_id: string
          project_item_id: string
          scheduled_start: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          batch_number: number
          completed_at?: string | null
          created_at?: string | null
          estimated_minutes: number
          id?: string
          pieces_in_batch: number
          position?: number
          printer_id?: string | null
          printer_type_id: string
          project_item_id: string
          scheduled_start?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_number?: number
          completed_at?: string | null
          created_at?: string | null
          estimated_minutes?: number
          id?: string
          pieces_in_batch?: number
          position?: number
          printer_id?: string | null
          printer_type_id?: string
          project_item_id?: string
          scheduled_start?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_printer_type_id_fkey"
            columns: ["printer_type_id"]
            isOneToOne: false
            referencedRelation: "printer_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_daily_stats: {
        Row: {
          created_at: string | null
          date: string
          id: string
          printer_id: string
          printing_seconds: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          printer_id: string
          printing_seconds?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          printer_id?: string
          printing_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "printer_daily_stats_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_types: {
        Row: {
          bed_depth_mm: number
          bed_height_mm: number
          bed_width_mm: number
          compatible_types: string[] | null
          created_at: string | null
          id: string
          multicolor: boolean
          name: string
        }
        Insert: {
          bed_depth_mm: number
          bed_height_mm: number
          bed_width_mm: number
          compatible_types?: string[] | null
          created_at?: string | null
          id?: string
          multicolor?: boolean
          name: string
        }
        Update: {
          bed_depth_mm?: number
          bed_height_mm?: number
          bed_width_mm?: number
          compatible_types?: string[] | null
          created_at?: string | null
          id?: string
          multicolor?: boolean
          name?: string
        }
        Relationships: []
      }
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
          lifetime_seconds: number
          model: string | null
          mqtt_connected: boolean | null
          name: string
          nozzle_target: number | null
          nozzle_temp: number | null
          online: boolean | null
          print_error: number | null
          print_percent: number | null
          printer_type_id: string | null
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
          lifetime_seconds?: number
          model?: string | null
          mqtt_connected?: boolean | null
          name: string
          nozzle_target?: number | null
          nozzle_temp?: number | null
          online?: boolean | null
          print_error?: number | null
          print_percent?: number | null
          printer_type_id?: string | null
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
          lifetime_seconds?: number
          model?: string | null
          mqtt_connected?: boolean | null
          name?: string
          nozzle_target?: number | null
          nozzle_temp?: number | null
          online?: boolean | null
          print_error?: number | null
          print_percent?: number | null
          printer_type_id?: string | null
          raw_status?: Json | null
          remaining_minutes?: number | null
          serial_number?: string
          speed_level?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_printer_type_id_fkey"
            columns: ["printer_type_id"]
            isOneToOne: false
            referencedRelation: "printer_types"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          data: Json | null
          id: string
          item_type: string
          name: string
          position: number
          project_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          item_type?: string
          name: string
          position?: number
          project_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          item_type?: string
          name?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      project_items: {
        Row: {
          batch_size: number
          completed: number
          created_at: string
          file_keyword: string | null
          id: string
          name: string
          notes: string | null
          print_time_minutes: number | null
          printer_type_id: string | null
          project_id: string
          quantity: number
          stl_file_id: string | null
          stl_volume_cm3: number | null
        }
        Insert: {
          batch_size?: number
          completed?: number
          created_at?: string
          file_keyword?: string | null
          id?: string
          name: string
          notes?: string | null
          print_time_minutes?: number | null
          printer_type_id?: string | null
          project_id: string
          quantity?: number
          stl_file_id?: string | null
          stl_volume_cm3?: number | null
        }
        Update: {
          batch_size?: number
          completed?: number
          created_at?: string
          file_keyword?: string | null
          id?: string
          name?: string
          notes?: string | null
          print_time_minutes?: number | null
          printer_type_id?: string | null
          project_id?: string
          quantity?: number
          stl_file_id?: string | null
          stl_volume_cm3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_items_printer_type_id_fkey"
            columns: ["printer_type_id"]
            isOneToOne: false
            referencedRelation: "printer_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          assigned_printer: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deliverable_approved_at: string | null
          deliverable_visible: boolean
          description: string | null
          design_approved_at: string | null
          design_visible: boolean
          google_drive_folder_id: string | null
          holded_contact_id: string | null
          holded_invoice_id: string | null
          holded_proforma_id: string | null
          id: string
          invoice_date: string | null
          lead_id: string | null
          material: string | null
          name: string
          notes: string | null
          payment_confirmed_at: string | null
          price: number | null
          print_time_minutes: number | null
          project_type: string
          queue_priority: number
          status: string
          template_id: string | null
          tracking_token: string
          updated_at: string
        }
        Insert: {
          assigned_printer?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_approved_at?: string | null
          deliverable_visible?: boolean
          description?: string | null
          design_approved_at?: string | null
          design_visible?: boolean
          google_drive_folder_id?: string | null
          holded_contact_id?: string | null
          holded_invoice_id?: string | null
          holded_proforma_id?: string | null
          id?: string
          invoice_date?: string | null
          lead_id?: string | null
          material?: string | null
          name: string
          notes?: string | null
          payment_confirmed_at?: string | null
          price?: number | null
          print_time_minutes?: number | null
          project_type?: string
          queue_priority?: number
          status?: string
          template_id?: string | null
          tracking_token?: string
          updated_at?: string
        }
        Update: {
          assigned_printer?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_approved_at?: string | null
          deliverable_visible?: boolean
          description?: string | null
          design_approved_at?: string | null
          design_visible?: boolean
          google_drive_folder_id?: string | null
          holded_contact_id?: string | null
          holded_invoice_id?: string | null
          holded_proforma_id?: string | null
          id?: string
          invoice_date?: string | null
          lead_id?: string | null
          material?: string | null
          name?: string
          notes?: string | null
          payment_confirmed_at?: string | null
          price?: number | null
          print_time_minutes?: number | null
          project_type?: string
          queue_priority?: number
          status?: string
          template_id?: string | null
          tracking_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          actual_price: number | null
          created_at: string | null
          created_by: string | null
          description: string
          estimated_price: number | null
          id: string
          item_type: string | null
          link: string | null
          notes: string | null
          provider: string | null
          purchase_list_id: string | null
          purchased_at: string | null
          purchased_by: string | null
          quantity: number | null
          received_at: string | null
          status: string | null
        }
        Insert: {
          actual_price?: number | null
          created_at?: string | null
          created_by?: string | null
          description: string
          estimated_price?: number | null
          id?: string
          item_type?: string | null
          link?: string | null
          notes?: string | null
          provider?: string | null
          purchase_list_id?: string | null
          purchased_at?: string | null
          purchased_by?: string | null
          quantity?: number | null
          received_at?: string | null
          status?: string | null
        }
        Update: {
          actual_price?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          estimated_price?: number | null
          id?: string
          item_type?: string | null
          link?: string | null
          notes?: string | null
          provider?: string | null
          purchase_list_id?: string | null
          purchased_at?: string | null
          purchased_by?: string | null
          quantity?: number | null
          received_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_list_id_fkey"
            columns: ["purchase_list_id"]
            isOneToOne: false
            referencedRelation: "purchase_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          project_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_postal_code: string | null
          billing_province: string | null
          created_at: string | null
          holded_contact_id: string | null
          holded_proforma_id: string | null
          id: string
          lead_id: string
          status: string
          submitted_at: string | null
          tax_id: string | null
          token: string
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_postal_code?: string | null
          billing_province?: string | null
          created_at?: string | null
          holded_contact_id?: string | null
          holded_proforma_id?: string | null
          id?: string
          lead_id: string
          status?: string
          submitted_at?: string | null
          tax_id?: string | null
          token?: string
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_postal_code?: string | null
          billing_province?: string | null
          created_at?: string | null
          holded_contact_id?: string | null
          holded_proforma_id?: string | null
          id?: string
          lead_id?: string
          status?: string
          submitted_at?: string | null
          tax_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_info: {
        Row: {
          address_line: string | null
          carrier: string | null
          city: string | null
          content_description: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          declared_value: number | null
          delivered_at: string | null
          id: string
          label_url: string | null
          notes: string | null
          package_height: number | null
          package_length: number | null
          package_weight: number | null
          package_width: number | null
          packlink_order_ref: string | null
          packlink_shipment_ref: string | null
          postal_code: string | null
          price: number | null
          project_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          service_id: number | null
          service_name: string | null
          shipment_status: string | null
          shipped_at: string | null
          title: string | null
          tracking_number: string | null
        }
        Insert: {
          address_line?: string | null
          carrier?: string | null
          city?: string | null
          content_description?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          declared_value?: number | null
          delivered_at?: string | null
          id?: string
          label_url?: string | null
          notes?: string | null
          package_height?: number | null
          package_length?: number | null
          package_weight?: number | null
          package_width?: number | null
          packlink_order_ref?: string | null
          packlink_shipment_ref?: string | null
          postal_code?: string | null
          price?: number | null
          project_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          service_id?: number | null
          service_name?: string | null
          shipment_status?: string | null
          shipped_at?: string | null
          title?: string | null
          tracking_number?: string | null
        }
        Update: {
          address_line?: string | null
          carrier?: string | null
          city?: string | null
          content_description?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          declared_value?: number | null
          delivered_at?: string | null
          id?: string
          label_url?: string | null
          notes?: string | null
          package_height?: number | null
          package_length?: number | null
          package_weight?: number | null
          package_width?: number | null
          packlink_order_ref?: string | null
          packlink_shipment_ref?: string | null
          postal_code?: string | null
          price?: number | null
          project_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          service_id?: number | null
          service_name?: string | null
          shipment_status?: string | null
          shipped_at?: string | null
          title?: string | null
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
      skills: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          has_invoice: boolean | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          payment_date: string
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_date: string
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_date?: string
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          price: number | null
          supplier_id: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          price?: number | null
          supplier_id: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          price?: number | null
          supplier_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          holded_contact_id: string | null
          id: string
          name: string
          nif_cif: string | null
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          holded_contact_id?: string | null
          id?: string
          name: string
          nif_cif?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          holded_contact_id?: string | null
          id?: string
          name?: string
          nif_cif?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          due_date: string
          id: string
          model: string
          notes: string | null
          paid_date: string | null
          period: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          due_date: string
          id?: string
          model: string
          notes?: string | null
          paid_date?: string | null
          period: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          due_date?: string
          id?: string
          model?: string
          notes?: string | null
          paid_date?: string | null
          period?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      template_checklist_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_type: string
          name: string
          position: number
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          name: string
          position?: number
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          name?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          is_active?: boolean
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          skill_id: string
          user_id: string
        }
        Insert: {
          skill_id: string
          user_id: string
        }
        Update: {
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_smtp_settings: {
        Row: {
          created_at: string | null
          display_name: string
          signature_html: string | null
          smtp_email: string
          smtp_password_encrypted: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          signature_html?: string | null
          smtp_email: string
          smtp_password_encrypted: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          signature_html?: string | null
          smtp_email?: string
          smtp_password_encrypted?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_smtp_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_mappings: {
        Row: {
          bank_vendor_name: string
          created_at: string | null
          id: string
          supplier_id: string | null
        }
        Insert: {
          bank_vendor_name: string
          created_at?: string | null
          id?: string
          supplier_id?: string | null
        }
        Update: {
          bank_vendor_name?: string
          created_at?: string | null
          id?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_mappings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          body: string | null
          created_at: string | null
          endpoint: string
          headers: Json | null
          id: string
          method: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          endpoint: string
          headers?: Json | null
          id?: string
          method?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          endpoint?: string
          headers?: Json | null
          id?: string
          method?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
      increment_printing_seconds: {
        Args: { p_date: string; p_printer_id: string; p_seconds: number }
        Returns: undefined
      }
      is_user_active: { Args: never; Returns: boolean }
      upsert_lead_by_email: {
        Args: {
          p_email: string
          p_full_name: string
          p_message?: string
          p_source?: string
        }
        Returns: string
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
