"use client";
import { Select, SelectOption } from "./select";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  CalendarDays,
  MapPin,
  Plus,
  Minus,
  Clock,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  currency,
  mealLabel,
  localDay,
  addDays,
  type Quote,
  type Checkout,
  type CustomerState,
  areaOptions,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { signedInPath, safeReturnPath } from "@/lib/navigation";
import type { Actor } from "@catera/domain";
import {
  Heading,
  ActionForm,
  Field,
  ErrorNotice,
  Loading,
  Facts,
  Empty,
} from "./ui";
export function Login() {
  const { demo, t } = useApp();
  const q = useSearchParams();
  const [phone, setPhone] = useState(""),
    [sent, setSent] = useState(false),
    [method, setMethod] = useState<"email" | "phone">("email");
  const next = safeReturnPath(q.get("next")) || "/home";
  return (
    <div className="login-layout">
      <section className="login-story">
        <img src="/assets/welcome.png" alt="Maskot Catera menyambut Anda" />
        <h1>
          {t("Hari yang baik,", "A good day,")}
          <br />
          {t("dimulai dari makan.", "starts with a good meal.")}
        </h1>
        <p>
          {t(
            "Satu tempat untuk makanan favorit dan jadwal yang lebih teratur.",
            "One place for your favorite meals and a more effortless routine.",
          )}
        </p>
      </section>
      <section className="login-form">
        <h2>{t("Selamat datang di Catera", "Welcome to Catera")}</h2>
        <p>
          {t(
            "Makanan enak untuk hari-harimu yang sibuk.",
            "Good meals for your busy everyday.",
          )}
        </p>
        {demo ? (
          <>
            <div className="notice">
              {t(
                "Pilih peran untuk menjelajahi demo. Semua akun menggunakan data sintetis.",
                "Choose a role to explore. All accounts use synthetic data.",
              )}
            </div>
            <div className="demo-roles">
              {[
                [
                  "customer",
                  "Jelajah sebagai pelanggan",
                  "Explore as customer",
                ],
                ["owner", "Masuk sebagai pemilik", "Sign in as owner"],
                ["staff", "Masuk sebagai staf", "Sign in as staff"],
                [
                  "platform_admin",
                  "Masuk ke Catera Admin",
                  "Open Catera Admin",
                ],
              ].map(([role, id, en]) => (
                <ActionForm
                  key={role}
                  submit={t(id, en)}
                  onSubmit={async () => {
                    await api.request("auth/demo", { role });
                    location.assign(
                      role === "owner" || role === "staff"
                        ? "/seller"
                        : role === "platform_admin"
                          ? "/admin"
                          : next,
                    );
                  }}
                >
                  <span className="sr-only">{role}</span>
                </ActionForm>
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              className="auth-methods"
              aria-label={t("Metode masuk", "Sign-in method")}
            >
              <button
                type="button"
                aria-pressed={method === "email"}
                onClick={() => setMethod("email")}
              >
                {t("Email & kata sandi", "Email & password")}
              </button>
              <button
                type="button"
                aria-pressed={method === "phone"}
                onClick={() => setMethod("phone")}
              >
                {t("Kode ponsel", "Phone code")}
              </button>
            </div>
            {method === "email" ? (
              <ActionForm
                submit={t("Masuk", "Sign in")}
                onSubmit={async (form) => {
                  const result = await api.request<{ actor: Actor }>(
                    "auth/password",
                    {
                      email: form.get("email"),
                      password: form.get("password"),
                    },
                  );
                  location.assign(signedInPath(result.actor, q.get("next")));
                }}
              >
                <Field label="Email">
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    placeholder="nama@contoh.com"
                    required
                    maxLength={254}
                  />
                </Field>
                <Field label={t("Kata sandi", "Password")}>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    maxLength={256}
                  />
                </Field>
                <p className="small muted">
                  {t(
                    "Belum punya akun? Gunakan kode ponsel untuk mendaftar atau masuk.",
                    "New here? Use a phone code to register or sign in.",
                  )}
                </p>
              </ActionForm>
            ) : (
              <ActionForm
                submit={
                  sent
                    ? t("Verifikasi & masuk", "Verify & sign in")
                    : t("Kirim kode OTP", "Send OTP code")
                }
                onSubmit={async (f) => {
                  if (!sent) {
                    await api.request("auth/send", { phone });
                    setSent(true);
                  } else {
                    await api.request("auth/verify", {
                      phone,
                      token: f.get("token"),
                      name: f.get("name"),
                    });
                    const result = await api.request<{ actor: Actor }>("me");
                    location.assign(signedInPath(result.actor, q.get("next")));
                  }
                }}
              >
                <Field label={t("Nomor WhatsApp / ponsel", "Mobile number")}>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+6281234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    disabled={sent}
                  />
                </Field>
                {sent && (
                  <>
                    <Field label="Kode OTP">
                      <input
                        name="token"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        required
                      />
                    </Field>
                    <Field label="Nama">
                      <input name="name" autoComplete="name" required />
                    </Field>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSent(false)}
                    >
                      Ubah nomor / kirim ulang
                    </button>
                  </>
                )}
              </ActionForm>
            )}
          </>
        )}
        <p className="small muted">
          {t(
            "Dengan masuk, Anda dapat mengelola paket, jadwal, dan percakapan di satu tempat.",
            "Sign in to manage packages, schedules, and conversations in one place.",
          )}
        </p>
      </section>
    </div>
  );
}
export function CheckoutPage({ id }: { id: string }) {
  const { offers, actor, perform, t, locale } = useApp();
  const params = useSearchParams();
  const p = offers.find((p) => p.id === id || p.slug === id);
  const [portions, setPortions] = useState(
      Math.max(1, Math.min(100, Number(params.get("portions")) || 1)),
    ),
    [date, setDate] = useState(addDays(localDay(), 2)),
    [address, setAddress] = useState(""),
    [promo, setPromo] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [step, setStep] = useState(1),
    [restored, setRestored] = useState(false);
  const trial = params.get("trial") === "1";
  const draftKey = `catera.checkout.${id}.${trial}`;
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (Number.isInteger(draft.portions))
          setPortions(Math.max(1, Math.min(100, draft.portions)));
        if (/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) setDate(draft.date);
        if (typeof draft.address === "string") setAddress(draft.address);
        if (typeof draft.promo === "string") setPromo(draft.promo);
      }
    } catch {
      /* A blocked storage setting must not prevent checkout. */
    }
    setRestored(true);
  }, [draftKey]);
  useEffect(() => {
    if (restored) {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({ portions, date, address, promo }),
        );
      } catch {
        /* Keep checkout usable without storage. */
      }
    }
  }, [restored, draftKey, portions, date, address, promo]);
  const state = useResource<CustomerState>("checkout-customer", () =>
    actor
      ? api.customer()
      : Promise.resolve({
          subscriptions: [],
          deliveries: [],
          addresses: [],
          notifications: [],
          cases: [],
        }),
  );
  useEffect(() => {
    if (restored && !address && state.data?.addresses[0])
      setAddress(state.data.addresses[0].id);
  }, [state.data, address, restored]);
  useEffect(() => {
    setQuote(null);
    setStep(1);
  }, [portions, date, address, promo]);
  if (actor && state.error)
    return (
      <div className="narrow">
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>
    );
  if (actor && (!restored || !state.data)) return <Loading />;
  if (!p)
    return (
      <Empty title="Paket tidak ditemukan" href="/" label="Jelajah paket" />
    );
  if (!actor)
    return (
      <div className="narrow">
        <Heading
          title={t("Simpan pilihanmu.", "Keep your selection.")}
          description={t(
            "Masuk untuk memilih alamat dan mengamankan jadwal makanan.",
            "Sign in to choose an address and reserve your meals.",
          )}
        />
        <Link
          className="button"
          href={
            "/login?next=" +
            encodeURIComponent("/checkout/" + id + "?" + params.toString())
          }
        >
          {t("Masuk & lanjutkan", "Sign in & continue")}
          <ArrowRight size={18} />
        </Link>
      </div>
    );
  return (
    <div className="content checkout-page">
      <Link className="back-link" href={"/packages/" + p.slug}>
        <ArrowLeft size={16} />
        {t("Kembali ke paket", "Back to package")}
      </Link>
      <Heading
        title={
          trial
            ? t("Kenalan lewat satu kali makan.", "Start with a first taste.")
            : t(
                "Siapkan hari-hari yang lebih enak.",
                "Make room for good meals.",
              )
        }
        description={t(
          "Porsi dan jadwal yang jelas, sejak awal.",
          "Clear portions and schedules, from the start.",
        )}
      />
      <div className="checkout-steps">
        <span className="current">
          1. {t("Porsi & jadwal", "Portions & dates")}
        </span>
        <i />
        <span className={step === 2 ? "current" : ""}>
          2. {t("Tinjau paket", "Review package")}
        </span>
        <i />
        <span>3. {t("Pembayaran", "Payment")}</span>
      </div>
      <div className="checkout-layout">
        <section className="checkout-fields">
          {step === 1 ? (
            <ActionForm
              submit={t("Tinjau jadwal & harga", "Review schedule & price")}
              disabled={!restored || state.loading || !address}
              onSubmit={async () => {
                const q = await api.quote({
                  packageId: p.id,
                  addressId: address,
                  portions,
                  startDate: date,
                  trial,
                  promo,
                  invite: params.get("invite") || "",
                });
                setQuote(q);
                setStep(2);
              }}
            >
              <h2>{t("Paket untuk siapa saja?", "How many are eating?")}</h2>
              <p>
                {t(
                  "Jumlah porsi tetap untuk seluruh paket. Semua porsi mendapat menu yang sama.",
                  "Portions stay fixed throughout the package. Every portion gets the same menu.",
                )}
              </p>
              <div className="portion-control">
                <strong>{t("Porsi setiap hari", "Portions per day")}</strong>
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={portions <= 1}
                    aria-label="Kurangi porsi"
                    onClick={() => setPortions((p) => p - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <strong>{portions}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={portions >= 100}
                    aria-label="Tambah porsi"
                    onClick={() => setPortions((p) => p + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <Field label={t("Mulai tanggal", "Start date")}>
                <input
                  type="date"
                  required
                  min={localDay()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label={t("Alamat pengantaran", "Delivery address")}>
                <Select
                  required
                  value={address}
                  onValueChange={(value) => setAddress(value)}
                >
                  <SelectOption value="">Pilih alamat</SelectOption>
                  {state.data?.addresses.map((a) => (
                    <SelectOption key={a.id} value={a.id}>
                      {a.label} — {a.line}, {a.area}
                    </SelectOption>
                  ))}
                </Select>
              </Field>
              <Link
                className="text-button"
                href={
                  "/addresses?next=" +
                  encodeURIComponent(
                    "/checkout/" + id + "?" + params.toString(),
                  )
                }
              >
                <Plus size={16} />
                {t("Tambah alamat", "Add an address")}
              </Link>
              <Field
                label={t("Kode promo (opsional)", "Promo code (optional)")}
              >
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="Kode promo"
                  maxLength={40}
                />
              </Field>
            </ActionForm>
          ) : (
            quote && (
              <ActionForm
                submit={t("Lanjutkan ke pembayaran", "Continue to payment")}
                onSubmit={async () => {
                  const c = await perform<Checkout>("checkout.create", {
                    expectedQuote: quote,
                    packageId: p.id,
                    addressId: address,
                    portions,
                    startDate: date,
                    trial,
                    promo,
                    invite: params.get("invite") || "",
                  });
                  try {
                    sessionStorage.removeItem(draftKey);
                    sessionStorage.setItem("catera.pendingPayment", c.id);
                  } catch {}
                  location.assign("/payment/" + c.id);
                }}
              >
                <div className="section-heading">
                  <h2>{t("Jadwal makananmu", "Your meal schedule")}</h2>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(1)}
                  >
                    Ubah
                  </button>
                </div>
                <div className="schedule-preview">
                  {quote.dates.map((d, i) => (
                    <div key={d}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <strong>
                        {new Date(d + "T12:00:00").toLocaleDateString(
                          locale === "id" ? "id-ID" : "en-GB",
                          { weekday: "short", day: "numeric", month: "long" },
                        )}
                      </strong>
                      <span>
                        {portions} {t("porsi", "portions")}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="notice">
                  <ShieldCheck size={20} />
                  <p>
                    {p.flexible
                      ? t(
                          "Tanggal dapat diganti sebelum batas waktu, selama kapasitas tersedia.",
                          "Dates can be changed before cutoff, subject to capacity.",
                        )
                      : t(
                          "Paket ini menggunakan jadwal tetap.",
                          "This package uses fixed dates.",
                        )}{" "}
                    {t(
                      "Permintaan pembatalan dan refund selalu ditinjau tim bantuan.",
                      "Cancellation and refund requests are always reviewed by support.",
                    )}
                  </p>
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" required />
                  {t(
                    "Saya sudah memeriksa jadwal, alamat, dan aturan paket.",
                    "I have reviewed the schedule, address, and package rules.",
                  )}
                </label>
              </ActionForm>
            )
          )}
        </section>
        <aside className="checkout-summary">
          <img src={p.image} alt={p.name} />
          <div>
            <small>{p.caterer}</small>
            <h2>{p.name}</h2>
            <p>
              {trial ? "Trial 1 hari" : p.days + " " + t("hari", "days")} ·{" "}
              {mealLabel(p.meal, locale)} · {portions} {t("porsi", "portions")}
            </p>
            <Facts
              rows={[
                [
                  t("Harga paket", "Package subtotal"),
                  currency(
                    quote?.subtotal ||
                      (trial ? p.trialPrice || p.price : p.price * p.days) *
                        portions,
                    locale,
                  ),
                ],
                ...(quote?.discount
                  ? [
                      [
                        "Diskon porsi",
                        "− " + currency(quote.discount, locale),
                      ] as [string, string],
                    ]
                  : []),
                ...(quote?.promotion
                  ? [
                      ["Promo", "− " + currency(quote.promotion, locale)] as [
                        string,
                        string,
                      ],
                    ]
                  : []),
                [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
                [
                  t("Biaya layanan Catera", "Catera service fee"),
                  quote
                    ? currency(quote.serviceFee, locale)
                    : t("Dihitung saat tinjau", "Calculated on review"),
                ],
              ]}
            />
            <div className="total-row">
              <strong>Total</strong>
              <strong>{quote ? currency(quote.total, locale) : "—"}</strong>
            </div>
            <p className="small muted">
              {t(
                "Tidak ada perpanjangan otomatis. Pembayaran diproses di dalam Catera.",
                "No automatic renewal. Your purchase is processed through Catera.",
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function PaymentPage({ id }: { id: string }) {
  const { demo, t, locale, perform } = useApp();
  const state = useResource<Checkout>("payment:" + id, () => api.checkout(id));
  const [counter, setCounter] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCounter(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (state.data?.state !== "pending") return;
    const timer = setInterval(state.reload, 5000);
    return () => clearInterval(timer);
  }, [state.data?.state]);
  if (state.error)
    return (
      <div className="narrow">
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>
    );
  if (!state.data) return <Loading />;
  const c = state.data,
    seconds = Math.max(
      0,
      Math.floor((new Date(c.expires_at).getTime() - counter) / 1000),
    );
  if (c.subscription_id)
    return (
      <div className="payment-success">
        <img src="/assets/confirmation.png" alt="" />
        <span className="success-mark">
          <Check size={24} />
        </span>
        <h1>
          {t(
            "Makanan baik sudah dijadwalkan.",
            "Good meals are on the calendar.",
          )}
        </h1>
        <p>
          {c.quote.offer.name} · {c.quote.portions} {t("porsi", "portions")} ·{" "}
          {c.quote.dates.length} {t("hari", "days")}
        </p>
        <Link className="button" href="/calendar">
          {t("Lihat jadwal makan", "View meal calendar")}
          <ArrowRight size={18} />
        </Link>
        <Link
          className="text-button"
          href={"/subscriptions/" + c.subscription_id}
        >
          {t("Detail langganan", "Subscription details")}
        </Link>
      </div>
    );
  return (
    <div className="narrow payment-pending">
      <Heading
        title={
          c.state === "payment_exception"
            ? t("Pembayaran sedang ditinjau", "Your payment is being reviewed")
            : seconds
              ? t(
                  "Satu langkah menuju makan enak.",
                  "One step away from good meals.",
                )
              : t("Waktu pembayaran habis", "Payment time expired")
        }
      />
      <Facts
        rows={[
          [t("Paket", "Package"), c.quote.offer.name],
          ["Total", currency(c.quote.total, locale)],
          [
            t("Batas pembayaran", "Time remaining"),
            `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
          ],
        ]}
      />
      {c.state === "payment_exception" ? (
        <p className="notice">
          Pembayaran diterima setelah jadwal tidak tersedia. Tim Catera akan
          meninjau penyelesaiannya. Anda tidak akan menerima langganan tanpa
          kapasitas.
        </p>
      ) : seconds > 0 ? (
        <>
          {demo ? (
            <ActionForm
              submit={t(
                "Simulasikan pembayaran berhasil",
                "Simulate successful payment",
              )}
              onSubmit={async () => {
                await perform("checkout.demo_pay", { id });
                state.reload();
              }}
            >
              <p className="notice">
                {t(
                  "Simulasi demo: tidak ada uang yang ditagih.",
                  "Demo simulation: no money is charged.",
                )}
              </p>
            </ActionForm>
          ) : c.payment_url ? (
            <a className="button full" href={c.payment_url}>
              {t("Buka pembayaran aman", "Open secure payment")}
              <ExternalLink size={16} />
            </a>
          ) : (
            <p className="notice">
              {t(
                "Tautan pembayaran sedang disiapkan. Halaman ini diperbarui otomatis.",
                "Your payment link is being prepared. This page updates automatically.",
              )}
            </p>
          )}
          <p className="small muted">
            QRIS · Virtual Account · E-wallet
            <br />
            {t(
              "Status hanya berubah setelah pembayaran dikonfirmasi.",
              "Status changes only after payment confirmation.",
            )}
          </p>
        </>
      ) : (
        <Link className="button" href={"/checkout/" + c.quote.packageId}>
          {t("Buat jadwal baru", "Choose a new schedule")}
        </Link>
      )}
      <button className="button secondary" onClick={state.reload}>
        <RefreshCw size={17} />
        {t("Periksa status", "Check status")}
      </button>
    </div>
  );
}
