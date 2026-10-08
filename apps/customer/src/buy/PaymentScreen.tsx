import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text as RNText, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { currency, errorLabel, type Checkout, type DirectPaymentMethod } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, FONT, Screen, Text } from "@catera/mobile-ui";
import { RoundButton } from "../discover/PackageCard";
import { PayWith, Retry } from "./BuyParts";
import { FINAL, PaymentOutcome, stageOf } from "./PaymentOutcome";
import { QrisCode, useQris } from "./QrisCode";

const POLL_MS = 10_000;
const leave = () => (router.canGoBack() ? router.back() : router.replace("/" as never));
const tabular = { fontVariant: ["tabular-nums" as const] };

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Bayar: the QR or VA number with a countdown; reopening restores it from the server. */
export function PaymentScreen({ checkoutId }: { checkoutId: string }) {
  const { runtime, actor, ready, demo, command, t, locale } = useMobile();
  useEffect(() => {
    if (ready && !actor) router.replace(`/login?next=${encodeURIComponent(`/bayar/${encodeURIComponent(checkoutId)}`)}` as never);
  }, [ready, actor, checkoutId]);
  const state = useData<Checkout | null>(`bayar:${checkoutId}`, () =>
    actor ? runtime.api.checkout(checkoutId) : Promise.resolve(null),
  );
  const c = state.data;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // What the customer's own "cek status" found while the payment is still open.
  const [notice, setNotice] = useState("");
  const [method, setMethod] = useState<DirectPaymentMethod | null>(null);
  const qris = useQris();
  const stage = c ? stageOf(c, now) : null;
  const live = !!stage && !FINAL.includes(stage);
  const direct = c?.payment?.mode === "direct";

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const reload = state.reload;
  const check = useCallback(async () => {
    if (direct) await command("checkout.payment.refresh", { id: checkoutId });
    else await reload();
  }, [direct, command, checkoutId, reload]);
  // Ask the provider every 10 s, and once on returning from the bank app, only while this
  // screen is in front and the payment is open.
  useFocusEffect(
    useCallback(() => {
      if (!live) return;
      const ask = () => void check().catch(() => undefined);
      const timer = setInterval(ask, POLL_MS);
      const foreground = AppState.addEventListener("change", (s) => s === "active" && ask());
      return () => {
        clearInterval(timer);
        foreground.remove();
      };
    }, [live, check]),
  );

  /** The customer's own "cek status": says nothing came in only when the checkout read just now
   * (the one the provider refresh returns, else a fresh read) is still unpaid. A payment that was
   * found, or is being checked, never gets that sentence, even before the screen reloads. */
  async function checkNow() {
    let fresh: Checkout | null = null;
    if (direct) {
      const result = await command<Partial<Checkout> | null>("checkout.payment.refresh", { id: checkoutId });
      if (result && typeof result.state === "string" && result.quote) fresh = result as Checkout;
    }
    if (!fresh) fresh = await runtime.api.checkout(checkoutId);
    if (!direct) await reload();
    const unpaid =
      !!fresh && stageOf(fresh, Date.now()) === "pay" && !["checking", "paid"].includes(fresh.payment?.status ?? "");
    if (unpaid)
      setNotice(
        t(
          "Belum ada pembayaran masuk. Selesaikan pembayaran, lalu cek lagi.",
          "No payment has come in yet. Finish paying, then check again.",
        ),
      );
  }

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View style={styles.header}>
      <RoundButton icon="chevron-back" label={t("Kembali", "Back")} onPress={leave} />
      <Text variant="heading">{t("Bayar", "Pay")}</Text>
    </View>
  );
  const help = (
    <Button
      variant="text"
      label={t("Bantuan pembayaran", "Payment help")}
      onPress={() => router.push({ pathname: "/bantuan", params: { checkoutId } } as never)}
    />
  );
  if (!c || !stage)
    return (
      <Screen>
        {header}
        {state.error ? (
          <Retry message={state.error} onRetry={() => void reload()} t={t} />
        ) : state.loading || !ready ? (
          <ActivityIndicator color={colors.forest} />
        ) : (
          <Text>{t("Pembayaran tidak ditemukan.", "Payment not found.")}</Text>
        )}
      </Screen>
    );

  if (stage !== "pay")
    return (
      <PaymentOutcome
        checkout={c}
        stage={stage}
        header={header}
        help={help}
        busy={busy}
        error={error}
        onCheck={() => void run(check)}
        locale={locale}
        t={t}
      />
    );

  const total = currency(c.quote.total, locale);

  const payment = c.payment;
  const instructions = direct ? payment?.instructions : null;
  const deadline = Date.parse(payment?.expiresAt || c.expires_at) - now;
  const methods = payment?.selectedMethod ? [payment.selectedMethod] : (payment?.availableMethods ?? []);
  const chosen = method && methods.includes(method) ? method : methods.includes("QRIS") ? "QRIS" : (methods[0] ?? null);
  const steps =
    instructions?.kind === "virtual_account"
      ? [
          t("Buka aplikasi bank BRI atau ATM, lalu pilih BRIVA.", "Open your BRI banking app or ATM and choose BRIVA."),
          t("Masukkan nomor virtual account di atas.", "Enter the virtual account number above."),
          t("Periksa nama dan totalnya, lalu bayar.", "Check the name and total, then pay."),
        ]
      : [
          t("Buka aplikasi bank atau e-wallet, lalu pilih bayar dengan QRIS.", "Open a bank or e-wallet app and choose pay with QRIS."),
          t("Pindai kode ini. Dari HP ini, simpan gambar QR lalu pilih dari galeri.", "Scan this code. On this phone, save the QR image and pick it from the gallery."),
          t("Periksa totalnya, lalu bayar. Status berubah sendiri.", "Check the total, then pay. The status updates by itself."),
        ];
  return (
    <Screen
      footer={
        <Button
          label={t("Saya sudah bayar, cek status", "I've paid, check status")}
          disabled={busy}
          onPress={() => {
            setNotice("");
            void run(checkNow);
          }}
        />
      }
    >
      {header}
      {demo || c.provider_environment === "sandbox" ? (
        <Text variant="caption">{t("Sandbox · pembayaran uji", "Sandbox · test payment")}</Text>
      ) : null}
      <View style={styles.total}>
        <Text variant="caption">Total</Text>
        <Text variant="title" style={[{ fontSize: 32 }, tabular]}>
          {total}
        </Text>
        {deadline > 0 ? (
          <Text style={[{ color: colors.sunriseInk, fontWeight: "700" }, tabular]}>
            {t(`Bayar dalam ${clock(deadline)}`, `Pay within ${clock(deadline)}`)}
          </Text>
        ) : null}
      </View>

      {instructions?.kind === "qris" ? (
        <>
          <QrisCode value={instructions.qrContent} label={t("Kode QRIS pembayaran ini", "QRIS code for this payment")} qrRef={qris.ref} />
          <Button
            variant="secondary"
            label={t("Simpan gambar QR", "Save QR image")}
            disabled={busy}
            onPress={() => void run(() => qris.save(c.id))}
          />
        </>
      ) : null}
      {instructions?.kind === "virtual_account" ? (
        <Card style={{ alignItems: "center" }}>
          <Text variant="caption">{t("Nomor virtual account BRI", "BRI virtual account number")}</Text>
          <RNText selectable style={styles.va}>
            {instructions.accountNumber}
          </RNText>
          <Text variant="caption">{instructions.accountName}</Text>
          <Button variant="secondary" label={t("Salin nomor", "Copy number")} onPress={() => void Clipboard.setStringAsync(instructions.accountNumber)} />
        </Card>
      ) : null}
      {instructions ? (
        <View style={{ gap: 8 }}>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <Text style={{ flex: 1 }}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {direct && !instructions ? (
        <>
          <PayWith availability={{ mode: "direct", availableMethods: methods }} chosen={chosen} onChoose={setMethod} t={t} />
          {chosen ? (
            <Button
              label={chosen === "QRIS" ? t("Tampilkan QRIS", "Show QRIS") : t("Tampilkan nomor VA", "Show VA number")}
              disabled={busy}
              onPress={() => void run(() => command("checkout.payment.start", { id: c.id, method: chosen }))}
            />
          ) : null}
        </>
      ) : null}
      {!direct && demo ? (
        <Button label={t("Bayar (demo)", "Pay (demo)")} disabled={busy} onPress={() => void run(() => command("checkout.demo_pay", { id: c.id }))} />
      ) : null}
      {!direct && !demo && c.payment_url ? (
        <Button
          label={t("Buka halaman pembayaran", "Open payment page")}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await WebBrowser.openBrowserAsync(c.payment_url!);
              await reload();
            })
          }
        />
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {notice && !error ? (
        <Text style={{ fontWeight: "700" }} testID="payment-notice">
          {notice}
        </Text>
      ) : null}

      <Card tone="sage">
        <Text>
          {t(
            `${c.quote.dates.length} hari antar Anda dijaga selama 15 menit. Lewat dari itu, jadwal dicek ulang sebelum dibayar.`,
            `Your ${c.quote.dates.length} delivery days are held for 15 minutes. After that, the schedule is checked again before payment.`,
          )}
        </Text>
      </Card>
      {help}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  total: { alignItems: "center", gap: 4 },
  va: { fontFamily: FONT, fontSize: 26, fontWeight: "800", color: colors.forest, fontVariant: ["tabular-nums"], letterSpacing: 1 },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "800",
    color: colors.cream,
    backgroundColor: colors.forest,
    overflow: "hidden",
  },
});
