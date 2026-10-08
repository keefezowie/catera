import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  addDays,
  currency,
  durationOptions,
  errorLabel,
  localDay,
  purchaseStartAvailable,
  renewalDefaults,
  shortDate,
  type Checkout,
  type CustomerState,
  type DirectPaymentMethod,
  type Offer,
  type PaymentAvailability,
  type RenewalContext,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, fontFor, Screen, Stepper, Text } from "@catera/mobile-ui";
import { RoundButton } from "../discover/PackageCard";
import { SunriseButton } from "../today/Plate";
import { Breakdown, LengthOptions, percent, StartLine } from "./Breakdown";
import { ChoiceSheet, NoLongerSold, PayWith, PendingPayment, Retry, Terms } from "./BuyParts";
import { useQuote, type BuyPayload } from "./useQuote";

/** Choices a link may carry (old /checkout links, Paket); anything invalid falls back to defaults. */
export type BuyInitial = { portions?: string; cycles?: string; startDate?: string; addressId?: string };

const whole = (v: string | undefined, max: number) => {
  const n = Math.trunc(Number(v));
  return n >= 1 && n <= max ? n : null;
};
const leave = () => (router.canGoBack() ? router.back() : router.replace("/" as never));
const tabular = { fontVariant: ["tabular-nums" as const] };

