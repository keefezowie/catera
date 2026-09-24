"use client";
import { DirectPayment } from "./direct-payment";
import { useContentMotion } from "./motion";
import { PackageChoiceLibrary } from "./package-choice-library";
import {
  PurchasePriceBreakdown,
  PurchaseSchedule,
} from "./purchase-price-breakdown";
import { durationOptions, purchaseStartAvailable } from "@catera/domain";
import { Select, SelectOption } from "./select";
import { DatePicker } from "./date-picker";
import { OptionalSection } from "./optional-section";
import { PackageContents } from "./package-contents";
import { FoodImage } from "./food-image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  type PaymentAvailability,
  type CustomerState,
  areaOptions,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button, Checkbox, TextInput } from "./form-controls";
import {
  Heading,
  ActionForm,
  Field,
  ErrorNotice,
  Loading,
  Facts,
  Empty,
} from "./ui";
export function CheckoutPage({ id }: { id: string }) {
  const { offers, actor, perform, t, locale } = useApp();
  const availability = useResource<PaymentAvailability>("payment-methods", () =>
    api.request("payment-methods"),
  );
  const paymentUnavailable =
    !!availability.error ||
    !availability.data ||
    (availability.data.mode === "direct" &&
      !availability.data.availableMethods.length);
  const params = useSearchParams();
  const p = offers.find((p) => p.id === id || p.slug === id);
  const [portions, setPortions] = useState(
      Math.max(1, Math.min(100, Number(params.get("portions")) || 1)),
    ),
    [date, setDate] = useState(
      params.get("startDate") || addDays(localDay(), 2),
    ),
    [address, setAddress] = useState(params.get("addressId") || ""),
    [cycles, setCycles] = useState(
      Math.max(1, Math.min(6, Number(params.get("cycles")) || 1)),
    ),
    [quote, setQuote] = useState<Quote | null>(null),
    [step, setStep] = useState(1),
    [restored, setRestored] = useState(false);
  const trial = params.get("trial") === "1";
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const startAvailable = !!p && purchaseStartAvailable(p, date, now);
  const durationAvailable =
    !!p && durationOptions(p).some((o) => o.cycles === (trial ? 1 : cycles));
  const renewedFrom = params.get("renewedFrom") || undefined;
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const draftKey = `catera.checkout.${id}.${trial}.${renewedFrom || ""}`;
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (Number.isInteger(draft.portions))
          setPortions(Math.max(1, Math.min(100, draft.portions)));
        if (/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) setDate(draft.date);
        if (typeof draft.address === "string") setAddress(draft.address);
        if (
          Number.isInteger(draft.cycles) &&
          draft.cycles >= 1 &&
          draft.cycles <= 6
        )
          setCycles(trial ? 1 : draft.cycles);
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
          JSON.stringify({ portions, date, address, cycles }),
        );
      } catch {
        /* Keep checkout usable without storage. */
      }
    }
  }, [restored, draftKey, portions, date, address, cycles]);
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
  const selectedAddress = state.data?.addresses.find((a) => a.id === address);
  const fields = useRef<HTMLDivElement>(null);
  useContentMotion(fields, step, {
    directional: true,
    ready: restored && !!state.data,
  });
  useEffect(() => {
    if (restored && !address && state.data?.addresses[0])
      setAddress(state.data.addresses[0].id);
  }, [state.data, address, restored]);
  useEffect(() => {
    setQuote(null);
    setAcceptedTerms(false);
    setStep(1);
  }, [portions, date, address, cycles]);
  if (actor && state.error)
    return (
      <div className="narrow">
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>
    );
  if (actor && (!restored || !state.data)) return <Loading />;
  if (!p)
    return (
      <Empty
        title={t("Paket tidak ditemukan", "Package not found")}
        href="/"
        label={t("Jelajah paket", "Browse packages")}
      />
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
      <ol
        className="checkout-steps"
        aria-label={t("Tahap pemesanan", "Checkout progress")}
      >
        <li
          className={step === 1 ? "current" : "complete"}
          aria-current={step === 1 ? "step" : undefined}
        >
          1. {t("Porsi & jadwal", "Portions & dates")}
        </li>
        <li
          className={step === 2 ? "current" : ""}
          aria-current={step === 2 ? "step" : undefined}
        >
          2. {t("Tinjau paket", "Review package")}
        </li>
        <li>3. {t("Pembayaran", "Payment")}</li>
      </ol>
      <div className="checkout-layout">
        <aside
          className="checkout-summary"
          aria-label={t("Ringkasan paket", "Package summary")}
        >
          <FoodImage
            src={p.image}
            alt=""
            width="350"
            height="180"
            sizes="(max-width: 600px) 76px, 350px"
          />
          <div>
            <small>{p.caterer}</small>
            <h2>{p.name}</h2>
            <p>
              {trial
                ? t("Trial 1 hari", "1-day trial")
                : p.days * cycles +
                  " " +
                  t("hari pengantaran", "delivery days")}{" "}
              · {mealLabel(p.meal, locale)} · {portions}{" "}
              {t("porsi", "portions")}
            </p>
            <div className="total-row" aria-live="polite" aria-atomic="true">
              <strong>
                {quote
                  ? t("Total pembayaran", "Total payment")
                  : t("Subtotal dasar", "Base subtotal")}
              </strong>
              <strong>
                {currency(
                  quote
                    ? quote.total
                    : (trial ? (p.trialPrice ?? p.price) : p.price) *
                        portions *
                        (trial ? 1 : p.days * cycles),
                  locale,
                )}
              </strong>
            </div>
            <p className="small muted">
              {quote
                ? t(
                    "Termasuk pengantaran dan biaya layanan.",
                    "Includes delivery and service fee.",
                  )
                : t(
                    "Diskon dan biaya layanan dihitung saat meninjau jadwal.",
                    "Discounts and service fee are calculated when you review the schedule.",
                  )}
            </p>
            <details className="checkout-package-details">
              <summary>
                {t("Isi paket & menu", "Package contents & menu")}
              </summary>
              <PackageContents offer={quote?.offer || p} />
              {(quote?.offer || p).menuSelectionMode === "customer" && (
                <PackageChoiceLibrary offer={quote?.offer || p} />
              )}
            </details>
            <p className="small muted">
              {t(
                "Dibayar penuh di awal. Tidak diperpanjang otomatis.",
                "Paid in full upfront. No automatic renewal.",
              )}
            </p>
          </div>
        </aside>
        <section className="checkout-fields">
          {step === 1 ? (
            <ActionForm
              submit={t("Tinjau jadwal & harga", "Review schedule & price")}
              disabled={
                !restored ||
                state.loading ||
                !address ||
                !startAvailable ||
                !durationAvailable
              }
              onSubmit={async () => {
                const q = await api.quote({
                  packageId: p.id,
                  addressId: address,
                  portions,
                  startDate: date,
                  trial,
                  cycles: trial ? 1 : cycles,
                  renewedFrom,
                  invite: params.get("invite") || "",
                });
                setAcceptedTerms(false);
                setQuote(q);
                setStep(2);
              }}
            >
              <div ref={fields} className="checkout-step-content">
                <h2 ref={stepHeading} tabIndex={-1}>
                  {t("Paket untuk siapa saja?", "How many are eating?")}
                </h2>
                <p>
                  {t(
                    "Jumlah porsi tetap untuk seluruh paket. Semua porsi mendapat menu yang sama.",
                    "Portions stay fixed throughout the package. Every portion gets the same menu.",
                  )}
                </p>
                <div className="portion-control">
                  <strong>{t("Porsi setiap hari", "Portions per day")}</strong>
                  <div>
                    <Button
                      type="button"
                      className="icon-button"
                      disabled={portions <= 1}
                      aria-label={t("Kurangi porsi", "Decrease portions")}
                      onClick={() => setPortions((p) => p - 1)}
                    >
                      <Minus size={16} />
                    </Button>
                    <strong>{portions}</strong>
                    <Button
                      type="button"
                      className="icon-button"
                      disabled={portions >= 100}
                      aria-label={t("Tambah porsi", "Increase portions")}
                      onClick={() => setPortions((p) => p + 1)}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                <Field label={t("Mulai tanggal", "Start date")}>
                  <DatePicker
                    required
                    min={localDay(now, p.timezone)}
                    isDateUnavailable={(day) =>
                      !purchaseStartAvailable(p, day, now)
                    }
                    value={date}
                    onValueChange={setDate}
                  />
                </Field>
                {!startAvailable && (
                  <p role="status">
                    {t(
                      "Pilih tanggal pengantaran yang belum melewati batas pemesanan katerer.",
                      "Choose a delivery date before the caterer's purchase cutoff.",
                    )}
                  </p>
                )}
                <Field label={t("Alamat pengantaran", "Delivery address")}>
                  <Select
                    required
                    value={address}
                    onValueChange={(value) => setAddress(value)}
                  >
                    <SelectOption value="">
                      {t("Pilih alamat", "Choose an address")}
                    </SelectOption>
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
                {!trial && (
                  <Field label={t("Durasi paket", "Package duration")}>
                    <Select
                      value={String(cycles)}
                      onValueChange={(value) => setCycles(Number(value))}
                    >
                      {durationOptions(p).map((option) => (
                        <SelectOption
                          key={option.cycles}
                          value={String(option.cycles)}
                        >
                          {option.cycles} {t("periode", "cycles")} ·{" "}
                          {option.cycles * p.days}{" "}
                          {t("hari pengantaran", "delivery days")}
                          {option.discountPercent
                            ? ` · −${option.discountPercent}%`
                            : ""}
                        </SelectOption>
                      ))}
                    </Select>
                    <p className="small muted">
                      1 {t("periode", "cycle")} = {p.days}{" "}
                      {t(
                        "hari pengantaran. Diskon durasi dihitung setelah diskon porsi.",
                        "delivery days. Multi-cycle savings apply after the portion discount.",
                      )}
                    </p>
                  </Field>
                )}
                {!durationAvailable && (
                  <p role="status">
                    {t(
                      "Durasi ini belum tersedia. Pilih durasi lain.",
                      "This duration is unavailable. Choose another duration.",
                    )}
                  </p>
                )}
              </div>
            </ActionForm>
          ) : (
            quote && (
              <ActionForm
                submit={t("Lanjutkan ke pembayaran", "Continue to payment")}
                disabled={
                  !acceptedTerms ||
                  !startAvailable ||
                  !durationAvailable ||
                  paymentUnavailable
                }
                actions={(submitButton) => (
                  <div className="checkout-actions">
                    <div>
                      <span>{t("Total pembayaran", "Total payment")}</span>
                      <strong>{currency(quote.total, locale)}</strong>
                    </div>
                    {paymentUnavailable && (
                      <p role="status">
                        {t(
                          "Pembayaran sedang tidak tersedia. Silakan coba lagi nanti.",
                          "Payment is currently unavailable. Please try again later.",
                        )}
                      </p>
                    )}
                    {submitButton}
                  </div>
                )}
                onSubmit={async () => {
                  if (!acceptedTerms) throw new Error("TERMS_REQUIRED");
                  if (paymentUnavailable)
                    throw new Error("PAYMENT_UNAVAILABLE");
                  const c = await perform<Checkout>("checkout.create", {
                    acceptedTerms: true,
                    expectedQuote: quote,
                    packageId: p.id,
                    addressId: address,
                    portions,
                    startDate: date,
                    trial,
                    cycles: trial ? 1 : cycles,
                    renewedFrom,
                    invite: params.get("invite") || "",
                  });
                  try {
                    sessionStorage.removeItem(draftKey);
                    sessionStorage.setItem("catera.pendingPayment", c.id);
                  } catch {}
                  location.assign("/payment/" + c.id);
                }}
              >
                <div ref={fields} className="checkout-step-content">
                  <div className="section-heading">
                    <h2 ref={stepHeading} tabIndex={-1}>
                      {t("Jadwal makananmu", "Your meal schedule")}
                    </h2>
                    <Button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setAcceptedTerms(false);
                        setStep(1);
                      }}
                    >
                      {t("Ubah", "Edit")}
                    </Button>
                  </div>
                  <div className="checkout-address">
                    <MapPin size={20} aria-hidden="true" />
                    <div>
                      <strong>
                        {t("Alamat pengantaran", "Delivery address")}
                      </strong>
                      <p>
                        {selectedAddress?.label} — {selectedAddress?.line},{" "}
                        {selectedAddress?.area}
                      </p>
                    </div>
                  </div>
                  <PurchasePriceBreakdown quote={quote} />
                  <PurchaseSchedule quote={quote} />
                  {!startAvailable && (
                    <p role="status">
                      {t(
                        "Batas pemesanan sudah lewat. Ubah tanggal mulai sebelum melanjutkan.",
                        "The purchase cutoff has passed. Edit your start date before continuing.",
                      )}
                    </p>
                  )}
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
                    <Checkbox
                      required
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      aria-describedby="checkout-terms-reminder"
                    />
                    {t(
                      "Saya menyetujui Syarat & Ketentuan pembelian, termasuk jadwal, alamat, harga, dan aturan paket yang ditampilkan.",
                      "I accept the purchase Terms & Conditions, including the displayed schedule, address, price, and package rules.",
                    )}
                  </label>
                  <p
                    id="checkout-terms-reminder"
                    className="small muted"
                    role="status"
                  >
                    {!acceptedTerms &&
                      t(
                        "Setujui Syarat & Ketentuan untuk melanjutkan.",
                        "Please accept the Terms & Conditions to continue.",
                      )}
                  </p>
                </div>
              </ActionForm>
            )
          )}
        </section>
      </div>
    </div>
  );
}
export function PaymentPage({ id }: { id: string }) {
  const { demo, t, locale, perform } = useApp();
  const state = useResource<Checkout>("payment:" + id, () => api.checkout(id));
  const [counter, setCounter] = useState(Date.now());
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setCounter(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (state.data?.state !== "pending") return;
    const refresh = () => { if (document.visibilityState === "visible") state.reload(); };
    const timer = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
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
      Math.floor((Math.min(Date.parse(c.expires_at), Date.parse(c.payment?.expiresAt || c.expires_at)) - counter) / 1000),
    );
  if (c.state === "refunded" || c.state === "partially_refunded")
    return (
      <div className="narrow payment-pending">
        <Heading
          title={
            c.state === "refunded"
              ? t("Pembayaran dikembalikan", "Payment refunded")
              : t(
                  "Sebagian pembayaran dikembalikan",
                  "Payment partially refunded",
                )
          }
        />
        <p>
          {t(
            "Lihat keputusan bantuan untuk rincian refund. Jadwal pengantaran mengikuti keputusan yang dikonfirmasi.",
            "See the support decision for refund details. Delivery schedules follow the confirmed decision.",
          )}
        </p>
        <Link className="button" href="/support">
          {t("Lihat bantuan", "View support")}
        </Link>
        {c.subscription_id && (
          <Link
            className="button secondary"
            href={"/subscriptions/" + c.subscription_id}
          >
            {t("Detail langganan", "Subscription details")}
          </Link>
        )}
      </div>
    );
  if (c.subscription_id && c.state === "paid")
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
            : c.state === "failed"
              ? t("Pembayaran gagal", "Payment failed")
              : c.state === "pending" && seconds
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
          [t("Total", "Total"), currency(c.quote.total, locale)],
          [
            t("Batas pembayaran", "Time remaining"),
            `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
          ],
        ]}
      />
      {c.provider === "doku" && c.provider_environment === "sandbox" && (
        <p className="notice" role="status">
          {t(
            "DOKU Sandbox — pembayaran uji coba, tanpa uang sungguhan.",
            "DOKU Sandbox — test payments, no real money.",
          )}
        </p>
      )}
      {c.state === "payment_exception" ? (
        <p className="notice">
          {t(
            "Pembayaran diterima setelah jadwal tidak tersedia. Tim Catera akan meninjau penyelesaiannya. Anda tidak akan menerima langganan tanpa kapasitas.",
            "Payment arrived after the schedule became unavailable. Catera will review the resolution. You will not receive a subscription without capacity.",
          )}
        </p>
      ) : c.state === "pending" && seconds > 0 ? (
        <>
          {c.payment?.mode === "direct" ? (
            <DirectPayment checkout={c} reload={state.reload} />
          ) : demo ? (
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
          {c.payment?.mode !== "direct" && <p className="small muted">
            QRIS · Virtual Account · E-wallet
            <br />
            {t(
              "Status hanya berubah setelah pembayaran dikonfirmasi.",
              "Status changes only after payment confirmation.",
            )}
          </p>}
        </>
      ) : (
        <Link
          className="button"
          href={
            c.quote.renewedFrom
              ? "/renew/" + c.quote.renewedFrom
              : "/checkout/" +
                c.quote.packageId +
                "?cycles=" +
                (c.quote.cycles ?? 1) +
                "&portions=" +
                c.quote.portions
          }
        >
          {t("Buat jadwal baru", "Choose a new schedule")}
        </Link>
      )}
      {c.payment?.mode === "direct" && c.state === "pending" && seconds === 0 && <p className="notice" role="status">{t("Batas pembayaran telah lewat. Jangan bayar menggunakan instruksi lama. Jika sudah membayar, kami masih memeriksa konfirmasinya.", "The payment deadline has passed. Do not pay using the old instructions. If you already paid, we are still checking confirmation.")}</p>}
      {checkError && <p role="alert">{t("Status belum berhasil diperiksa. Coba lagi.", "Status could not be checked. Please try again.")}</p>}
      <Button className="button secondary" disabled={checking} onClick={async () => {
        setChecking(true); setCheckError(false);
        try { if (c.payment?.mode === "direct") await api.command("checkout.payment.refresh", { id }); state.reload(); }
        catch { setCheckError(true); } finally { setChecking(false); }
      }}>
        <RefreshCw size={17} />
        {checking ? t("Memeriksa…", "Checking…") : t("Periksa status", "Check status")}
      </Button>
    </div>
  );
}
