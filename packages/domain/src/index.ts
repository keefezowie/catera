import { z } from "zod";

export const mealTypes = ["lunch", "dinner", "both"] as const;
export type MealType = (typeof mealTypes)[number];
export type Locale = "id" | "en";
export type Actor = {
  id: string;
  name: string;
  role: "customer" | "owner" | "staff" | "platform_admin";
  catererId?: string;
};
export type Address = {
  id: string;
  label: string;
  line: string;
  area: string;
  city: string;
  instructions: string;
  version: number;
};
export type Caterer = {
  id: string;
  slug: string;
  name: string;
  description: string;
  area: string[];
  status: string;
  cutoff: string;
  timezone: string;
  version: number;
  review_note?: string;
  offers?: Offer[];
};
export type Offer = {
  id: string;
  slug: string;
  catererId: string;
  caterer: string;
  catererSlug: string;
  name: string;
  description: string;
  price: number;
  days: number;
  meal: MealType;
  weekdays: number[];
  flexible: boolean;
  image: string;
  tags: string[];
  trialPrice: number | null;
  trialMax: number | null;
  tiers: { min: number; percent: number }[];
  capacity: Record<string, number>;
  windows: { lunch: string; dinner: string };
  areas: string[];
  cutoff: string;
  timezone: string;
  menus: { name: string; description: string; image: string; meal: string }[];
  rating: number | null;
  reviewCount: number;
  status: string;
  sellerStatus: string;
  version: number;
};
export type Quote = {
  packageId: string;
  portions: number;
  trial: boolean;
  dates: string[];
  subtotal: number;
  discount: number;
  discountPercent: number;
  promotion: number;
  serviceFee: number;
  total: number;
  perDay: number;
  sellerFee: number;
  source: string;
  offer: Offer;
};
export type Subscription = {
  id: string;
  package_id: string;
  snapshot: Quote;
  portions: number;
  starts_on: string;
  ends_on: string;
  status: string;
  remaining: number;
  legacy: boolean;
};
export type Delivery = {
  id: string;
  subscription_id: string;
  service_date: string;
  address: Address;
  status: string;
  version: number;
  portions: number;
  trial: boolean;
  offer: Offer;
  meals: { meal: string; status: string }[];
  cutoff_at: string;
  canChange: boolean;
};
export type Checkout = {
  id: string;
  state: string;
  quote: Quote;
  expires_at: string;
  subscription_id: string | null;
  payment_url: string | null;
};
export type SupportCase = {
  id: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
  delivery_id: string | null;
  subscription_id: string | null;
  user_id: string;
  caterer_id: string;
  resolution: string | null;
  amount: number | null;
};
export type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type Conversation = {
  id: string;
  caterer_id: string;
  customer_id: string;
  caterer: string;
  customer: string;
  messages: Message[];
};
export type Notice = {
  id: string;
  kind: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};
export type CustomerState = {
  subscriptions: Subscription[];
  deliveries: Delivery[];
  addresses: Address[];
  notifications: Notice[];
  cases: SupportCase[];
};
export type SellerState = {
  caterer: Caterer;
  offers: Offer[];
  deliveries: Delivery[];
  cases: SupportCase[];
  customers: { id: string; name: string; source: string }[];
  transactions: {
    id: string;
    state: string;
    quote: Quote;
    created_at: string;
  }[];
  staff: { user_id: string; name: string; role: string }[];
  payouts: { id: string; amount: number; status: string; created_at: string }[];
};
export type AdminState = {
  caterers: Caterer[];
  cases: SupportCase[];
  transactions: {
    id: string;
    state: string;
    quote: Quote;
    created_at: string;
  }[];
  audit: {
    id: string;
    action: string;
    created_at: string;
    actor_id: string;
    details: unknown;
  }[];
  promotions: { id: string; code: string; percent: number; active: boolean }[];
  payouts: { id: string; caterer_id: string; amount: number; status: string }[];
  reviews: { id: string; body: string; rating: number; hidden: boolean }[];
  refunds: {
    id: string;
    amount: number;
    state: string;
    case_id: string;
    reconciliation?: unknown;
  }[];
};