/** Bookable start dates for a new purchase, soonest first, within three weeks. */
function startDates(offer: Offer, now: Date, count: number) {
  const out: string[] = [];
  for (let i = 0, d = localDay(now); i < 21 && out.length < count; i += 1, d = addDays(d, 1))
    if (purchaseStartAvailable(offer, d, now)) out.push(d);
  return out;
}

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
  const [sheet, setSheet] = useState<"" | "address" | "start">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const chosenId = addressId ?? (renew ? ctx?.addressId : null) ?? addresses[0]?.id ?? null;
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

  const pay = methods.data;
  const available = pay?.mode === "direct" ? pay.availableMethods : [];
  const fallback = available.includes("QRIS") ? "QRIS" : (available[0] ?? null);
  const chosenMethod = method && available.includes(method) ? method : fallback;
  const payable = !!pay && (pay.mode !== "direct" || !!chosenMethod);
  const pendingCheckout = renew ? ctx?.pendingCheckoutId : null;
  const loadError = [loaded, context, customer, methods].find((r) => r.error && !r.data)?.error;
  const reloadAll = () => [loaded, context, customer, methods].forEach((r) => void r.reload());

  async function submit() {
    if (!payload || !quote.ready) return;
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
      setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
      quote.retry();
      setBusy(false);
    }
  }

  // The renewed package is no longer sold: offer the caterer's other packages, never a spinner.
  if (ready && actor && renew && ctx && (ctx.replacementRequired || !offer))
    return (
      <Screen>
        <RoundButton icon="chevron-back" label={t("Kembali", "Back")} onPress={leave} />
        {/* An open checkout comes first: paying it beats starting a second purchase. */}
        {pendingCheckout ? <PendingPayment checkoutId={pendingCheckout} t={t} /> : null}
        <NoLongerSold
          caterer={ctx.offers[0]?.caterer || current?.snapshot.offer?.caterer || t("katering Anda", "your caterer")}
          offers={ctx.offers.filter((o) => o.id !== ctx.packageId)}
          t={t}
        />
      </Screen>
    );
  if (!ready || !actor || !offer)
    return (
      <Screen>
        <RoundButton icon="chevron-back" label={t("Kembali", "Back")} onPress={leave} />
        {loadError ? (
          <Retry message={loadError} onRetry={reloadAll} t={t} />
        ) : loaded.data && !loaded.data.offer ? (
          <Text variant="heading">{t("Paket tidak ditemukan.", "Package not found.")}</Text>
        ) : (
          <ActivityIndicator color={colors.forest} />
        )}
      </Screen>
    );

  const shown = quote.shown;
  const footer = (
    <View style={{ gap: 8 }}>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text variant="caption">Total</Text>
          <Text variant="title" style={[{ fontSize: 22 }, tabular, quote.pending && { opacity: 0.45 }]}>
            {shown ? currency(shown.total, locale) : "–"}
          </Text>
        </View>
        <SunriseButton
          label={t("Bayar", "Pay")}
          disabled={!quote.ready || !payable || busy || !!pendingCheckout || (renew && !context.data)}
          onPress={() => void submit()}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );

  return (
    <Screen footer={footer}>
      <View style={styles.header}>
        <RoundButton icon="chevron-back" label={t("Kembali", "Back")} onPress={leave} />
        <Text variant="heading" style={{ flex: 1 }} numberOfLines={2}>
          {renew ? t(`Perpanjang ${offer.name}`, `Renew ${offer.name}`) : offer.name}
        </Text>
      </View>
      {loadError ? <Retry message={loadError} onRetry={reloadAll} t={t} /> : null}
      {pendingCheckout ? <PendingPayment checkoutId={pendingCheckout} t={t} /> : null}

      <StartLine
        startDate={startDate}
        renew={renew}
        quote={shown}
        dimmed={quote.pending}
        weekdays={offer.weekdays}
        onChange={choices.length > 1 ? () => setSheet("start") : undefined}
        locale={locale}
        t={t}
      />

      <View style={{ gap: 8 }}>
        <Text variant="label">{t("Lama paket", "Length")}</Text>
        {trial ? (
          <Text>{t("1 hari, coba dulu", "1 day, as a trial")}</Text>
        ) : (
          <LengthOptions
            value={cycles}
            onChange={setCycles}
            options={lengths.map((d) => ({
              cycles: d.cycles,
              label:
                t(`${offer.days * d.cycles} hari`, `${offer.days * d.cycles} days`) +
                (d.discountPercent ? t(` · Hemat ${percent(d.discountPercent, locale)}`, ` · Save ${percent(d.discountPercent, locale)}`) : ""),
            }))}
          />
        )}
      </View>

      <View style={styles.box}>
        <Stepper label={t("Porsi per hari", "Portions per day")} value={qty} onChange={setPortions} min={1} max={maxQty} />
        <View style={styles.address}>
          <Text variant="caption" style={{ flex: 1 }} numberOfLines={2}>
            {address
              ? t(`Diantar ke ${address.label} · ${address.line}`, `Delivered to ${address.label} · ${address.line}`)
              : t("Belum ada alamat pengantaran.", "No delivery address yet.")}
          </Text>
          <Button
            variant="text"
            label={address ? t("Ganti", "Change") : t("Tambah alamat", "Add address")}
            accessibilityLabel={address ? t("Ganti alamat", "Change address") : undefined}
            onPress={() => (address ? setSheet("address") : router.push("/alamat" as never))}
          />
        </View>
      </View>
      {blocked ? <Text style={{ color: colors.danger }}>{blocked}</Text> : null}

      {shown ? <Breakdown quote={shown} dimmed={quote.pending} locale={locale} t={t} /> : null}
      {!shown && quote.pending ? <ActivityIndicator color={colors.forest} /> : null}
      {quote.error ? (
        <Retry message={quote.error} label={t("Hitung ulang", "Recalculate")} onRetry={quote.retry} t={t} />
      ) : null}

      <PayWith availability={pay} chosen={chosenMethod} onChoose={setMethod} t={t} />
      <Terms apiBase={runtime.apiBase} t={t} />

      <ChoiceSheet
        visible={sheet === "address"}
        title={t("Alamat pengantaran", "Delivery address")}
        items={addresses.map((a) => ({ id: a.id, label: a.label, detail: a.line }))}
        selected={address?.id}
        onPick={setAddressId}
        onClose={() => setSheet("")}
      >
        <Button
          variant="secondary"
          label={t("Kelola alamat", "Manage addresses")}
          onPress={() => {
            setSheet("");
            router.push("/alamat" as never);
          }}
        />
      </ChoiceSheet>
      <ChoiceSheet
        visible={sheet === "start"}
        title={t("Mulai tanggal", "Start date")}
        items={choices.map((d) => ({ id: d, label: shortDate(d, locale) }))}
        selected={startDate}
        onPick={setStart}
        onClose={() => setSheet("")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  strong: { fontFamily: fontFor("800"), color: colors.forest },
  inline: { alignSelf: "flex-start" },
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface, paddingBottom: 8 },
  address: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12 },
});
