export type Role = "owner" | "admin" | "subscriber";
export type Address = { line: string; city: string; instructions?: string };
export type Business = {
  version: number;
  id: string;
  slug: string;
  name: string;
  timezone: string;
  cutoff: string;
};
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  version: number;
  user_id: string | null;
};
export type Slot = {
  id: string;
  name: string;
  start_time: string;
  active: boolean;
};
export type Package = {
  id: string;
  name: string;
  deliveries: number;
  validity_days: number | null;
  active: boolean;
  version: number;
};
export type Menu = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
};
export type Offering = {
  service_date: string;
  slot_id: string;
  menu_id: string;
  is_default: boolean;
};
export type Delivery = {
  pattern_id: string | null;
  id: string;
  customer_id: string;
  grant_id: string;
  service_date: string;
  slot_id: string;
  menu_id: string | null;
  menu_name: string | null;
  selection_source: string | null;
  address: Address;
  cutoff_at: string;
  status: string;
  version: number;
  delivered_at: string | null;
};
export type Grant = {
  created_at: string;
  id: string;
  customer_id: string;
  purchase_id: string;
  starts_on: string;
  expires_on: string | null;
  remaining: number;
  reserved: number;
  available: number;
};
export type Purchase = {
  id: string;
  customer_id: string;
  terms: Package;
  external_reference: string;
  starts_on: string;
  created_at: string;
};
export type LedgerEntry = {
  id: string;
  grant_id: string;
  delivery_id: string | null;
  amount: number;
  kind: string;
  reason: string | null;
  created_at: string;
};
export type DeliveryEvent = {
  id: string;
  delivery_id: string;
  kind: string;
  details: Record<string, unknown>;
  created_at: string;
};
export type ProductionEntry = {
  id: string;
  customer_id: string;
  customer: string;
  menu_id: string | null;
  menu: string | null;
  address: Address;
};
export type Production = {
  id: string;
  service_date: string;
  slot_id: string;
  revision: number;
  entries: ProductionEntry[];
  changes: {
    id: string;
    before: ProductionEntry | null;
    after: ProductionEntry | null;
  }[];
  incomplete: number;
  reason: string;
  created_at: string;
};
export type Pattern = {
  version: number;
  id: string;
  customer_id: string;
  starts_on: string;
  ends_on: string;
  weekdays: number[];
  slots: string[];
};
export type Snapshot = {
  patterns: Pattern[];
  business: Business;
  role: Role;
  customer_id: string | null;
  now: string;
  customers: Customer[];
  slots: Slot[];
  packages: Package[];
  menus: Menu[];
  offerings: Offering[];
  deliveries: Delivery[];
  grants: Grant[];
  purchases: Purchase[];
  ledger: LedgerEntry[];
  events: DeliveryEvent[];
  production: Production[];
  exceptions: {
    service_date: string;
    cutoff_at: string | null;
    closed: boolean;
  }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    accepted_at: string | null;
  }[];
  memberships: { user_id: string; role: string; email: string }[];
};
export type Workspace = Business & { role: Role };
export type CommandResult =
  | { ok: true; result: { id?: string; applied?: number; unchanged?: boolean } }
  | { ok: false; code: string };
