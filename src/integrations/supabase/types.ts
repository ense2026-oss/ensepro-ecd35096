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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      affiliations: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      app_notifications: {
        Row: {
          action_label: string | null
          created_at: string
          description: string
          id: string
          is_read: boolean
          target_employee: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          target_employee?: string | null
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          target_employee?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          date: string
          employee_id: string
          id: string
          late: boolean
          ot_hours: number
          status: string
        }
        Insert: {
          check_in?: string
          check_out?: string
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          late?: boolean
          ot_hours?: number
          status?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          late?: boolean
          ot_hours?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_records: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          location: string
          remark: string | null
          source: string
          within_radius: boolean
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          location?: string
          remark?: string | null
          source?: string
          within_radius?: boolean
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          location?: string
          remark?: string | null
          source?: string
          within_radius?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "check_in_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      contract_attachments: {
        Row: {
          contract_id: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          contract_id: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          contract_id?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_notifications: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          recipient_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          recipient_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_settings: {
        Row: {
          default_executive_id: string | null
          id: string
          updated_at: string
          witness_count: number
        }
        Insert: {
          default_executive_id?: string | null
          id?: string
          updated_at?: string
          witness_count?: number
        }
        Update: {
          default_executive_id?: string | null
          id?: string
          updated_at?: string
          witness_count?: number
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          contract_id: string
          id: string
          signature_data: string
          signature_type: string
          signed_at: string
          signer_id: string
          signer_role: string
        }
        Insert: {
          contract_id: string
          id?: string
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signer_id: string
          signer_role?: string
        }
        Update: {
          contract_id?: string
          id?: string
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signer_id?: string
          signer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_number: string
          contract_type: string
          created_at: string
          created_by: string
          details: Json
          employee_id: string
          end_date: string
          executive_id: string
          id: string
          salary: number
          start_date: string
          status: string
          title: string
          updated_at: string
          witness_1_id: string | null
          witness_2_id: string | null
        }
        Insert: {
          contract_number?: string
          contract_type?: string
          created_at?: string
          created_by: string
          details?: Json
          employee_id: string
          end_date?: string
          executive_id: string
          id?: string
          salary?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          witness_1_id?: string | null
          witness_2_id?: string | null
        }
        Update: {
          contract_number?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          details?: Json
          employee_id?: string
          end_date?: string
          executive_id?: string
          id?: string
          salary?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          witness_1_id?: string | null
          witness_2_id?: string | null
        }
        Relationships: []
      }
      employee_custom_payroll_items: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          enabled: boolean
          id: string
          name: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          employee_id: string
          enabled?: boolean
          id?: string
          name?: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          enabled?: boolean
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_education: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          institution: string
          level: string
          major: string
          sort_order: number
          year: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          institution?: string
          level?: string
          major?: string
          sort_order?: number
          year?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          institution?: string
          level?: string
          major?: string
          sort_order?: number
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_education_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_work_history: {
        Row: {
          company: string
          created_at: string
          employee_id: string
          end_date: string
          id: string
          position: string
          reason: string
          sort_order: number
          start_date: string
        }
        Insert: {
          company?: string
          created_at?: string
          employee_id: string
          end_date?: string
          id?: string
          position?: string
          reason?: string
          sort_order?: number
          start_date?: string
        }
        Update: {
          company?: string
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          position?: string
          reason?: string
          sort_order?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_work_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string
          avatar: string
          avatar_color: string
          avatar_text_color: string
          birth_date: string
          blood_group: string
          children: number | null
          children_after_2018: number | null
          created_at: string
          dept: string
          email: string
          emergency_name: string
          emergency_phone: string
          emergency_relation: string
          employee_type: string
          face_scan_id: string
          father_name: string
          father_phone: string
          first_name: string
          home_address: string
          id: string
          id_expire_date: string
          id_issue_date: string
          initial_password: string
          last_name: string
          marital_status: string
          mother_name: string
          mother_phone: string
          national_id: string
          nationality: string
          nickname: string
          phone: string
          photo_url: string | null
          position: string
          position_id: string | null
          prefix: string
          pvd_rate: number | null
          religion: string
          role: string
          salary: string
          shift: string
          spouse_name: string
          spouse_phone: string
          start_date: string
          status: string
          tax_deductions: Json | null
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          address?: string
          avatar?: string
          avatar_color?: string
          avatar_text_color?: string
          birth_date?: string
          blood_group?: string
          children?: number | null
          children_after_2018?: number | null
          created_at?: string
          dept?: string
          email?: string
          emergency_name?: string
          emergency_phone?: string
          emergency_relation?: string
          employee_type?: string
          face_scan_id?: string
          father_name?: string
          father_phone?: string
          first_name?: string
          home_address?: string
          id?: string
          id_expire_date?: string
          id_issue_date?: string
          initial_password?: string
          last_name?: string
          marital_status?: string
          mother_name?: string
          mother_phone?: string
          national_id?: string
          nationality?: string
          nickname?: string
          phone?: string
          photo_url?: string | null
          position?: string
          position_id?: string | null
          prefix?: string
          pvd_rate?: number | null
          religion?: string
          role?: string
          salary?: string
          shift?: string
          spouse_name?: string
          spouse_phone?: string
          start_date?: string
          status?: string
          tax_deductions?: Json | null
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Update: {
          address?: string
          avatar?: string
          avatar_color?: string
          avatar_text_color?: string
          birth_date?: string
          blood_group?: string
          children?: number | null
          children_after_2018?: number | null
          created_at?: string
          dept?: string
          email?: string
          emergency_name?: string
          emergency_phone?: string
          emergency_relation?: string
          employee_type?: string
          face_scan_id?: string
          father_name?: string
          father_phone?: string
          first_name?: string
          home_address?: string
          id?: string
          id_expire_date?: string
          id_issue_date?: string
          initial_password?: string
          last_name?: string
          marital_status?: string
          mother_name?: string
          mother_phone?: string
          national_id?: string
          nationality?: string
          nickname?: string
          phone?: string
          photo_url?: string | null
          position?: string
          position_id?: string | null
          prefix?: string
          pvd_rate?: number | null
          religion?: string
          role?: string
          salary?: string
          shift?: string
          spouse_name?: string
          spouse_phone?: string
          start_date?: string
          status?: string
          tax_deductions?: Json | null
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          days: number
          employee_id: string
          has_file: boolean
          id: string
          leave_type_id: string
          leave_type_name: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from?: string
          date_to?: string
          days?: number
          employee_id: string
          has_file?: boolean
          id?: string
          leave_type_id: string
          leave_type_name?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          days?: number
          employee_id?: string
          has_file?: boolean
          id?: string
          leave_type_id?: string
          leave_type_name?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          quota: number
          require_doc: boolean
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          quota?: number
          require_doc?: boolean
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          quota?: number
          require_doc?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          date: string
          employee_id: string
          end_time: string
          hours: number
          id: string
          ot_type: string
          reason: string
          start_time: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          date?: string
          employee_id: string
          end_time?: string
          hours?: number
          id?: string
          ot_type?: string
          reason?: string
          start_time?: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          end_time?: string
          hours?: number
          id?: string
          ot_type?: string
          reason?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          affiliation_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          affiliation_id: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          affiliation_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_affiliation_id_fkey"
            columns: ["affiliation_id"]
            isOneToOne: false
            referencedRelation: "affiliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_add: boolean
          can_approve: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role_description: string
          role_name: string
          scope: string
          updated_at: string
        }
        Insert: {
          can_add?: boolean
          can_approve?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role_description?: string
          role_name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          can_add?: boolean
          can_approve?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role_description?: string
          role_name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_edit_requests: {
        Row: {
          attendance_id: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          new_check_in: string
          new_check_out: string
          original_check_in: string
          original_check_out: string
          reason: string
          status: string
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          new_check_in?: string
          new_check_out?: string
          original_check_in?: string
          original_check_out?: string
          reason?: string
          status?: string
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          new_check_in?: string
          new_check_out?: string
          original_check_in?: string
          original_check_out?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_edit_requests_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_edit_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_leave: { Args: { _user_id: string }; Returns: boolean }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "hr"
        | "manager"
        | "employee"
        | "accountant"
        | "executive"
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
      app_role: [
        "admin",
        "hr",
        "manager",
        "employee",
        "accountant",
        "executive",
      ],
    },
  },
} as const
