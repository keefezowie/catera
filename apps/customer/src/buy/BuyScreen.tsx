import { useEffect, useRef, useState } from "react";
import { BackHandler, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import {
  addressPoint,
  currency,
  durationOptions,
  errorLabel,
  nextStartAfter,
  purchaseStartAvailable,
  jakartaDay,
  renewalDefaults,
  shortDate,
  startDates,
  type Checkout,
  type CustomerState,
  type DirectPaymentMethod,
  type Offer,
  type PaymentAvailability,
  type RenewalContext,
} from "@catera/domain";
import { plural, useData, useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import {
  Button,
  FadeSwap,
  RollingNumber,
  fontFor,
  FormError,
  Screen,
  StepHeader,
  Stepper,
  Text,
  themedStyles,
  useBusy,
  useScreenMargin,
  useStackedLayout,
} from "@catera/mobile-ui";
import { Breakdown, LengthOptions, percent, StartLine } from "./Breakdown";
import { BuyAddressCard } from "./BuyAddressCard";
import { BuySummary, FieldGlyph, FieldRow, NoLongerSold, PayWith, PendingPayment, Retry, Terms } from "./BuyParts";
import { FOOTER_STACK_BELOW, footerFits, PAY_MIN_WIDTH } from "./metrics";
import { useQuote, type BuyPayload } from "./useQuote";
import { addressFormHref, addressGlyph } from "../account/Addresses";
import { mapsEnabled } from "../account/pin";
import { useChoice } from "../choice";
import { GLYPH_INSET, ListCard, SectionHeader } from "../layout";
import { FLOW_HREF, goToTab } from "../nav";
import { BreakdownSkeleton, BuySkeleton } from "../skeletons";

/** `Screen`'s body is at most this wide. */
const PAGE_MAX_WIDTH = 760;

/** Choices a link may carry (old /checkout links, Paket); anything invalid falls back to defaults. */
export type BuyInitial = { portions?: string; cycles?: string; startDate?: string; addressId?: string };

const whole = (v: string | undefined, max: number) => {
  const n = Math.trunc(Number(v));
  return n >= 1 && n <= max ? n : null;
};

/**
 * Beli and Perpanjang in two calm steps:
 * 1. Delivery address (with inline map preview & adjust-pin) + plan choices (start date, length, portions).
 * 2. Review summary + itemized price breakdown + explicit payment method + Bayar.
 */
export function BuyScreen({
  packageId = "",
  renewFrom,
  trial = false,
  initial = {},
}: {
  packageId?: string;
  renewFrom?: string;
  trial?: boolean;
  initial?: BuyInitial;
}) {
  const { runtime, actor, ready, t, locale, command, invalidate } = useMobile();
  const styles = useStyles();
  // The amount and CTA share a row while they fit; at large text on a narrow phone they stack.
  const narrow = useStackedLayout(FOOTER_STACK_BELOW);
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const margin = useScreenMargin();
  const renew = !!renewFrom;
  const query = new URLSearchParams({ ...(trial ? { trial: "1" } : {}), ...initial }).toString();
  const here = `${renew ? `/renew/${encodeURIComponent(renewFrom)}` : `/beli/${encodeURIComponent(packageId)}`}${query ? `?${query}` : ""}`;
  useEffect(() => {
    if (ready && !actor) router.replace(`/login?next=${encodeURIComponent(here)}` as never);
  }, [ready, actor, here]);

  const [step, setStep] = useState<1 | 2>(1);
  // Clean renewals without URL overrides open on the calm 1-tap "Perpanjang sama persis" confirmation card.
  const hasInitialOverrides = Boolean(initial.portions || initial.cycles || initial.startDate || initial.addressId);
  const [fastRenew, setFastRenew] = useState(renew && !hasInitialOverrides);
  const [showFastBreakdown, setShowFastBreakdown] = useState(false);
  const [cycles, setCycles] = useState(trial ? 1 : (whole(initial.cycles, 6) ?? 1));
  const [portions, setPortions] = useState<number | null>(whole(initial.portions, 100));
  const [addressId, setAddressId] = useState<string | null>(initial.addressId || null);
  const [start, setStart] = useState<string | null>(null);
  const [method, setMethod] = useState<DirectPaymentMethod | null>(null);
  // The address and start-date pickers are native choice sheets over Beli (`/pembelian/alamat-pilih`,
  // `/pembelian/mulai`): the purchase stays underneath with every choice made so far.
  const choose = useChoice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Hardware back on Step 2 returns cleanly to Step 1 instead of discarding the purchase.
  useEffect(() => {
    if (step !== 2) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep(1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const signed = !!actor;
  const methods = useData<PaymentAvailability | null>("payment-methods", () =>
    signed ? runtime.api.request<PaymentAvailability>("payment-methods") : Promise.resolve(null),
  );
  const customer = useData<CustomerState | null>("beli-customer", () =>
    signed ? runtime.api.customer() : Promise.resolve(null),
  );
  const loaded = useData<{ offer: Offer | null } | null>(`beli:${packageId}`, () =>
    signed && !renew ? runtime.api.offer(packageId) : Promise.resolve(null),
  );
  // Renewal facts for the chosen length; the last answer stays on screen while the next loads.
  const context = useData<RenewalContext | null>(`perpanjang:${renewFrom}:${cycles}`, () =>
    signed && renew ? runtime.api.renewalContext(renewFrom, undefined, cycles) : Promise.resolve(null),
  );
  const lastContext = useRef<RenewalContext | null>(null);
  if (context.data) lastContext.current = context.data;
  const ctx = context.data ?? lastContext.current;

  const offer = renew ? ctx?.offers.find((o) => o.id === ctx.packageId) : (loaded.data?.offer ?? undefined);
  const addresses = customer.data?.addresses ?? [];
  // A choice made here counts only while the customer still has that address: one removed in Kelola alamat falls back
  // to the screen's own first pick.
  const kept = addressId && addresses.some((a) => a.id === addressId) ? addressId : null;
  const chosenId = kept ?? (renew ? ctx?.addressId : null) ?? addresses[0]?.id ?? null;
  const address =
    addresses.find((a) => a.id === chosenId) ?? (ctx?.address?.id === chosenId ? ctx?.address : undefined);
  const current = customer.data?.subscriptions.find((s) => s.id === renewFrom);
  const choices = offer && !renew ? startDates(offer, now, 8) : [];
  const startDate = renew
    ? ctx?.startDate || (current && offer ? renewalDefaults(current, offer).startDate : null)
    : (start ??
      (initial.startDate && offer && purchaseStartAvailable(offer, initial.startDate, now) ? initial.startDate : null) ??
      choices[0] ??
      null);
  // The caterer's plans that end before a renewal starts: the server counts every plan at the same caterer, so the latest
  // end among them is what the start waits for. A plan of another package is named; the renewed package is "this package".
  const catererOf = (s: { snapshot?: { offer?: { catererId?: string } } | null }) => s.snapshot?.offer?.catererId;
  const blocking =
    renew && startDate && current
      ? (customer.data?.subscriptions ?? [])
          .filter(
            (s) =>
              s.status !== "cancelled" &&
              s.ends_on < startDate &&
              (catererOf(current) ? catererOf(s) === catererOf(current) : s.package_id === current.package_id),
          )
          .sort((x, y) => (x.ends_on < y.ends_on ? -1 : x.ends_on > y.ends_on ? 1 : x.id === current.id ? 1 : y.id === current.id ? -1 : 0))
          .pop() ?? null
      : null;
  const blockingEnd = blocking?.ends_on ?? null;
  const blockingName =
    blocking && blocking.package_id !== current?.package_id ? (blocking.snapshot?.offer?.name ?? null) : null;
  const qty = portions ?? (renew ? ctx?.portions : null) ?? 1;
  const maxQty = trial ? offer?.trialMax || 100 : 100;
  const lengths = offer ? durationOptions(offer) : [];

  // A saved address from before pins is asked for one here. An address outside the book can't be edited, so it isn't.
  const needsPin = mapsEnabled() && !!address && !addressPoint(address) && addresses.some((a) => a.id === address.id);
  // Nothing is "missing" until the customer's addresses and package have loaded.
  const blocked = !offer || (!customer.data && !customer.error)
    ? ""
    : !address
      ? t("Tambahkan alamat pengantaran dulu.", "Add a delivery address first.")
      : !offer.areas.includes(address.area)
        ? t(`Alamat ini di luar jangkauan ${offer.caterer}. Pilih alamat lain.`, `This address is outside ${offer.caterer}'s area. Choose another.`)
        : renew && ctx && !ctx.available && !ctx.pendingCheckoutId
          ? t("Paket ini belum bisa diperpanjang untuk jadwal berikutnya. Coba lagi nanti.", "This package can't be renewed for the next schedule yet. Try again later.")
          : !startDate || !purchaseStartAvailable(offer, startDate, now)
            ? t("Tanggal mulai sudah lewat batas pesan. Pilih tanggal lain.", "The start date is past the order cutoff. Choose another.")
            : !lengths.some((d) => d.cycles === cycles) || qty > maxQty
              ? t("Pilihan ini tidak tersedia untuk paket ini.", "This choice isn't available for this package.")
              : "";
  const payload: BuyPayload | null =
    offer && address && startDate && !blocked
      ? {
          packageId: offer.id,
          addressId: address.id,
          portions: qty,
          startDate,
          cycles,
          trial,
          ...(renew ? { renewedFrom: renewFrom } : {}),
        }
      : null;
  // The server's quote copies the address record, pin included: a pin saved on this address changes it.
  const quote = useQuote(payload, address);
  // The same package is still running: offer the first day after it instead of a dead-end retry.
  const running =
    quote.errorCode === "OVERLAP" && offer && !renew ? nextStartAfter(offer, customer.data?.subscriptions ?? [], now) : null;

  const pay = methods.data;
  const available = pay?.mode === "direct" ? pay.availableMethods : [];
  const fallback = available.includes("QRIS") ? "QRIS" : (available[0] ?? null);
  const chosenMethod = method && available.includes(method) ? method : fallback;
  const payable = !!pay && (pay.mode !== "direct" || !!chosenMethod);
  const pendingCheckout = renew ? ctx?.pendingCheckoutId : null;
  const loadError = [loaded, context, customer, methods].find((r) => r.error && !r.data)?.error;
  const reloadAll = () => [loaded, context, customer, methods].forEach((r) => void r.reload());

  // If a prerequisite breaks while on Step 2 (e.g. address deleted or cutoff passed), step back to Step 1 cleanly.
  useEffect(() => {
    if (step === 2 && (needsPin || !!blocked || !address)) setStep(1);
  }, [step, needsPin, blocked, address]);

  async function pickAddress() {
    const picked = await choose("/pembelian/alamat-pilih", {
      title: t("Alamat pengantaran", "Delivery address"),
      items: addresses.map((a) => ({ id: a.id, label: a.label, detail: a.line, icon: addressGlyph(a.label) })),
      selected: address?.id,
      // Tambah alamat and Kelola alamat: the sheet opens the form or Alamat over the purchase in its own place.
      extras: [
        { key: "tambah", label: t("Tambah alamat", "Add address"), href: FLOW_HREF.alamatForm },
        { key: "kelola", label: t("Kelola alamat", "Manage addresses"), href: FLOW_HREF.alamat },
      ],
    });
    if (picked && picked !== "kelola" && picked !== "tambah") setAddressId(picked);
  }

  async function pickStart() {
    const picked = await choose("/pembelian/mulai", {
      title: t("Mulai tanggal", "Start date"),
      items: choices.map((d) => ({ id: d, label: shortDate(d, locale) })),
      selected: startDate,
    });
    if (picked) setStart(picked);
  }

  // The ref inside `useBusy` drops a second tap that lands before `busy` has re-rendered; `busy` itself stays set once
  // the checkout exists, so the button stays busy while the screen is replaced.
  const [, submit] = useBusy(async () => {
    if (!payload || !quote.ready || busy) return;
    setBusy(true);
    setError("");
    try {
      // One reload for the whole purchase: when a start follows, the app catches up after it, not before and after.
      const created = await command<Checkout>(
        "checkout.create",
        { ...payload, expectedQuote: quote.ready, acceptedTerms: true },
        { refresh: !chosenMethod },
      );
      // A start that fails is offered again on Bayar; the checkout already holds the days.
      if (chosenMethod)
        await command("checkout.payment.start", { id: created.id, method: chosenMethod }).catch(() => invalidate());
      router.replace(`/bayar/${encodeURIComponent(created.id)}` as never);
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Pembayaran belum bisa dimulai. Coba lagi.", "Couldn't start the payment. Try again."));
      setFailures((n) => n + 1);
      quote.retry();
      setBusy(false);
    }
  });

  // The flow sits in a full-screen modal under the native header, with Close at its leading edge; the screen names
  // itself through its native title in every state.
  // The renewed package is no longer sold: offer the caterer's other packages, never a spinner.
  if (ready && actor && renew && ctx && (ctx.replacementRequired || !offer))
    return (
      <Screen nativeTitle={t("Perpanjang", "Renew")}>
        {/* An open checkout comes first: paying it beats starting a second purchase. */}
        {pendingCheckout ? <PendingPayment checkoutId={pendingCheckout} t={t} /> : null}
        <NoLongerSold
          caterer={ctx.offers[0]?.caterer || current?.snapshot.offer?.caterer || t("kateringmu", "your caterer")}
          offers={ctx.offers.filter((o) => o.id !== ctx.packageId)}
          t={t}
        />
      </Screen>
    );
  if (!ready || !actor || !offer)
    return (
      <Screen nativeTitle={renew ? t("Perpanjang", "Renew") : t("Beli", "Buy")}>
        {/* The same FadeSwap as the loaded page below, so the choices fade in from their skeleton as one block. */}
        <FadeSwap
          swapKey={loadError ? "error" : loaded.data && !loaded.data.offer ? "missing" : "loading"}
          style={{ gap: 16 }}
        >
          {loadError ? (
            // Nothing of the page could be read: the failure is the page, so the puzzled mascot leads it.
            <Retry art message={loadError} onRetry={reloadAll} t={t} />
          ) : loaded.data && !loaded.data.offer ? (
            <Text variant="heading">{t("Paket tidak ditemukan.", "Package not found.")}</Text>
          ) : (
            <BuySkeleton />
          )}
        </FadeSwap>
      </Screen>
    );

  const shown = quote.shown;
  const loadingRead = (r: { data: unknown; error?: unknown }) => !r.data && !r.error;
  const waiting =
    quote.pending || loadingRead(customer) || loadingRead(methods) || (renew && loadingRead(context));
  // The price does not depend on the pin, so a missing pin is a step before paying, not a reason to hide the price.
  // Everything else in order and only the pin missing: the footer button leads to that step.
  const pinStep = needsPin && !blocked && !pendingCheckout;
  const noAddressStep = !address && !!customer.data && !pendingCheckout;
  const showFastRenew = renew && fastRenew && !!address && !needsPin && !blocked && !pendingCheckout;
  const step1Disabled =
    !pinStep && !noAddressStep && (!quote.ready || !!blocked || !!pendingCheckout || (renew && !context.data));
  const step2Disabled = !quote.ready || !payable || !!pendingCheckout || (renew && !context.data);
  const disabled = showFastRenew || step === 2 ? step2Disabled : step1Disabled;

  const why =
    !disabled || loadError
      ? ""
      : waiting
        ? t("Menghitung total…", "Calculating the total…")
        : !address
          ? addresses.length
            ? t("Pilih alamat dulu.", "Choose an address first.")
            : t("Tambahkan alamat dulu.", "Add an address first.")
          : !startDate
            ? t("Pilih tanggal mulai dulu.", "Choose a start date first.")
            : pendingCheckout
              ? t("Ada pembayaran yang belum selesai.", "A payment is still open.")
              : quote.error ||
                blocked ||
                // Every other reason holds; a direct payment with no method left to pay by is the one that remains.
                ((showFastRenew || step === 2) && !payable
                  ? t("Pembayaran belum tersedia. Coba lagi nanti.", "Payment isn't available yet. Try again later.")
                  : "");

  const amountText = shown ? currency(shown.total, locale) : quote.pending ? t("Menghitung…", "Calculating…") : "-";
  const ctaLabel =
    showFastRenew || step === 2
      ? quote.ready
        ? t(`Bayar ${currency(quote.ready.total, locale)}`, `Pay ${currency(quote.ready.total, locale)}`)
        : t("Bayar", "Pay")
      : pinStep
        ? t("Tandai titik dulu", "Mark the spot first")
        : noAddressStep
          ? t("Tambah alamat dulu", "Add an address first")
          : t("Lanjut ke ringkasan", "Continue to review");

  // The amount and CTA share a row while both fit whole; otherwise they stack.
  const stacked =
    narrow || !footerFits(amountText, ctaLabel, Math.min(windowWidth, PAGE_MAX_WIDTH) - margin * 2, fontScale);

  function markSpot() {
    if (!address) return;
    // Saving an address reorders the list; keep the one being marked as this purchase's address.
    setAddressId(address.id);
    router.push(addressFormHref(true, address.id) as never);
  }
  function addAddressDirect() {
    router.push(addressFormHref(true) as never);
  }
  function handlePrimary() {
    if (showFastRenew || step === 2) {
      void submit();
      return;
    }
    if (pinStep) return markSpot();
    if (noAddressStep) return addAddressDirect();
    setError("");
    setStep(2);
  }

  const footer = (
    <View style={{ gap: nativeLayout.groupGap }}>
      {error ? <FormError message={error} failureKey={failures} /> : null}
      {why ? (
        <Text testID="buy-pay-reason" variant="meta" selectable>
          {why}
        </Text>
      ) : null}
      <View testID="buy-footer-row" style={[styles.footer, stacked && styles.footerStacked]}>
        <View style={stacked ? undefined : styles.total}>
          <Text variant="meta">{t("Total", "Total")}</Text>
          {shown ? (
            <RollingNumber variant="section" selectable accessibilityRole="text" accessibilityLabel={amountText} value={amountText} style={[styles.amount, quote.pending && { opacity: 0.45 }]} />
          ) : (
            <Text variant="section" selectable accessibilityRole="text" accessibilityLabel={quote.pending ? amountText : t("Belum ada harga", "No price yet")} style={[styles.amount, quote.pending && { opacity: 0.45 }]}>
              {amountText}
            </Text>
          )}
        </View>
        <Button
          variant="primary"
          label={ctaLabel}
          accessibilityHint={why || undefined}
          busy={(showFastRenew || step === 2) && busy}
          disabled={disabled}
          onPress={handlePrimary}
          style={stacked ? styles.payStacked : styles.pay}
        />
      </View>
    </View>
  );

  const pricing = !!shown || quote.pending || !!quote.error;
  const reviewDays = shown?.dates.length ?? offer.days * cycles;
  const reviewSchedule = [
    t(`${reviewDays} hari`, plural(reviewDays, "day")),
    startDate ? t(`mulai ${shortDate(startDate, locale)}`, `starts ${shortDate(startDate, locale)}`) : "",
    t(`${qty} porsi/hari`, `${plural(qty, "portion")}/day`),
  ]
    .filter(Boolean)
    .join(" · ");

  if (showFastRenew) {
    return (
      <Screen footer={footer} nativeTitle={t("Perpanjang", "Renew")}>
        <FadeSwap swapKey="fast-renew" style={{ gap: nativeLayout.sectionGap }}>
          {loadError ? <Retry message={loadError} onRetry={reloadAll} t={t} /> : null}
          <View testID="fast-renew" style={{ gap: nativeLayout.space.xl }}>
            <View style={{ gap: 4 }}>
              <Text variant="heading" accessibilityRole="header">
                {t("Perpanjang sama persis", "Renew with same details")}
              </Text>
              <Text variant="meta">
                {t(
                  "Paket, porsi, dan alamat sama seperti sebelumnya. Cek sebentar, lalu bayar.",
                  "Same package, portions, and address as before. Quick check, then pay.",
                )}
              </Text>
            </View>

            <ListCard inset={GLYPH_INSET}>
              <StartLine
                startDate={startDate}
                renew
                currentEnd={current?.ends_on ?? null}
                blockingEnd={blockingEnd}
                blockingName={blockingName}
                today={jakartaDay(now)}
                quote={shown}
                dimmed={quote.pending}
                weekdays={offer.weekdays}
                locale={locale}
                t={t}
              />
              <FieldRow id="fast-plan" icon="restaurant-outline" minHeight={nativeLayout.row.single}>
                <Text variant="bodyStrong">{offer.name}</Text>
                <Text variant="meta">{reviewSchedule}</Text>
              </FieldRow>
              <FieldRow id="fast-address" icon="location-outline" minHeight={nativeLayout.row.media}>
                <Text variant="meta">{t("Diantar ke", "Delivered to")}</Text>
                <Text variant="bodyStrong">{address.label}</Text>
                <Text variant="meta">{address.line}</Text>
              </FieldRow>
            </ListCard>

            {pricing ? (
              <View style={{ gap: nativeLayout.space.sm }}>
                <Button
                  variant="text"
                  label={
                    showFastBreakdown
                      ? t("Sembunyikan rincian harga", "Hide price breakdown")
                      : t("Lihat rincian harga", "View price breakdown")
                  }
                  onPress={() => setShowFastBreakdown((v) => !v)}
                  style={{ alignSelf: "flex-start" }}
                />
                {showFastBreakdown ? (
                  shown ? (
                    <Breakdown quote={shown} dimmed={quote.pending} locale={locale} t={t} />
                  ) : quote.pending ? (
                    <BreakdownSkeleton />
                  ) : null
                ) : null}
                {quote.error ? (
                  <Retry message={quote.error} label={t("Hitung ulang", "Recalculate")} onRetry={quote.retry} t={t} />
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: nativeLayout.space.md }}>
              <PayWith section availability={pay} chosen={chosenMethod} onChoose={setMethod} t={t} />
              <View testID="renew-edit-details">
                <Button
                  variant="secondary"
                  label={t("Ubah tanggal, porsi, atau alamat", "Change dates, portions, or address")}
                  onPress={() => {
                    setFastRenew(false);
                    setStep(1);
                  }}
                />
              </View>
              <Terms apiBase={runtime.apiBase} t={t} />
            </View>
          </View>
        </FadeSwap>
      </Screen>
    );
  }

  return (
    <Screen footer={footer} nativeTitle={renew ? t("Perpanjang", "Renew") : t("Beli", "Buy")}>
      <FadeSwap swapKey={`ready-${step}`} style={{ gap: nativeLayout.sectionGap }}>
        <StepHeader
          step={step}
          total={2}
          backLabel={step === 2 ? t("Kembali ke pengaturan paket", "Back to package options") : undefined}
          onBack={step === 2 ? () => setStep(1) : undefined}
        />

        {loadError ? <Retry message={loadError} onRetry={reloadAll} t={t} /> : null}
        {pendingCheckout ? <PendingPayment checkoutId={pendingCheckout} t={t} /> : null}

        {step === 1 ? (
          <View testID="buy-step-1" style={{ gap: nativeLayout.space.xl }}>
            <BuySummary offer={offer} trial={trial} apiBase={runtime.apiBase} locale={locale} />

            <BuyAddressCard
              address={address}
              needsPin={needsPin}
              onPickAddress={() => void pickAddress()}
              onAddAddress={addAddressDirect}
              onAdjustPin={markSpot}
              t={t}
            />

            <View style={{ gap: nativeLayout.groupGap }}>
              <ListCard inset={GLYPH_INSET}>
                <StartLine
                  startDate={startDate}
                  renew={renew}
                  currentEnd={current?.ends_on ?? null}
                  blockingEnd={blockingEnd}
                  blockingName={blockingName}
                  today={jakartaDay(now)}
                  quote={shown}
                  dimmed={quote.pending}
                  weekdays={offer.weekdays}
                  onChange={choices.length > 1 ? () => void pickStart() : undefined}
                  locale={locale}
                  t={t}
                />
                {trial || lengths.length === 1 ? (
                  <FieldRow id="length" icon="time-outline" minHeight={nativeLayout.row.single}>
                    <Text variant="meta">{t("Lama paket", "Package length")}</Text>
                    <Text variant="bodyStrong">
                      {trial
                        ? t("1 hari, coba dulu", "1 day, as a trial")
                        : t(`${offer.days * lengths[0].cycles} hari`, plural(offer.days * lengths[0].cycles, "day"))}
                    </Text>
                  </FieldRow>
                ) : (
                  <FieldRow
                    id="length"
                    icon="time-outline"
                    minHeight={nativeLayout.row.single}
                    below={
                      <LengthOptions
                        value={cycles}
                        onChange={setCycles}
                        options={lengths.map((d) => ({
                          cycles: d.cycles,
                          label:
                            t(`${offer.days * d.cycles} hari`, plural(offer.days * d.cycles, "day")) +
                            (d.discountPercent ? t(` · Hemat ${percent(d.discountPercent, locale)}`, ` · Save ${percent(d.discountPercent, locale)}`) : ""),
                        }))}
                      />
                    }
                  >
                    <Text variant="meta">{t("Lama paket", "Package length")}</Text>
                  </FieldRow>
                )}
                <Stepper
                  testID="buy-row-portions"
                  leading={<FieldGlyph id="portions" icon="restaurant-outline" />}
                  label={t("Porsi per hari", "Portions per day")}
                  decreaseLabel={t("Kurangi porsi", "Decrease portions")}
                  increaseLabel={t("Tambah porsi", "Increase portions")}
                  value={qty}
                  onChange={setPortions}
                  min={1}
                  max={maxQty}
                />
              </ListCard>
              {blocked ? <FormError message={blocked} /> : null}
              {quote.error ? (
                running ? (
                  <View style={{ gap: nativeLayout.groupGap }}>
                    <Text>
                      {t(`Paket ini masih berjalan sampai ${shortDate(running.endsOn, locale)}.`, `This package is still running until ${shortDate(running.endsOn, locale)}.`)}
                    </Text>
                    <Button
                      variant="secondary"
                      label={t(`Mulai ${shortDate(running.start, locale)}`, `Start ${shortDate(running.start, locale)}`)}
                      onPress={() => setStart(running.start)}
                    />
                  </View>
                ) : (
                  <Retry message={quote.error} label={t("Hitung ulang", "Recalculate")} onRetry={quote.retry} t={t} />
                )
              ) : null}
            </View>
          </View>
        ) : (
          <View testID="buy-step-2" style={{ gap: nativeLayout.sectionGap }}>
            <View>
              <SectionHeader
                title={t("Ringkasan pesanan", "Order summary")}
                action={{ label: t("Ubah pesanan", "Edit order"), onPress: () => setStep(1) }}
              />
              <View testID="buy-review-summary">
                <ListCard inset={GLYPH_INSET}>
                  <FieldRow id="review-plan" icon="restaurant-outline" minHeight={nativeLayout.row.media}>
                    <Text variant="bodyStrong">{offer.name}</Text>
                    <Text variant="meta">{reviewSchedule}</Text>
                  </FieldRow>
                  {address ? (
                    <FieldRow id="review-address" icon="location-outline" minHeight={nativeLayout.row.media}>
                      <Text variant="meta">{t("Diantar ke", "Delivered to")}</Text>
                      <Text variant="bodyStrong">{address.label}</Text>
                      <Text variant="meta">{address.line}</Text>
                    </FieldRow>
                  ) : null}
                </ListCard>
              </View>
            </View>

            {pricing ? (
              <View>
                <SectionHeader title={t("Rincian", "Breakdown")} />
                <View style={{ gap: nativeLayout.space.md }}>
                  {shown ? <Breakdown quote={shown} dimmed={quote.pending} locale={locale} t={t} /> : null}
                  {!shown && quote.pending ? <BreakdownSkeleton /> : null}
                  {quote.error ? (
                    <Retry message={quote.error} label={t("Hitung ulang", "Recalculate")} onRetry={quote.retry} t={t} />
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={{ gap: nativeLayout.space.md }}>
              <PayWith section availability={pay} chosen={chosenMethod} onChoose={setMethod} t={t} />
              <Terms apiBase={runtime.apiBase} t={t} />
            </View>
          </View>
        )}
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles(() => ({
  footer: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md },
  footerStacked: { flexDirection: "column", alignItems: "stretch" },
  total: { flex: 1, minWidth: 0 },
  amount: { fontFamily: fontFor("800"), fontVariant: ["tabular-nums"] },
  pay: { minWidth: PAY_MIN_WIDTH },
  payStacked: { alignSelf: "stretch" },
}));
