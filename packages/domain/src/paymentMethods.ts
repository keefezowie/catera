/**
 * Every payment method DOKU offers, as the picker and the "Bayar dengan" row show it. The server decides which codes a
 * purchase can use (`availableMethods`); this catalogue only names them. An unknown code is skipped, never shown raw.
 */
export type PaymentGroup = "qris" | "ewallet" | "va" | "card" | "retail" | "paylater";

export type PaymentMethodInfo = {
  code: string;
  group: PaymentGroup;
  /** Short name, "BCA" or "OVO"; the full name below adds "Virtual Account" for a bank. */
  short: string;
  name: { id: string; en: string };
  detail: { id: string; en: string };
  /** The key of its logo in `packages/brand/assets/payment`. */
  logo: string;
};

export const PAYMENT_GROUPS: { group: PaymentGroup; title: { id: string; en: string } | null }[] = [
  { group: "qris", title: null },
  { group: "ewallet", title: { id: "E-wallet", en: "E-wallet" } },
  { group: "va", title: { id: "Transfer bank", en: "Bank transfer" } },
  { group: "card", title: { id: "Kartu", en: "Card" } },
  { group: "retail", title: { id: "Bayar di gerai", en: "Pay at a store" } },
  { group: "paylater", title: { id: "Paylater", en: "Paylater" } },
];

const same = (s: string) => ({ id: s, en: s });

function va(suffix: string, short: string, logo: string): PaymentMethodInfo {
  return {
    code: `VIRTUAL_ACCOUNT_${suffix}`,
    group: "va",
    short,
    name: same(`${short} Virtual Account`),
    detail: { id: `Transfer dari aplikasi atau ATM ${short}.`, en: `Transfer from the ${short} app or ATM.` },
    logo,
  };
}

function wallet(code: string, short: string, logo: string): PaymentMethodInfo {
  return {
    code,
    group: "ewallet",
    short,
    name: same(short),
    detail: { id: `Lanjut di aplikasi ${short}.`, en: `Continue in the ${short} app.` },
    logo,
  };
}

function store(code: string, short: string, logo: string): PaymentMethodInfo {
  return {
    code,
    group: "retail",
    short,
    name: same(short),
    detail: { id: "Tunjukkan kode bayar di kasir.", en: "Show the payment code at the cashier." },
    logo,
  };
}

function later(code: string, short: string, logo: string): PaymentMethodInfo {
  return {
    code,
    group: "paylater",
    short,
    name: same(short),
    detail: { id: `Cicil lewat akun ${short}.`, en: `Pay in instalments with ${short}.` },
    logo,
  };
}

/** In picker order: QRIS, e-wallets, banks, card, stores, paylater. */
export const PAYMENT_METHODS: readonly PaymentMethodInfo[] = [
  {
    code: "QRIS",
    group: "qris",
    short: "QRIS",
    name: same("QRIS"),
    detail: { id: "Pindai dari aplikasi bank atau e-wallet apa pun.", en: "Scan from any bank or e-wallet app." },
    logo: "qris",
  },
  wallet("EMONEY_OVO", "OVO", "ovo"),
  wallet("EMONEY_SHOPEE_PAY", "ShopeePay", "shopeepay"),
  wallet("EMONEY_DANA", "DANA", "dana"),
  wallet("EMONEY_LINKAJA", "LinkAja", "linkaja"),
  wallet("EMONEY_DOKU", "DOKU Wallet", "doku"),
  va("BCA", "BCA", "bca"),
  va("BANK_MANDIRI", "Mandiri", "mandiri"),
  va("BRI", "BRI", "bri"),
  va("BNI", "BNI", "bni"),
  va("BANK_SYARIAH_MANDIRI", "BSI", "bsi"),
  va("BANK_PERMATA", "Permata", "permata"),
  va("BANK_CIMB", "CIMB Niaga", "cimb"),
  va("BANK_DANAMON", "Danamon", "danamon"),
  va("BTN", "BTN", "btn"),
  va("BNC", "Neo Commerce", "bnc"),
  va("BSS", "Sahabat Sampoerna", "sampoerna"),
  va("BJB", "bjb", "bjb"),
  va("Sinarmas", "Sinarmas", "sinarmas"),
  va("DOKU", "DOKU", "doku"),
  {
    code: "CREDIT_CARD",
    group: "card",
    short: "Kartu",
    name: { id: "Kartu kredit atau debit", en: "Credit or debit card" },
    detail: same("Visa, Mastercard, JCB."),
    logo: "visa",
  },
  store("ONLINE_TO_OFFLINE_ALFA", "Alfamart", "alfamart"),
  store("ONLINE_TO_OFFLINE_INDOMARET", "Indomaret", "indomaret"),
  later("PEER_TO_PEER_AKULAKU", "Akulaku", "akulaku"),
  later("PEER_TO_PEER_KREDIVO", "Kredivo", "kredivo"),
  later("PEER_TO_PEER_INDODANA", "Indodana", "indodana"),
];

const byCode = new Map(PAYMENT_METHODS.map((m) => [m.code, m]));

/** The catalogue entry for a DOKU code, or undefined for a code the app does not know. */
export function paymentMethodInfo(code: string): PaymentMethodInfo | undefined {
  return byCode.get(code);
}

/** The known codes, in catalogue order, grouped in picker order. Empty groups are left out. */
export function groupPaymentMethods(codes: readonly string[]): { group: PaymentGroup; title: PaymentMethodInfo["name"] | null; methods: PaymentMethodInfo[] }[] {
  const offered = new Set(codes);
  return PAYMENT_GROUPS.map(({ group, title }) => ({
    group,
    title,
    methods: PAYMENT_METHODS.filter((m) => m.group === group && offered.has(m.code)),
  })).filter((g) => g.methods.length > 0);
}
