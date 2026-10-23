import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import {
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
import { Button, FadeSwap, fontFor, FormError, Screen, Stepper, Text, themedStyles, useScreenMargin, useStackedLayout } from "@catera/mobile-ui";
import { Breakdown, LengthOptions, percent, StartLine } from "./Breakdown";
import { BuySummary, FieldGlyph, FieldRow, NoLongerSold, PayWith, PendingPayment, Retry, Terms } from "./BuyParts";
import { FOOTER_STACK_BELOW, footerFits, PAY_MIN_WIDTH } from "./metrics";
import { useQuote, type BuyPayload } from "./useQuote";
import { useChoice } from "../choice";
import { GLYPH_INSET, ListCard, SectionHeader } from "../layout";
import { FLOW_HREF } from "../nav";
import { BreakdownSkeleton, BuySkeleton } from "../skeletons";

/** `Screen`'s body is at most this wide. */
const PAGE_MAX_WIDTH = 760;

/** Choices a link may carry (old /checkout links, Paket); anything invalid falls back to defaults. */
export type BuyInitial = { portions?: string; cycles?: string; startDate?: string; addressId?: string };

const whole = (v: string | undefined, max: number) => {
  const n = Math.trunc(Number(v));
  return n >= 1 && n <= max ? n : null;
};

/** Beli and Perpanjang on one screen: sensible defaults, the server's full price, then Bayar. */
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
  const { runtime, actor, ready, t, locale, command } = useMobile();
  const styles = useStyles();
  // The amount and Bayar share a row while they fit; at large text on a narrow phone they stack.
  const narrow = useStackedLayout(FOOTER_STACK_BELOW);
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const margin = useScreenMargin();
  const renew = !!renewFrom;
  const query = new URLSearchParams({ ...(trial ? { trial: "1" } : {}), ...initial }).toString();
  const here = `${renew ? `/renew/${encodeURIComponent(renewFrom)}` : `/beli/${encodeURIComponent(packageId)}`}${query ? `?${query}` : ""}`;
  useEffect(() => {
    if (ready && !actor) router.replace(`/login?next=${encodeURIComponent(here)}` as never);
  }, [ready, actor, here]);

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
  const quote = useQuote(payload);
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

  async function pickAddress() {
    const picked = await choose("/pembelian/alamat-pilih", {
      title: t("Alamat pengantaran", "Delivery address"),
      items: addresses.map((a) => ({ id: a.id, label: a.label, detail: a.line })),
      selected: address?.id,
      // Kelola alamat: the sheet opens Alamat over the purchase in its own place.
      extra: { key: "kelola", label: t("Kelola alamat", "Manage addresses"), href: FLOW_HREF.alamat },
    });
    if (picked && picked !== "kelola") setAddressId(picked);
  }

  async function pickStart() {
    const picked = await choose("/pembelian/mulai", {
      title: t("Mulai tanggal", "Start date"),
      items: choices.map((d) => ({ id: d, label: shortDate(d, locale) })),
      selected: startDate,
    });
    if (picked) setStart(picked);
  }

  async function submit() {
    if (!payload || !quote.ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await command<Checkout>("checkout.create", {
        ...payload,
        expectedQuote: quote.ready,
        acceptedTerms: true,
      });
      // A start that fails is offered again on Bayar; the checkout already holds the days.
      if (chosenMethod)
        await command("checkout.payment.start", { id: created.id, method: chosenMethod }).catch(() => undefined);
      router.replace(`/bayar/${encodeURIComponent(created.id)}` as never);
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Pembayaran belum bisa dimulai. Coba lagi.", "Couldn't start the payment. Try again."));
      setFailures((n) => n + 1);
      quote.retry();
      setBusy(false);
    }
  }

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
  const disabled = !quote.ready || !payable || !!pendingCheckout || (renew && !context.data);
  // A Bayar that cannot be pressed says why, one line above it, the first reason that holds (deep pages R1). A read that
  // failed already shows its Retry on the page, so the footer then says nothing rather than claim it is still counting.
  const why =
    !disabled || loadError
      ? ""
      : waiting
        ? t("Menghitung total…", "Working out the total…")
        : !address
          ? addresses.length
            ? t("Pilih alamat dulu.", "Choose an address first.")
            : t("Tambahkan alamat dulu.", "Add an address first.")
          : !startDate
            ? t("Pilih tanggal mulai dulu.", "Choose a start date first.")
            : pendingCheckout
              ? t("Ada pembayaran yang belum selesai.", "A payment is still open.")
              : quote.error || blocked;
  const amountText = shown ? currency(shown.total, locale) : quote.pending ? t("Menghitung…", "Working out…") : "-";
  const payLabel = quote.ready
    ? t(`Bayar ${currency(quote.ready.total, locale)}`, `Pay ${currency(quote.ready.total, locale)}`)
    : t("Bayar", "Pay");
  // The amount and Bayar share a row while both fit whole; otherwise they stack.
  const stacked =
    narrow || !footerFits(amountText, payLabel, Math.min(windowWidth, PAGE_MAX_WIDTH) - margin * 2, fontScale);
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
          <Text variant="section" selectable accessibilityRole="text" style={[styles.amount, quote.pending && { opacity: 0.45 }]}>
            {amountText}
          </Text>
        </View>
        <Button
          variant="primary"
          label={payLabel}
          accessibilityHint={why || undefined}
          busy={busy}
          disabled={disabled}
          onPress={() => void submit()}
          style={stacked ? styles.payStacked : styles.pay}
        />
      </View>
    </View>
  );
  // Rincian shows once there is a price, one on its way or a reason there is none.
  const pricing = !!shown || quote.pending || !!quote.error;

  return (
    <Screen footer={footer} nativeTitle={renew ? t("Perpanjang", "Renew") : t("Beli", "Buy")}>
      <FadeSwap swapKey="ready" style={{ gap: nativeLayout.sectionGap }}>
        <View style={{ gap: nativeLayout.space.xl }}>
          {loadError ? <Retry message={loadError} onRetry={reloadAll} t={t} /> : null}
          {pendingCheckout ? <PendingPayment checkoutId={pendingCheckout} t={t} /> : null}

          <BuySummary offer={offer} trial={trial} apiBase={runtime.apiBase} locale={locale} />

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
                decreaseLabel={t("Kurangi Porsi per hari", "Decrease Portions per day")}
                increaseLabel={t("Tambah Porsi per hari", "Increase Portions per day")}
                value={qty}
                onChange={setPortions}
                min={1}
                max={maxQty}
              />
              <FieldRow
                id="address"
                icon="location-outline"
                minHeight={nativeLayout.row.media}
                trailing={
                  <Button
                    variant="text"
                    label={address ? t("Ganti", "Change") : t("Tambah alamat", "Add address")}
                    accessibilityLabel={address ? t("Ganti alamat", "Change address") : undefined}
                    onPress={() => (address ? void pickAddress() : router.push(FLOW_HREF.alamat as never))}
                  />
                }
              >
                <Text variant="meta">{t("Diantar ke", "Delivered to")}</Text>
                {address ? (
                  <>
                    <Text variant="bodyStrong">{address.label}</Text>
                    <Text variant="meta">{address.line}</Text>
                  </>
                ) : (
                  <Text variant="bodyStrong">{t("Belum ada alamat pengantaran.", "No delivery address yet.")}</Text>
                )}
              </FieldRow>
            </ListCard>
            {blocked ? <FormError message={blocked} /> : null}
          </View>
        </View>

        {pricing ? (
          <View>
            <SectionHeader title={t("Rincian", "Breakdown")} />
            <View style={{ gap: nativeLayout.space.md }}>
              {shown ? <Breakdown quote={shown} dimmed={quote.pending} locale={locale} t={t} /> : null}
              {!shown && quote.pending ? <BreakdownSkeleton /> : null}
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
        ) : null}

        <View style={{ gap: nativeLayout.space.md }}>
          <PayWith section availability={pay} chosen={chosenMethod} onChoose={setMethod} t={t} />
          <Terms apiBase={runtime.apiBase} t={t} />
        </View>
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