export const addressSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(40),
  line: z.string().trim().min(5).max(240),
  area: z.string().min(1),
  city: z.string().min(1),
  instructions: z.string().max(400).default(""),
  version: z.number().int().optional(),
});
export const checkoutSchema = z.object({
  packageId: z.uuid(),
  addressId: z.uuid(),
  portions: z.number().int().min(1).max(100),
  startDate: z.iso.date(),
  trial: z.boolean().default(false),
  promo: z.string().max(40).default(""),
  invite: z.string().max(100).default(""),
  expectedQuote: z.record(z.string(), z.unknown()).optional(),
});
export const commandSchema = z.object({
  action: z.string().min(1).max(60),
  payload: z.record(z.string(), z.unknown()),
  requestId: z.uuid(),
});
export const offerSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(1500),
  price: z.number().int().min(1000),
  days: z.number().int().min(1).max(60),
  meal: z.enum(mealTypes),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  flexible: z.boolean(),
  trialPrice: z.number().int().min(1000).nullable(),
  trialMax: z.number().int().min(1).nullable(),
  capacity: z.record(z.string(), z.number().int().min(0)),
  tiers: z.array(
    z.object({
      min: z.number().int().min(1),
      percent: z.number().min(0).max(90),
    }),
  ),
  windows: z.object({ lunch: z.string().min(3), dinner: z.string().min(3) }),
  tags: z.array(z.string().max(40)),
  image: z.string().max(500),
  menus: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      image: z.string(),
      meal: z.string(),
    }),
  ),
  status: z.enum(["draft", "published", "paused", "retired"]),
});
export const areaOptions = [
  "Jakarta Selatan",
  "Jakarta Pusat",
  "Jakarta Barat",
  "Jakarta Timur",
  "Jakarta Utara",
  "Tangerang Selatan",
  "Bandung",
];
export function currency(n: number, locale: Locale = "id") {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
export function localDay(now = new Date(), timezone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function schedule(
  start: string,
  days: number,
  weekdays: number[],
  closed: string[] = [],
) {
  const result: string[] = [];
  if (!weekdays.length) throw new Error("NO_OPERATING_DAYS");
  for (let i = 0; i < 730 && result.length < days; i++) {
    const d = addDays(start, i);
    if (
      weekdays.includes(new Date(d + "T12:00:00Z").getUTCDay()) &&
      !closed.includes(d)
    )
      result.push(d);
  }
  if (result.length !== days) throw new Error("NO_AVAILABILITY");
  return result;
}
export function price(
  offer: Pick<Offer, "price" | "days" | "tiers" | "trialPrice">,
  portions: number,
  trial = false,
) {
  const percent = trial
    ? 0
    : Math.max(
        0,
        ...offer.tiers.filter((t) => portions >= t.min).map((t) => t.percent),
      );
  const subtotal =
    (trial ? (offer.trialPrice ?? offer.price) : offer.price * offer.days) *
    portions;
  const discount = Math.round((subtotal * percent) / 100);
  return {
    subtotal,
    discount,
    discountPercent: percent,
    total: subtotal - discount,
  };
}
export const mealLabel = (meal: string, locale: Locale = "id") =>
  ({
    lunch: locale === "id" ? "Makan siang" : "Lunch",
    dinner: locale === "id" ? "Makan malam" : "Dinner",
    both: locale === "id" ? "Siang + malam" : "Lunch + dinner",
  })[meal] || meal;
export const statusLabel = (status: string, locale: Locale = "id") =>
  locale === "en"
    ? status.replaceAll("_", " ")
    : {
        scheduled: "Terjadwal",
        preparing: "Disiapkan",
        out_for_delivery: "Dalam pengantaran",
        delivered: "Terkirim",
        issue: "Ada kendala",
        pending: "Menunggu pembayaran",
        paid: "Dibayar",
        expired: "Kedaluwarsa",
        active: "Aktif",
        completed: "Selesai",
        cancelled: "Dibatalkan",
        open: "Menunggu respons",
        responded: "Ditanggapi katerer",
        escalated: "Ditinjau Catera",
        resolved: "Selesai",
        draft: "Draf",
        submitted: "Diajukan",
        corrections: "Perlu perbaikan",
        approved: "Disetujui",
        suspended: "Ditangguhkan",
        published: "Tayang",
        paused: "Dijeda",
        retired: "Diarsipkan",
        refunded: "Dikembalikan",
        payment_exception: "Pembayaran perlu ditinjau",
      }[status] || status;
export const errors: Record<string, string> = {
  PRICE_CHANGED: "Harga atau ketentuan berubah. Tinjau ulang sebelum membayar.",
  UNAUTHORIZED: "Silakan masuk kembali.",
  FORBIDDEN: "Akun ini tidak memiliki akses.",
  CAPACITY:
    "Porsi pada salah satu tanggal sudah habis. Pilih tanggal mulai atau jumlah porsi lain.",
  CUTOFF: "Batas perubahan sudah lewat. Pilih tanggal berikutnya.",
  COVERAGE: "Alamat ini berada di luar area pengantaran katerer.",
  CONFLICT: "Data sudah berubah. Muat ulang sebelum mencoba lagi.",
  OVERLAP: "Paket yang sama masih berjalan pada rentang tanggal ini.",
  TRIAL_USED: "Anda sudah pernah membeli trial dari katerer ini.",
  FIXED_PACKAGE:
    "Jadwal paket ini tetap. Hubungi katerer jika membutuhkan bantuan.",
  DUPLICATE_DATE:
    "Langganan ini sudah memiliki pengantaran pada tanggal tersebut.",
  INVALID_DATE: "Tanggal tidak sesuai hari operasional paket.",
  INVALID_INPUT: "Periksa kembali data yang Anda masukkan.",
  NOT_FOUND: "Data tidak ditemukan.",
  NOT_CONFIGURED: "Layanan ini belum dikonfigurasi. Silakan hubungi Catera.",
  PAYMENT_PENDING: "Pembayaran belum terkonfirmasi.",
  AMOUNT_INVALID: "Jumlah melebihi nilai yang dapat dikembalikan.",
  BOOKED_DATE:
    "Tanggal ini memiliki pesanan. Selesaikan pesanan sebelum menutupnya.",
};
