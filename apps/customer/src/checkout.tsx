import { useEffect, useRef, useState } from "react";
import { Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  addDays,
  localDay,
  currency,
  durationOptions,
  purchaseCommitment,
  purchaseStartAvailable,
  type Checkout,
  type Quote,
  type PaymentAvailability,
} from "@catera/domain";
import { nativeApi, useData, useNative } from "./context";
import {
  Btn,
  C,
  DayPicker,
  Empty,
  Facts,
  Gate,
  Panel,
  Photo,
  Qty,
  ResourceNotice,
  Run,
  Screen,
  Select,
  Txt,
  styles,
} from "./ui";

const bounded = (value: unknown, max: number) =>
  Math.max(1, Math.min(max, Math.trunc(Number(value)) || 1));
const validDate = (value?: string) =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(new Date(value + "T12:00:00Z").getTime()) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
export function CheckoutScreen() {
  const params = useLocalSearchParams<{
    id: string;
    portions?: string;
    trial?: string;
    cycles?: string;
    startDate?: string;
    addressId?: string;
    renewedFrom?: string;
  }>();
  const { actor } = useNative();
  // Remount purchase state when its owner or purchase intent changes.
  return (
    <CheckoutForm
      key={`${actor?.id}:${JSON.stringify(params)}`}
      params={params}
    />
  );
}
function CheckoutForm({
  params: p,
}: {
  params: {
    id: string;
    portions?: string;
    trial?: string;
    cycles?: string;
    startDate?: string;
    addressId?: string;
    renewedFrom?: string;
  };
}) {
  const { actor, command, t, locale } = useNative();
  const trial = p.trial === "1";
  const draftKey = `catera.checkout.${actor?.id || "guest"}.${p.id}.${trial}.${p.renewedFrom || "new"}`;
  const offer = useData("checkout-offer:" + p.id, () => nativeApi.offer(p.id));
  const customer = useData("checkout-customer", () =>
    actor ? nativeApi.customer() : Promise.resolve(null),
  );
  const availability = useData<PaymentAvailability>("payment-methods", () =>
    nativeApi.request("payment-methods"),
  );
  const [qty, setQty] = useState(bounded(p.portions, 100));
  const [cycles, setCycles] = useState(trial ? 1 : bounded(p.cycles, 6));
  const [date, setDate] = useState(
    validDate(p.startDate) ? p.startDate! : addDays(localDay(), 2),
  );
  const [address, setAddress] = useState(p.addressId || "");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [restored, setRestored] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const selection = `${qty}:${cycles}:${date}:${address}`;
  const currentSelection = useRef(selection);
  currentSelection.current = selection;
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(draftKey)
      .then((v) => {
        if (!active || !v) return;
        try {
          const d = JSON.parse(v);
          if (p.portions == null) setQty(bounded(d.qty, 100));
          if (p.cycles == null) setCycles(trial ? 1 : bounded(d.cycles, 6));
          if (p.startDate == null && validDate(d.date)) setDate(d.date);
          if (p.addressId == null && typeof d.address === "string")
            setAddress(d.address);
        } catch {
          /* Ignore an interrupted draft write. */
        }
      })
      .finally(() => {
        if (active) setRestored(true);
      });
    return () => {
      active = false;
    };
  }, [draftKey, trial]);
  useEffect(() => {
    if (!restored) return;
    void SecureStore.setItemAsync(
      draftKey,
      JSON.stringify({ qty, cycles, date, address }),
    );
    setQuote(null);
    setAccepted(false);
  }, [selection, restored, draftKey]);
  useEffect(() => {
    if (restored && !address && customer.data?.addresses[0])
      setAddress(customer.data.addresses[0].id);
  }, [customer.data, restored, address]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const o = offer.data?.offer;
  const chosenAddress = customer.data?.addresses.find((a) => a.id === address);
  const reviewedTerms = `${o?.version}:${o?.durationPricing?.revision}:${JSON.stringify(chosenAddress)}`;
  useEffect(() => {
    setQuote(null);
    setAccepted(false);
  }, [reviewedTerms]);
  const durationValid =
    !!o && durationOptions(o).some((x) => x.cycles === cycles);
  const startValid =
    !!o &&
    purchaseStartAvailable(o, date, now) &&
    (!p.renewedFrom || !validDate(p.startDate) || date >= p.startDate!);
  const paymentAvailable =
    !!availability.data &&
    !availability.error &&
    !availability.loading &&
    (availability.data.mode !== "direct" ||
      availability.data.availableMethods.length > 0);
  const writable =
    offer.canWrite &&
    customer.canWrite &&
    !!chosenAddress &&
    !!o?.areas.includes(chosenAddress.area) &&
    startValid &&
    durationValid &&
    (!trial || qty <= (o?.trialMax || 100)) &&
    paymentAvailable &&
    restored;
  const payload = {
    packageId: p.id,
    addressId: address,
    portions: qty,
    startDate: date,
    cycles,
    trial,
    ...(p.renewedFrom ? { renewedFrom: p.renewedFrom } : {}),
  };
  const next =
    "/checkout/" +
    p.id +
    "?" +
    new URLSearchParams(
      Object.fromEntries(
        Object.entries(p).filter(([k, v]) => k !== "id" && v != null) as [
          string,
          string,
        ][],
      ),
    );
  const formatDate = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString(
      locale === "id" ? "id-ID" : "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      },
    );
  const commitment =
    o && durationValid
      ? purchaseCommitment({ offer: o, portions: qty, cycles, trial, quote })
      : null;
  return (
    <Gate next={next}>
      <Screen
        title={
          trial
            ? t("Coba satu hari", "Try one day")
            : t("Porsi & jadwal", "Portions & schedule")
        }
        refresh={async () => {
          await Promise.all([
            offer.reload(),
            customer.reload(),
            availability.reload(),
          ]);
        }}
      >
        <ResourceNotice resource={offer} />
        <ResourceNotice resource={customer} />
        <ResourceNotice resource={availability} />
        {offer.data && !o ? (
          <Empty
            title={t("Paket tidak tersedia", "Package unavailable")}
            body={t(
              "Pilih paket lain untuk melanjutkan.",
              "Choose another package to continue.",
            )}
          />
        ) : null}
        {o && (
          <>
            <Photo src={o.image} height={156} />
            <Txt kind="heading">{o.name}</Txt>
            <Txt kind="small">{o.caterer}</Txt>
            {commitment && (
              <Txt>
                {commitment.deliveryDays}{" "}
                {t("hari pengantaran", "delivery days")} ·{" "}
                {commitment.portionsPerMeal}{" "}
                {t("porsi per waktu makan", "portions per meal")} ·{" "}
                {commitment.totalMealPortions}{" "}
                {t("porsi total", "total portions")}
              </Txt>
            )}
            <Txt kind="small">
              {t(
                "Dibayar penuh di awal. Pengantaran termasuk. Perpanjang secara manual.",
                "Paid in full upfront. Delivery included. Renew manually.",
              )}
            </Txt>
            {!paymentAvailable &&
              !availability.loading &&
              !availability.error && (
                <Txt>
                  {t(
                    "Pembayaran belum tersedia. Coba muat ulang nanti.",
                    "Payment is unavailable. Please refresh later.",
                  )}
                </Txt>
              )}
            {!quote ? (
              <>
                <Qty
                  value={qty}
                  onChange={setQty}
                  max={trial ? o.trialMax || 100 : 100}
                />
                {!trial && (
                  <Select
                    label={t("Durasi paket", "Package duration")}
                    value={String(cycles)}
                    onChange={(v) => setCycles(Number(v))}
                    options={durationOptions(o).map((d) => ({
                      value: String(d.cycles),
                      label: `${d.cycles} ${t("periode", "cycles")} · ${o.days * d.cycles} ${t("hari", "days")}${d.discountPercent ? ` · ${t("hemat", "save")} ${d.discountPercent}%` : ""}`,
                    }))}
                  />
                )}
                <DayPicker
                  label={t("Mulai tanggal", "Start date")}
                  value={date}
                  onChange={setDate}
                  min={
                    p.renewedFrom && p.startDate && p.startDate > localDay()
                      ? p.startDate
                      : localDay()
                  }
                />
                {!startValid && (
                  <Txt>
                    {t(
                      "Tanggal ini tidak termasuk hari layanan atau sudah melewati batas pemesanan. Pilih tanggal berikutnya.",
                      "This date is outside service days or past the order cutoff. Choose a later date.",
                    )}
                  </Txt>
                )}
                <Select
                  label={t("Alamat pengantaran", "Delivery address")}
                  value={address}
                  onChange={setAddress}
                  options={(customer.data?.addresses || []).map((a) => ({
                    value: a.id,
                    label: `${a.label} · ${a.area}${o.areas.includes(a.area) ? "" : t(" · di luar jangkauan", " · outside coverage")}`,
                  }))}
                />
                {chosenAddress && <Txt kind="small">{chosenAddress.line}</Txt>}
                <Btn
                  secondary
                  label={t("Kelola alamat", "Manage addresses")}
                  onPress={() => router.push("/addresses")}
                />
                <Run
                  label={t("Tinjau jadwal & harga", "Review schedule & price")}
                  disabled={!writable}
                  successMessage=""
                  action={async () => {
                    const submitted = selection;
                    const q = await nativeApi.quote(payload);
                    if (currentSelection.current === submitted) {
                      setQuote(q);
                      setAccepted(false);
                    }
                  }}
                />
              </>
            ) : (
              <Panel>
                <Txt kind="heading">{t("Periksa pesanan", "Review order")}</Txt>
                <Txt>
                  {chosenAddress?.label} · {chosenAddress?.line} ·{" "}
                  {chosenAddress?.area}
                </Txt>
                {(expanded ? quote.dates : quote.dates.slice(0, 7)).map((d) => (
                  <Txt key={d}>
                    {formatDate(d)} · {qty} {t("porsi", "portions")}
                    {o.meal === "both"
                      ? t(" siang + malam", " lunch + dinner")
                      : ""}
                  </Txt>
                ))}
                {quote.dates.length > 7 && (
                  <Btn
                    secondary
                    label={
                      expanded
                        ? t("Ringkas jadwal", "Collapse schedule")
                        : `${t("Lihat semua", "Show all")} ${quote.dates.length} ${t("tanggal", "dates")}`
                    }
                    onPress={() => setExpanded(!expanded)}
                  />
                )}
                <Facts
                  rows={[
                    [
                      t("Harga paket", "Package subtotal"),
                      currency(quote.subtotal, locale),
                    ],
                    [
                      t("Diskon porsi", "Portion discount"),
                      currency(quote.discount, locale),
                    ],
                    [
                      t("Diskon durasi", "Duration discount"),
                      currency(quote.durationDiscount || 0, locale),
                    ],
                    [
                      t("Promo", "Promotion"),
                      currency(quote.promotion, locale),
                    ],
                    [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
                    [
                      t("Biaya layanan", "Service fee"),
                      currency(quote.serviceFee, locale),
                    ],
                    [
                      t("Total bayar", "Total due"),
                      currency(quote.total, locale),
                    ],
                  ]}
                />
                <Txt kind="small">
                  {o.flexible
                    ? t(
                        "Ubah tanggal sebelum cutoff, sesuai kapasitas. ",
                        "Change dates before cutoff, subject to capacity. ",
                      )
                    : t(
                        "Paket ini memiliki tanggal tetap. ",
                        "This package has fixed dates. ",
                      )}
                  {t(
                    "Porsi tetap untuk seluruh jadwal. Pembatalan dan refund melalui bantuan. Tidak ada perpanjangan otomatis.",
                    "Fixed portions throughout the schedule. Cancellation and refunds go through support. No automatic renewal.",
                  )}
                </Txt>
                <View style={styles.row}>
                  <Switch
                    accessibilityLabel={t(
                      "Setujui jadwal alamat dan aturan",
                      "Agree to the schedule, address, and terms",
                    )}
                    value={accepted}
                    onValueChange={setAccepted}
                    trackColor={{ true: C.forest }}
                  />
                  <Txt style={{ flex: 1 }} kind="small">
                    {t(
                      "Saya sudah memeriksa jadwal, alamat, dan ketentuan.",
                      "I have reviewed the schedule, address, and terms.",
                    )}
                  </Txt>
                </View>
                <Run
                  label={t("Lanjutkan ke pembayaran", "Continue to payment")}
                  disabled={!accepted || !writable}
                  successMessage=""
                  action={async () => {
                    if (!accepted || !purchaseStartAvailable(o, date))
                      throw new Error("TERMS_REQUIRED");
                    const checkout = await command<Checkout>(
                      "checkout.create",
                      { ...payload, expectedQuote: quote, acceptedTerms: true },
                    );
                    await SecureStore.deleteItemAsync(draftKey);
                    router.replace(("/payment/" + checkout.id) as never);
                  }}
                />
                <Btn
                  secondary
                  label={t("Ubah pilihan", "Edit selection")}
                  onPress={() => {
                    setQuote(null);
                    setAccepted(false);
                  }}
                />
              </Panel>
            )}
          </>
        )}
      </Screen>
    </Gate>
  );
}
