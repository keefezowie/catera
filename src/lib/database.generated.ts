// Generated from the migration's information_schema by npm run db:types. Do not edit.
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
      audit_events: {
        Row: {
          id: string;
          business_id: string;
          actor_id: string | null;
          action: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          actor_id?: string | null;
          action: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          actor_id?: string | null;
          action?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          timezone: string;
          cutoff: string;
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          timezone?: string;
          cutoff?: string;
          version?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          timezone?: string;
          cutoff?: string;
          version?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      command_receipts: {
        Row: {
          business_id: string;
          actor_id: string;
          request_id: string;
          action: string;
          payload: Json;
          result: Json;
        };
        Insert: {
          business_id: string;
          actor_id: string;
          request_id: string;
          action: string;
          payload: Json;
          result: Json;
        };
        Update: {
          business_id?: string;
          actor_id?: string;
          request_id?: string;
          action?: string;
          payload?: Json;
          result?: Json;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          name: string;
          email: string;
          phone: string;
          address: Json;
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          name: string;
          email?: string;
          phone?: string;
          address?: Json;
          version?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string | null;
          name?: string;
          email?: string;
          phone?: string;
          address?: Json;
          version?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      date_exceptions: {
        Row: {
          business_id: string;
          service_date: string;
          cutoff_at: string | null;
          closed: boolean;
        };
        Insert: {
          business_id: string;
          service_date: string;
          cutoff_at?: string | null;
          closed?: boolean;
        };
        Update: {
          business_id?: string;
          service_date?: string;
          cutoff_at?: string | null;
          closed?: boolean;
        };
        Relationships: [];
      };
      deliveries: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          grant_id: string;
          pattern_id: string | null;
          service_date: string;
          slot_id: string;
          menu_id: string | null;
          menu_name: string | null;
          selection_source: string | null;
          address: Json;
          cutoff_at: string;
          status: string;
          version: number;
          delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          grant_id: string;
          pattern_id?: string | null;
          service_date: string;
          slot_id: string;
          menu_id?: string | null;
          menu_name?: string | null;
          selection_source?: string | null;
          address: Json;
          cutoff_at: string;
          status?: string;
          version?: number;
          delivered_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          grant_id?: string;
          pattern_id?: string | null;
          service_date?: string;
          slot_id?: string;
          menu_id?: string | null;
          menu_name?: string | null;
          selection_source?: string | null;
          address?: Json;
          cutoff_at?: string;
          status?: string;
          version?: number;
          delivered_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      delivery_events: {
        Row: {
          id: string;
          business_id: string;
          delivery_id: string;
          kind: string;
          details: Json;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          delivery_id: string;
          kind: string;
          details?: Json;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          delivery_id?: string;
          kind?: string;
          details?: Json;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      delivery_slots: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          start_time: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          start_time: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          start_time?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      health_checks: {
        Row: {
          id: string;
          checked_at: string;
          discrepancies: Json;
        };
        Insert: {
          id?: string;
          checked_at?: string;
          discrepancies: Json;
        };
        Update: {
          id?: string;
          checked_at?: string;
          discrepancies?: Json;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          business_id: string;
          email: string;
          role: string;
          customer_id: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          email: string;
          role: string;
          customer_id?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          email?: string;
          role?: string;
          customer_id?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          business_id: string;
          user_id: string;
          role: string;
        };
        Insert: {
          business_id: string;
          user_id: string;
          role: string;
        };
        Update: {
          business_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      menu_offerings: {
        Row: {
          business_id: string;
          service_date: string;
          slot_id: string;
          menu_id: string;
          is_default: boolean;
        };
        Insert: {
          business_id: string;
          service_date: string;
          slot_id: string;
          menu_id: string;
          is_default?: boolean;
        };
        Update: {
          business_id?: string;
          service_date?: string;
          slot_id?: string;
          menu_id?: string;
          is_default?: boolean;
        };
        Relationships: [];
      };
      menus: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string;
          active: boolean;
          version: number;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string;
          active?: boolean;
          version?: number;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string;
          active?: boolean;
          version?: number;
        };
        Relationships: [];
      };
      packages: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          deliveries: number;
          validity_days: number | null;
          active: boolean;
          version: number;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          deliveries: number;
          validity_days?: number | null;
          active?: boolean;
          version?: number;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          deliveries?: number;
          validity_days?: number | null;
          active?: boolean;
          version?: number;
        };
        Relationships: [];
      };
      production_versions: {
        Row: {
          id: string;
          business_id: string;
          service_date: string;
          slot_id: string;
          revision: number;
          entries: Json;
          changes: Json;
          incomplete: number;
          reason: string;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          service_date: string;
          slot_id: string;
          revision: number;
          entries: Json;
          changes?: Json;
          incomplete: number;
          reason: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_date?: string;
          slot_id?: string;
          revision?: number;
          entries?: Json;
          changes?: Json;
          incomplete?: number;
          reason?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          package_id: string;
          terms: Json;
          external_reference: string;
          starts_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          package_id: string;
          terms: Json;
          external_reference?: string;
          starts_on: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          package_id?: string;
          terms?: Json;
          external_reference?: string;
          starts_on?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      quota_grants: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          purchase_id: string;
          starts_on: string;
          expires_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          purchase_id: string;
          starts_on: string;
          expires_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          purchase_id?: string;
          starts_on?: string;
          expires_on?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quota_ledger: {
        Row: {
          id: string;
          business_id: string;
          grant_id: string;
          delivery_id: string | null;
          amount: number;
          kind: string;
          reverses_id: string | null;
          reason: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          grant_id: string;
          delivery_id?: string | null;
          amount: number;
          kind: string;
          reverses_id?: string | null;
          reason?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          grant_id?: string;
          delivery_id?: string | null;
          amount?: number;
          kind?: string;
          reverses_id?: string | null;
          reason?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quota_reservations: {
        Row: {
          business_id: string;
          delivery_id: string;
          grant_id: string;
        };
        Insert: {
          business_id: string;
          delivery_id: string;
          grant_id: string;
        };
        Update: {
          business_id?: string;
          delivery_id?: string;
          grant_id?: string;
        };
        Relationships: [];
      };
      schedule_patterns: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          starts_on: string;
          ends_on: string;
          weekdays: number[];
          slots: string[];
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          starts_on: string;
          ends_on: string;
          weekdays: number[];
          slots: string[];
          version?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          starts_on?: string;
          ends_on?: string;
          weekdays?: number[];
          slots?: string[];
          version?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      execute_command: {
        Args: {
          business_slug: string;
          action: string;
          payload: Json;
          request_id: string;
        };
        Returns: Json;
      };
      workspace_snapshot: { Args: { business_slug: string }; Returns: Json };
      list_workspaces: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
