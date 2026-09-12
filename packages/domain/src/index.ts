import { z } from "zod";
import {
  menuSchema,
  nutritionSchema,
  contentsIssues,
  type MealMenu,
  type Nutrition,
  type PackageType,
  type ContentRevision,
  type DatedMenu,
} from "./contents";
export * from "./contents";
export * from "./package-presentation";
export * from "./offer-editor";

export const mealTypes = ["lunch", "dinner", "both"] as const;
export type MealType = (typeof mealTypes)[number];
export type Locale = "id" | "en";
export type WorkspaceMode = "customer" | "caterer";
export type Workspace = WorkspaceMode | "admin";
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
  menus: MealMenu[];
  nutrition?: Nutrition | null;
  packageType?: PackageType | null;
  contentRevision?: number;
  rating: number | null;
  reviewCount: number;
  status: string;
  canArchive?: boolean;
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
export * from "./seller-operations";
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
  calendarMeta?: {
    nextDeliveryDate: string | null;
    lastUpcomingDeliveryDate: string | null;
  };
  subscriptions: Subscription[];
  deliveries: Delivery[];
  addresses: Address[];
  notifications: Notice[];
  cases: SupportCase[];
};
export type SellerState = {
  categories?: import("./contents").DishCategory[];
  dishes?: import("./contents").LibraryDish[];
  contentRevisions?: ContentRevision[];
  datedMenus?: DatedMenu[];
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
export const offerSchema = z
  .object({
    name: z.string().trim().max(100),
    description: z.string().trim().max(1500),
    price: z.number().int().min(1000).max(10000000),
    days: z.number().int().min(1).max(60),
    meal: z.enum(mealTypes),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
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
    packageType: z.enum(["ala_carte", "nasi_box"]).nullable().optional(),
    menus: z.array(menuSchema).max(2),
    nutrition: nutritionSchema.nullable().optional(),
    status: z.enum(["draft", "published", "suspended", "retired"]),
  })
  .superRefine((o, ctx) => {
    const complete = o.status !== "draft";
    for (const [key, min] of [
      ["name", 3],
      ["description", 10],
    ] as const)
      if ((complete || o[key].length > 0) && o[key].length < min)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Minimal ${min} karakter / At least ${min} characters`,
        });
    if (complete && !o.weekdays.length)
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Pilih hari pengantaran / Choose operating days",
      });
    if (complete && !o.image.trim())
      ctx.addIssue({
        code: "custom",
        path: ["image"],
        message: "Unggah foto paket / Upload a package photo",
      });
    for (const d of o.weekdays)
      if (o.capacity[String(d)] === undefined)
        ctx.addIssue({
          code: "custom",
          path: ["capacity"],
          message: "Isi kapasitas / Enter capacity",
        });
    const activeCapacity = o.weekdays.map((d) => o.capacity[String(d)]);
    if (
      activeCapacity.every(
        (capacity): capacity is number => capacity !== undefined,
      ) &&
      new Set(activeCapacity).size > 1
    )
      ctx.addIssue({
        code: "custom",
        path: ["capacity"],
        message:
          "Kapasitas harus sama untuk semua hari operasional / Capacity must be the same for every operating day",
      });
    for (const message of contentsIssues(o, o.status !== "draft"))
      ctx.addIssue({ code: "custom", path: ["menus"], message });
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
    ? {
        scheduled: "Scheduled",
        preparing: "Preparing",
        out_for_delivery: "Out for delivery",
        delivered: "Delivered",
        issue: "Issue reported",
        pending: "Payment pending",
        paid: "Paid",
        expired: "Expired",
        active: "Active",
        completed: "Completed",
        cancelled: "Cancelled",
        open: "Awaiting response",
        responded: "Caterer responded",
        escalated: "Under Catera review",
        resolved: "Resolved",
        draft: "Draft",
        submitted: "Submitted",
        corrections: "Needs changes",
        approved: "Approved",
        suspended: "Suspended",
        published: "Published",
        paused: "Paused",
        retired: "Archived",
        refunded: "Refunded",
        payment_exception: "Payment under review",
      }[status] || status.replaceAll("_", " ")
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
  CLASSIFY_PACKAGE:
    "Pilih jenis paket dan lengkapi isi paket sebelum menyimpan.",
  COMPOSITION_CHANGED:
    "Isi menu harus sesuai komposisi yang dibeli. Gunakan versi isi paket yang benar.",
  PRICE_CHANGED: "Harga atau ketentuan berubah. Tinjau ulang sebelum membayar.",
  UNAUTHORIZED: "Silakan masuk kembali.",
  INVALID_CREDENTIALS: "Email atau kata sandi tidak cocok. Silakan coba lagi.",
  AUTH_RATE_LIMITED:
    "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.",
  FORBIDDEN: "Akun ini tidak memiliki akses.",
  PACKAGE_IMMUTABLE:
    "Paket yang sudah tayang tidak dapat diubah. Buat paket baru.",
  SUSPEND_FIRST: "Tangguhkan paket sebelum mengarsipkannya.",
  PACKAGE_HAS_DELIVERIES:
    "Selesaikan seluruh pengantaran dan tunggu pembayaran tertunda sebelum mengarsipkan paket.",
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
const errorsEn: Record<string, string> = {
  CLASSIFY_PACKAGE:
    "Choose a package type and complete the package contents before saving.",
  COMPOSITION_CHANGED:
    "The menu must match the purchased composition. Use the correct package revision.",
  PRICE_CHANGED: "The price or terms changed. Review them before paying.",
  UNAUTHORIZED: "Please sign in again.",
  INVALID_CREDENTIALS: "Email or password is incorrect. Please try again.",
  AUTH_RATE_LIMITED: "Too many sign-in attempts. Please wait and try again.",
  FORBIDDEN: "This account does not have access.",
  PACKAGE_IMMUTABLE:
    "Published packages cannot be edited. Create a new package.",
  SUSPEND_FIRST: "Suspend the package before archiving it.",
  PACKAGE_HAS_DELIVERIES:
    "Complete all deliveries and wait for pending payments before archiving this package.",
  CAPACITY:
    "One or more dates no longer have enough capacity. Choose another start date or portion count.",
  CUTOFF: "The change cutoff has passed. Choose a later date.",
  COVERAGE: "This address is outside the caterer's delivery area.",
  CONFLICT: "The data changed. Reload before trying again.",
  OVERLAP: "The same package is already active during these dates.",
  TRIAL_USED: "You have already bought a trial from this caterer.",
  FIXED_PACKAGE: "This package has fixed dates. Contact the caterer for help.",
  DUPLICATE_DATE: "This subscription already has a delivery on that date.",
  INVALID_DATE: "The date is not an operating day for this package.",
  INVALID_INPUT: "Check the information you entered.",
  NOT_FOUND: "The requested data was not found.",
  NOT_CONFIGURED: "This service is not configured. Please contact Catera.",
  PAYMENT_PENDING: "Payment has not been confirmed.",
  AMOUNT_INVALID: "The amount exceeds the refundable balance.",
  BOOKED_DATE: "This date has orders. Complete them before closing the date.",
};
export function errorLabel(code: string, locale: Locale = "id") {
  return (locale === "en" ? errorsEn[code] : errors[code]) || "";
}
export function localizedMessage(message: string, locale: Locale = "id") {
  const separator = " / ";
  const split = message.indexOf(separator);
  if (split < 0) return message;
  return locale === "en"
    ? message.slice(split + separator.length)
    : message.slice(0, split);
}
