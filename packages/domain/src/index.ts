import { z } from "zod";
import type {
  MealMenu,
  Nutrition,
  PackageType,
  ContentRevision,
  DatedMenu,
} from "./contents";
export * from "./contents";
export * from "./calendar";
export * from "./delivery-availability";
export * from "./package-presentation";
export * from "./offer-editor";
export * from "./pilot";
export * from "./purchase-pricing";
export * from "./purchase-commitment";
export * from "./resource-phase";
export * from "./customer-actions";
export * from "./settlement";
export * from "./saved-packages";
export * from "./dates";
export * from "./offer-schema";
import type { MealType } from "./offer-schema";

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
export { nextStartAfter, purchaseStartAvailable, startDates } from "./checkout-eligibility";
export { salesHistory } from "./sales-history";
export type Offer = {
  multiCycleAvailable?: boolean;
  durationPricing?: import("./purchase-pricing").DurationPricing;
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
  menuSelectionMode?: "caterer" | "customer";
  contentRevision?: number;
  rating: number | null;
  reviewCount: number;
  status: string;
  canArchive?: boolean;
  sellerStatus: string;
  version: number;
};
/** Only seller/admin draft reads can contain an unentered price. */
export type DraftOffer = Omit<Offer, "status" | "price"> & {
  status: "draft";
  price: number | null;
};
export type CompleteSellerOffer = Omit<Offer, "status"> & {
  status: "published" | "suspended" | "retired";
};
export type SellerOffer = DraftOffer | CompleteSellerOffer;
export type AdminCaterer = Omit<Caterer, "offers"> & {
  offers?: SellerOffer[];
};
export type Quote = {
  address?: Address;
  pricingVersion?: number;
  cycles?: number;
  daysPerCycle?: number;
  durationDiscount?: number;
  durationDiscountPercent?: number;
  packageNet?: number;
  sellerNet?: number;
  sellerFeePercent?: number;
  bookingThrough?: string;
  renewedFrom?: string | null;
  pricingPolicy?: {
    id: string;
    model: string;
    cohort: string;
    synthetic: boolean;
    [key: string]: unknown;
  };
  settlementModel?: string;
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
  renewed_from?: string | null;
  customer_record_id?: string | null;
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
export * from "./kitchen";
export * from "./customer-day";
export * from "./plan";
export * from "./journey";
export * from "./usage";
export { windowStartMinutes } from "./windows";
export * from "./seller-experience";
export * from "./customer-choice";
export type DeliveryMeal = {
  meal: "lunch" | "dinner";
  status: string;
  departed_at?: string | null;
  confirmed_at?: string | null;
  /** When the kitchen started cooking this meal; absent on meals set to "preparing" by the older status path. */
  cooking_started_at?: string | null;
  /** Who recorded the arrival: the customer, the system after the window ("auto"), or the caterer. */
  confirmed_by?: "customer" | "auto" | "caterer" | null;
  reaction?: "enak" | "biasa" | "kurang" | null;
  issue?: { id: string; status: string } | null;
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
  meals: DeliveryMeal[];
  cutoff_at: string;
  canChange: boolean;
  /** The caterer's verified WhatsApp number (E.164); present only on the customer's own deliveries. */
  catererPhone?: string | null;
};
export type Checkout = {
  payment_mode?: "hosted" | "direct";
  payment?: import("./payment").PaymentView;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  provider?: string | null;
  provider_environment?: string | null;
  provider_merchant?: string | null;
  customer_record_id?: string | null;
  id: string;
  state: string;
  quote: Quote;
  expires_at: string;
  subscription_id: string | null;
  payment_url: string | null;
};
export type SupportCase = {
  checkout_id?: string | null;
  customer_record_id?: string | null;
  customerName?: string | null;
  id: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
  delivery_id: string | null;
  subscription_id: string | null;
  user_id: string | null;
  caterer_id: string;
  resolution: string | null;
  amount: number | null;
};
export type DeliveryIssue = {
  id: string;
  day_id: string;
  meal: "lunch" | "dinner";
  subject: string;
  description: string;
  status: "open" | "responded" | "resolved" | "escalated";
  version: number;
  case_id: string | null;
  service_date: string;
  package_name: string;
  created_at: string;
  events: { id: string; action: string; body: string; created_at: string }[];
  /** Caterer reads only: who sent the report, and the number on the caterer's customer record. */
  customerName?: string | null;
  customerPhone?: string | null;
  customerRecordId?: string | null;
};
export type CustomerActionItem = {
  id: string;
  kind: "menu_choice_due" | "payment_action" | "delivery_issue";
  status:
    | "selection_due"
    | "choose_method"
    | "awaiting_payment"
    | "checking_payment"
    | "payment_exception"
    | "open"
    | "responded"
    | "escalated"
    /** A checkout whose hold ended unpaid; only in CustomerActionFeed.ended. */
    | "expired";
  priority: number;
  dueAt?: string;
  serviceDate?: string;
  meal?: "lunch" | "dinner";
  packageName?: string;
  catererName?: string;
  href: string;
  /** On an ended checkout: true when the payment failed rather than ran out of time. */
  paymentFailed?: boolean;
  /** On an ended checkout: the choices a new checkout for the same package starts from. */
  payAgain?: {
    packageId: string;
    renewedFrom?: string;
    trial: boolean;
    portions: number;
    cycles: number;
    addressId?: string;
  };
};
export type CustomerActionFeed = {
  total: number;
  items: CustomerActionItem[];
  /** Checkouts whose hold ended unpaid in the last 7 days, newest first ("expired", or
   * "checking_payment" while the bank may still confirm). Absent from older servers. */
  ended?: CustomerActionItem[];
};
export type SellerAttentionItem = {
  id: string;
  kind:
    | "delivery_issue"
    | "support"
    | "delivery"
    | "choice_fallback"
    | "choice_deadline"
    | "payment"
    | "production_changed";
  priority: number;
  at_time: string;
  context: string;
  href: string;
  serviceDate?: string;
  meal?: "lunch" | "dinner";
  packageName?: string;
  destination?: string;
  deliveryId?: string;
};
export type SellerAttentionPage = {
  timezone: string;
  total: number;
  items: SellerAttentionItem[];
  nextCursor: string | null;
};
export type SellerAttention = SellerAttentionPage;
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
  refunds?: {
    id: string;
    case_id: string;
    amount: number;
    state: string;
    customer_action_url: string | null;
    customer_action_expires_at: string | null;
  }[];
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
export type SellerImportOptions = {
  customers: {
    id: string;
    name: string;
    source: string;
    addresses: Address[];
  }[];
  packages: {
    id: string;
    name: string;
    days: number;
    areas: string[];
    meal: string;
  }[];
};
export type PrepaidImportRow = {
  customerId: string;
  packageId: string;
  addressId: string;
  portions: number;
  startDate: string;
  remainingDays: number;
  externalReference: string;
};
export type PrepaidImportPreview = {
  id: string;
  rows: (PrepaidImportRow & { preview: Quote & { address: Address } })[];
};
export type SellerState = {
  categories?: import("./contents").DishCategory[];
  dishes?: import("./contents").LibraryDish[];
  contentRevisions?: ContentRevision[];
  datedMenus?: DatedMenu[];
  caterer: Caterer;
  offers: SellerOffer[];
  deliveries: Delivery[];
  cases: SupportCase[];
  customers: { id: string; name: string; source: string }[];
  transactions: {
    user_id?: string | null;
    package_id?: string;
    address_id?: string | null;
    customerName?: string | null;
    id: string;
    state: string;
    quote: Quote;
    created_at: string;
  }[];
  staff: { user_id: string; name: string; role: string }[];
  payouts: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    settlement_run_id?: string | null;
  }[];
};
export type AdminState = {
  providerOperations?: {
    kind: string;
    entity_id: string;
    state: string;
    error_code: string | null;
    created_at: string;
  }[];
  caterers: AdminCaterer[];
  cases: SupportCase[];
  transactions: {
    customerName?: string | null;
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
    actorName?: string | null;
    details: unknown;
  }[];
  promotions: { id: string; code: string; percent: number; active: boolean }[];
  payouts: {
    settlement_run_id?: string | null;
    id: string;
    caterer_id: string;
    catererName?: string | null;
    amount: number;
    status: string;
  }[];
  reviews: { id: string; body: string; rating: number; hidden: boolean }[];
  refunds: {
    attention_reason?: string | null;
    customer_action_url?: string | null;
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
  acceptedTerms: z.boolean().optional(),
  cycles: z.number().int().min(1).max(6).default(1),
  renewedFrom: z.uuid().optional(),
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
export function packageSubtotal(
  offer: Pick<Offer, "price" | "days">,
  portions = 1,
) {
  return offer.price * offer.days * portions;
}
export function perMealPrice(offer: Pick<Offer, "price" | "meal">) {
  return offer.price / (offer.meal === "both" ? 2 : 1);
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
  const subtotal = trial
    ? (offer.trialPrice ?? offer.price) * portions
    : packageSubtotal(offer, portions);
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
        failed: "Failed",
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
        succeeded: "Completed",
        submitting: "Submitting transfer",
        processing: "Transfer processing",
        pending_compliance: "Provider review",
        needs_attention: "Needs attention",
        awaiting_customer: "Awaiting refund details",
        reversed: "Transfer reversed",
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
        delivered: "Diterima",
        issue: "Ada kendala",
        pending: "Menunggu pembayaran",
        paid: "Dibayar",
        expired: "Kedaluwarsa",
        failed: "Gagal",
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
        succeeded: "Selesai",
        submitting: "Mengirim pencairan",
        processing: "Pencairan diproses",
        pending_compliance: "Peninjauan provider",
        needs_attention: "Perlu penanganan",
        awaiting_customer: "Menunggu detail pengembalian",
        reversed: "Pencairan dikembalikan",
        suspended: "Ditangguhkan",
        published: "Tayang",
        paused: "Dijeda",
        retired: "Diarsipkan",
        refunded: "Dikembalikan",
        payment_exception: "Pembayaran perlu ditinjau",
      }[status] || status;
export const errors: Record<string, string> = {
  PAYMENT_UNAVAILABLE:
    "Pembayaran sedang tidak tersedia. Silakan coba lagi nanti.",
  PAYMENT_METHOD_LOCKED:
    "Metode pembayaran sudah dipilih dan tidak dapat diganti.",
  TERMS_REQUIRED: "Setujui Syarat & Ketentuan untuk melanjutkan.",
  DURATION_UNAVAILABLE: "Durasi ini belum tersedia. Pilih durasi lain.",
  BOOKING_HORIZON:
    "Seluruh pengantaran harus selesai dalam 366 hari ke depan. Pilih durasi lebih pendek atau tanggal lebih awal.",
  PROMOTIONS_DISABLED:
    "Kode promosi tidak digunakan. Diskon paket dihitung otomatis.",
  AMOUNT_TOO_LARGE: "Nilai pembelian terlalu besar. Kurangi porsi atau durasi.",
  SETTLEMENT_SCHEDULED:
    "Pendapatan pengantaran dicairkan melalui jadwal mingguan.",
  SETTLEMENT_NOT_CONFIGURED: "Konfigurasi pencairan katerer belum siap.",
  INSUFFICIENT_OPTIONS:
    "Sediakan cukup hidangan aktif yang berbeda untuk setiap kategori paket.",
  OPTION_CHANGED:
    "Pilihan hidangan telah berubah. Muat ulang dan pilih hidangan yang tersedia.",
  CLASSIFY_PACKAGE:
    "Pilih jenis paket dan lengkapi isi paket sebelum menyimpan.",
  COMPOSITION_CHANGED:
    "Isi menu harus sesuai komposisi yang dibeli. Gunakan versi isi paket yang benar.",
  PRICE_CHANGED: "Harga atau ketentuan berubah. Tinjau ulang sebelum membayar.",
  UNAUTHORIZED: "Silakan masuk kembali.",
  EMAIL_NOT_CONFIRMED:
    "Verifikasi email Anda terlebih dahulu. Buka halaman Daftar untuk mengirim ulang tautan.",
  PASSWORD_REJECTED:
    "Gunakan kata sandi lain yang lebih kuat, minimal 8 karakter.",
  AUTH_UNAVAILABLE: "Layanan akun belum tersedia. Silakan coba lagi nanti.",
  RECOVERY_EXPIRED:
    "Sesi pemulihan tidak valid atau kedaluwarsa. Minta tautan pemulihan baru.",
  INVALID_CREDENTIALS: "Email atau kata sandi tidak cocok. Silakan coba lagi.",
  AUTH_RATE_LIMITED:
    "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.",
  FORBIDDEN: "Akun ini tidak memiliki akses.",
  CUSTOMER_NOT_LINKED:
    "Undang pelanggan untuk menghubungkan akun sebelum mengirim pesan.",
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
  REQUEST_TIMEOUT: "Koneksi terlalu lama. Periksa koneksi dan coba lagi.",
  INVALID_API_RESPONSE: "Catera sementara tidak tersedia. Silakan coba lagi.",
  PAYMENT_PENDING: "Pembayaran belum terkonfirmasi.",
  AMOUNT_INVALID: "Jumlah melebihi nilai yang dapat dikembalikan.",
  BOOKED_DATE:
    "Tanggal ini memiliki pesanan. Selesaikan pesanan sebelum menutupnya.",
};
const errorsEn: Record<string, string> = {
  PAYMENT_UNAVAILABLE:
    "Payment is currently unavailable. Please try again later.",
  PAYMENT_METHOD_LOCKED:
    "The payment method has already been selected and cannot be changed.",
  TERMS_REQUIRED: "Please accept the Terms & Conditions to continue.",
  DURATION_UNAVAILABLE:
    "This duration is unavailable. Choose another duration.",
  BOOKING_HORIZON:
    "All deliveries must finish within the next 366 days. Choose a shorter term or earlier start.",
  PROMOTIONS_DISABLED:
    "Promotion codes are not used. Package discounts apply automatically.",
  AMOUNT_TOO_LARGE:
    "This purchase exceeds the amount limit. Reduce portions or duration.",
  SETTLEMENT_SCHEDULED:
    "Delivery earnings are paid through the weekly settlement schedule.",
  SETTLEMENT_NOT_CONFIGURED:
    "The caterer’s settlement configuration is not ready.",
  INSUFFICIENT_OPTIONS:
    "Provide enough distinct active dishes for each package category.",
  OPTION_CHANGED: "Dish options changed. Reload and choose available dishes.",
  CLASSIFY_PACKAGE:
    "Choose a package type and complete the package contents before saving.",
  COMPOSITION_CHANGED:
    "The menu must match the purchased composition. Use the correct package revision.",
  PRICE_CHANGED: "The price or terms changed. Review them before paying.",
  UNAUTHORIZED: "Please sign in again.",
  EMAIL_NOT_CONFIRMED:
    "Verify your email first. Open Register to resend the link.",
  PASSWORD_REJECTED:
    "Use a different, stronger password with at least 8 characters.",
  AUTH_UNAVAILABLE: "Account services are unavailable. Please try again later.",
  RECOVERY_EXPIRED:
    "The recovery session is invalid or expired. Request a new recovery link.",
  INVALID_CREDENTIALS: "Email or password is incorrect. Please try again.",
  AUTH_RATE_LIMITED: "Too many sign-in attempts. Please wait and try again.",
  FORBIDDEN: "This account does not have access.",
  CUSTOMER_NOT_LINKED:
    "Invite this customer to link an account before sending messages.",
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
  REQUEST_TIMEOUT: "Connection timed out. Check your connection and try again.",
  INVALID_API_RESPONSE: "Catera is temporarily unavailable. Please try again.",
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

export * from "./payment";

/** What a caterer's WhatsApp claim link shows before the customer signs in. Nothing else is revealed. */
export type ClaimPreview = {
  catererName: string;
  packageName: string;
  /** Open delivery days left on the subscription. */
  remainingDays: number;
  /** Next non-cancelled delivery date on or after today in Jakarta, or null. */
  nextDate: string | null;
  /** That meal's delivery window, for example "11.00–13.00", or null. */
  nextWindow: string | null;
  addressLabel: string;
  /** Local form with the middle hidden, for example "0812-•••-0001". */
  maskedPhone: string;
};
