import type { Address, Delivery, Offer, Quote } from "./index";
export type CustomerSubscription = {
  trial: boolean;
  id: string;
  package_id: string;
  package_name: string;
  meal: string;
  portions: number;
  starts_on: string;
  ends_on: string;
  status: string;
  remaining: number;
  next_delivery: string | null;
  legacy: boolean;
  renewed_from: string | null;
  external_reference: string | null;
  payment_route: "external_reported" | "catera";
  renewal_status: "unknown" | "declined" | "external_reported" | "catera";
  prepared_at: string | null;
  deliveries: Delivery[];
};
export type SellerCustomer = {
  id: string;
  caterer_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  address: Partial<Address>;
  origin: "seller" | "marketplace";
  version: number;
  claim_review: string | null;
  subscriptions: CustomerSubscription[];
};
export type SellerCustomersState = {
  customers: SellerCustomer[];
  total: number;
  packages: Offer[];
};
export type PilotImportRow = {
  customerRecordId?: string;
  customerId?: string;
  addressId?: string;
  customer?: { name: string; phone: string; address: Partial<Address> };
  address?: Partial<Address>;
  packageId: string;
  portions: number;
  startDate: string;
  remainingDays: number;
  externalReference: string;
  externalAmount?: number | null;
  renewedFrom?: string;
};
export type PilotImportPreview = {
  id: string;
  rows: (PilotImportRow & {
    preview: Quote;
    customerName: string;
    newCustomer: boolean;
  })[];
};
export type RenewalContext = {
  cycles?: number;
  dates?: string[];
  bookingThrough?: string;
  minimumStartDate?: string;
  pendingCheckoutId?: string | null;
  subscriptionId: string;
  packageId: string;
  portions: number;
  address: Address;
  addressId: string | null;
  startDate: string;
  replacementRequired: boolean;
  available: boolean;
  offers: Offer[];
};
export type PilotPricing = {
  id: string;
  model: "transaction" | "monthly";
  cohort: string;
  effective_at: string;
  service_fee: number;
  marketplace_percent: number;
  invited_percent: number;
  monthly_fee: number;
  approved: boolean;
  synthetic: boolean;
  reason: string;
};
export type PilotInvoice = {
  id: string;
  pricing_id: string;
  period: string;
  amount: number;
  entries: {
    id: string;
    kind: "payment" | "refund" | "adjustment";
    amount: number;
    reference: string;
    created_at: string;
  }[];
};
export type PilotMetrics = {
  dataMode: "synthetic" | "commercial";
  unclassifiedGmv: number;
  sellerRetention: {
    day: number;
    mature: boolean;
    stillEnrolled: boolean | null;
    paid: boolean | null;
  }[];
  from: string;
  to: string;
  processedGmv: number;
  platformFees: number;
  monthlyCollected: number;
  promotionCosts: number;
  recordedCosts: number;
  refundCosts: number;
  missingCosts: string[];
  contribution: number | null;
  onboardingCosts: number | null;
  acquisitionCosts: number | null;
  baselineMinutesPerDay: number | null;
  currentMinutesPerDay: number | null;
  assistanceMinutes: number | null;
  deliveryIssues: number;
  cohorts: {
    origin: "seller" | "marketplace";
    payments: number;
    gmv: number;
    fees: number;
  }[];
  renewals: {
    eligible: number;
    catera: number;
    externalReported: number;
    unknown: number;
  };
};
export type PilotState = {
  policies: PilotPricing[];
  invoices: PilotInvoice[];
  metrics: PilotMetrics | null;
  enrollment: {
    starts_on: string;
    ends_on: string;
    exited_on: string | null;
    reference: string;
  } | null;
  readiness: {
    schema: string;
    lastMaintenance: string | null;
    syntheticPolicy: boolean;
    approvedPolicy: boolean;
  };
  observations: {
    id: string;
    observed_on: string;
    kind: string;
    amount: number | null;
    minutes: number | null;
    reference: string;
  }[];
};

export function normalizeCustomerPhone(value: string) {
  const digits = value.replace(/[\s().-]/g, "");
  const result = digits.startsWith("0")
    ? "+62" + digits.slice(1)
    : digits.startsWith("62")
      ? "+" + digits
      : digits;
  if (!/^\+62\d{8,13}$/.test(result)) throw new Error("PHONE");
  return result;
}
/** Quoted CSV and Excel TSV; never evaluates formula cells. */
export function parsePilotTable(text: string): Record<string, string>[] {
  if (text.length > 140000) throw new Error("IMPORT_LIMIT");
  const separator = text.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === separator || c === "\n")) {
      row.push(cell.replace(/\r$/, "").trim());
      cell = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new Error("CSV_QUOTES");
  row.push(cell.replace(/\r$/, "").trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2 || rows.length > 101) throw new Error("IMPORT_LIMIT");
  const headers = rows.shift()!;
  if (new Set(headers).size !== headers.length) throw new Error("CSV_HEADERS");
  return rows.map((cells, index) => {
    if (cells.length !== headers.length)
      throw new Error(`ROW_${index + 2}_COLUMNS`);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}
export function pilotImportRows(
  text: string,
  offers: Offer[],
  customers: SellerCustomer[],
): PilotImportRow[] {
  return parsePilotTable(text).map((r, i) => {
    const field = (a: string, b: string) => r[a] || r[b] || "";
    const packageName = field("package", "paket");
    const matches = offers.filter(
      (p) =>
        p.id === packageName ||
        p.name.toLowerCase() === packageName.toLowerCase(),
    );
    if (matches.length !== 1) throw new Error(`ROW_${i + 2}_PACKAGE`);
    const name = field("name", "nama");
    let phone: string;
    try {
      phone = normalizeCustomerPhone(field("phone", "telepon"));
    } catch {
      throw new Error(`ROW_${i + 2}_PHONE`);
    }
    const existing = customers.filter(
      (c) => c.phone === phone && c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing.length > 1 || !name) throw new Error(`ROW_${i + 2}_CUSTOMER`);
    const address = {
      label: "Katering",
      line: field("line", "alamat"),
      area: r.area,
      city: field("city", "kota"),
      instructions: field("instructions", "catatan"),
    };
    const portions = Number(field("portions", "porsi")),
      remainingDays = Number(field("remainingDays", "sisaHari"));
    const startDate = field("startDate", "tanggalMulai"),
      externalReference = field("externalReference", "referensi");
    if (
      !Number.isInteger(portions) ||
      portions < 1 ||
      portions > 100 ||
      !Number.isInteger(remainingDays) ||
      remainingDays < 1 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !externalReference ||
      !address.line ||
      !address.area ||
      !address.city
    )
      throw new Error(`ROW_${i + 2}_FIELDS`);
    return {
      ...(existing[0]
        ? { customerRecordId: existing[0].id, address }
        : { customer: { name, phone, address } }),
      packageId: matches[0].id,
      portions,
      remainingDays,
      startDate,
      externalReference,
    };
  });
}
