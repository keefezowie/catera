import { useEffect, useRef, useState } from "react";
import { AppState, Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import QRCode from "react-native-qrcode-svg";
import {
  currency,
  paymentPresentation,
  type Checkout,
  type DirectPaymentMethod,
} from "@catera/domain";
import { nativeApi, useData, useNative } from "./context";
import {
  Btn,
  Empty,
  Facts,
  Gate,
  Panel,
  ResourceNotice,
  Run,
  Screen,
  Select,
  Txt,
} from "./ui";

export function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor, demo, command, t, locale } = useNative();
  const state = useData<Checkout | null>("payment:" + id, () =>
    actor ? nativeApi.checkout(id) : Promise.resolve(null),
  );
  const [now, setNow] = useState(() => new Date());
  const c = state.data;
  const presentation = c
    ? paymentPresentation(
        {
          checkoutState: c.state,
          expiresAt: c.payment?.expiresAt || c.expires_at,
          payment: c.payment,
          hasPaymentUrl: !!c.payment_url,
          hasSubscription: !!c.subscription_id,
        },
        now.getTime(),
      )
    : null;
  const waiting =
    c?.state === "pending" || (c?.state === "paid" && !c.subscription_id);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      setNow(new Date());
      if (AppState.currentState === "active") void state.reload();
    }, 5000);
    const foreground = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        setNow(new Date());
        void state.reload();
      }
    });
    return () => {
      clearInterval(timer);
      foreground.remove();
    };
  }, [waiting, state.reload]);
  const refunded = c?.state === "refunded" || c?.state === "partially_refunded";
  const title =
    c?.state === "failed"
      ? t("Pembayaran gagal", "Payment failed")
      : c?.state === "expired"
        ? t("Waktu pembayaran habis", "Payment time expired")
        : refunded
          ? c?.state === "refunded"
            ? t("Pembayaran dikembalikan", "Payment refunded")
            : t(
                "Sebagian pembayaran dikembalikan",
                "Payment partially refunded",
              )
          : presentation?.phase === "paid"
            ? t("Pembayaran diterima", "Payment received")
            : presentation?.phase === "booking_unresolved"
              ? t(
                  "Pembayaran sedang ditinjau",
                  "Your payment is being reviewed",
                )
              : presentation?.phase === "checking"
                ? t("Memeriksa pembayaran", "Checking payment")
                : t("Pembayaran", "Payment");
  return (
    <Gate next={"/payment/" + id}>
      <Screen title={title} refresh={state.reload}>
        <ResourceNotice resource={state} />
        {!c && !state.loading && !state.error && (
          <Empty title={t("Pesanan tidak ditemukan", "Order not found")} />
        )}
        {c && presentation && (
          <>
            {(demo || c.provider_environment === "sandbox") && (
              <Txt kind="label">
                {t("Sandbox · pembayaran uji", "Sandbox · test payment")}
              </Txt>
            )}
            <Txt kind="small">
              {t("Nomor pesanan", "Order reference")}: {c.id}
            </Txt>
            <Facts
              rows={[
                [t("Paket", "Package"), c.quote.offer.name],
                [
                  t("Durasi", "Duration"),
                  `${c.quote.cycles ?? 1} ${t("periode", "cycles")} · ${c.quote.dates.length} ${t("hari", "days")}`,
                ],
                [
                  t("Dibayar penuh di awal", "Paid in full upfront"),
                  currency(c.quote.total, locale),
                ],
              ]}
            />
            {refunded ? (
              <>
                <Txt>
                  {t(
                    "Lihat keputusan bantuan dan status pemrosesan refund untuk rincian pengembalian.",
                    "See the support decision and refund processing status for details.",
                  )}
                </Txt>
                <Btn
                  label={t("Lihat bantuan", "View support")}
                  onPress={() =>
                    router.push({
                      pathname: "/bantuan",
                      params: { checkoutId: id },
                    })
                  }
                />
              </>
            ) : presentation.phase === "paid" ? (
              <>
                <Image
                  source={require("../../../packages/brand/assets/confirmation.png")}
                  style={{ width: 200, height: 180, alignSelf: "center" }}
                  resizeMode="contain"
                />
                <Txt>
                  {t(
                    "Jadwal pengantaran sudah tersimpan.",
                    "Your delivery schedule is saved.",
                  )}
                </Txt>
                {c.quote.offer.menuSelectionMode === "customer" && (
                  <Btn
                    label={t("Pilih menu", "Choose menus")}
                    onPress={() =>
                      router.replace(
                        ("/subscriptions/" +
                          c.subscription_id +
                          "/menu") as never,
                      )
                    }
                  />
                )}
                <Btn
                  label={t("Lihat jadwal makan", "View meal calendar")}
                  onPress={() => router.replace("/jadwal")}
                />
                <Btn
                  secondary
                  label={t("Detail langganan", "Subscription details")}
                  onPress={() =>
                    router.push(
                      ("/subscriptions/" + c.subscription_id) as never,
                    )
                  }
                />
              </>
            ) : (
              <>
                {presentation.phase === "checking" && (
                  <Txt>
                    {t(
                      "Status pembayaran sedang diverifikasi. Jangan bayar lagi atau membuat pesanan baru. Jadwal muncul setelah konfirmasi selesai.",
                      "Payment is being verified. Do not pay again or place another order. Your schedule will appear once confirmation is complete.",
                    )}
                  </Txt>
                )}
                {presentation.phase === "booking_unresolved" && (
                  <Txt>
                    {t(
                      "Pembayaran diterima, tetapi jadwal belum terkonfirmasi. Tim Catera akan membantu menyelesaikannya. Jangan bayar lagi.",
                      "Payment was received, but the schedule is not confirmed. Catera will help resolve this. Do not pay again.",
                    )}
                  </Txt>
                )}
                {c.state === "pending" &&
                  presentation.phase !== "checking" &&
                  presentation.phase !== "expired" &&
                  c.payment?.mode === "direct" && (
                    <DirectPayment
                      key={c.id}
                      checkout={c}
                      disabled={state.canWrite === false}
                      reload={state.reload}
                    />
                  )}
                {c.state === "pending" &&
                  c.payment?.mode !== "direct" &&
                  presentation.phase !== "expired" &&
                  (demo ? (
                    <Run
                      label={t(
                        "Simulasikan pembayaran berhasil",
                        "Simulate successful payment",
                      )}
                      disabled={state.canWrite === false}
                      successMessage=""
                      action={async () => {
                        await command("checkout.demo_pay", { id });
                        await state.reload();
                      }}
                    />
                  ) : presentation.action === "open_payment" &&
                    c.payment_url ? (
                    <Run
                      label={t("Buka pembayaran aman", "Open secure payment")}
                      disabled={state.canWrite === false}
                      successMessage=""
                      action={async () => {
                        await WebBrowser.openBrowserAsync(c.payment_url!);
                        await state.reload();
                      }}
                    />
                  ) : null)}
                {presentation.action === "choose_new_schedule" &&
                  !presentation.preventDuplicatePayment && (
                    <Btn
                      label={t("Pilih jadwal baru", "Choose a new schedule")}
                      onPress={() =>
                        router.replace(
                          ("/checkout/" + c.quote.packageId) as never,
                        )
                      }
                    />
                  )}
                <Run
                  secondary
                  label={t("Periksa status", "Check status")}
                  successMessage={t(
                    "Status diperbarui dari server.",
                    "Status refreshed from the server.",
                  )}
                  action={async () => {
                    if (c.payment?.mode === "direct")
                      await command("checkout.payment.refresh", { id });
                    await state.reload();
                  }}
                />
                <Txt kind="small">
                  {t(
                    "Kembali dari pembayaran tidak membuktikan transaksi berhasil. Status diperiksa dari server.",
                    "Returning from payment does not prove the transaction succeeded. Status is checked with the server.",
                  )}
                </Txt>
                <Btn
                  secondary
                  label={t("Bantuan pembayaran", "Payment support")}
                  onPress={() =>
                    router.push({
                      pathname: "/bantuan",
                      params: {
                        checkoutId: id,
                        catererId: c.quote.offer.catererId,
                      },
                    })
                  }
                />
              </>
            )}
          </>
        )}
      </Screen>
    </Gate>
  );
}
function DirectPayment({
  checkout: c,
  reload,
  disabled,
}: {
  checkout: Checkout;
  reload: () => Promise<unknown>;
  disabled: boolean;
}) {
  const { command, t, locale } = useNative();
  const payment = c.payment!;
  const [method, setMethod] = useState<DirectPaymentMethod | "">(
    payment.selectedMethod || "",
  );
  const qr = useRef<{
    toDataURL: (callback: (data: string) => void) => void;
  } | null>(null);
  const instructions = payment.instructions;
  const effectiveMethod = payment.selectedMethod || method;
  return (
    <Panel>
      <Txt kind="heading">{t("Cara bayar", "How to pay")}</Txt>
      {payment.expiresAt && (
        <Txt kind="small">
          {t("Bayar sebelum", "Pay before")}{" "}
          {new Date(payment.expiresAt).toLocaleString(
            locale === "id" ? "id-ID" : "en-GB",
          )}
        </Txt>
      )}
      {!payment.selectedMethod && (
        <Select
          label={t("Metode pembayaran", "Payment method")}
          value={method}
          onChange={(v) => setMethod(v as DirectPaymentMethod)}
          options={payment.availableMethods.map((value) => ({
            value,
            label: value === "QRIS" ? "QRIS" : "BRI Virtual Account",
          }))}
        />
      )}
      {payment.selectedMethod && (
        <Txt kind="label">
          {payment.selectedMethod === "QRIS" ? "QRIS" : "BRI Virtual Account"}
        </Txt>
      )}
      {!instructions && (
        <>
          <Txt kind="small">
            {payment.status === "failed"
              ? t(
                  "Instruksi belum tersedia. Coba metode yang sama atau hubungi bantuan.",
                  "Instructions are not ready. Retry the same method or contact support.",
                )
              : t(
                  "Metode terkunci setelah instruksi diminta.",
                  "The method is locked after requesting instructions.",
                )}
          </Txt>
          <Run
            label={t(
              "Tampilkan instruksi pembayaran",
              "Show payment instructions",
            )}
            disabled={
              disabled ||
              !effectiveMethod ||
              !payment.availableMethods.includes(effectiveMethod)
            }
            successMessage=""
            action={async () => {
              try {
                await command("checkout.payment.start", {
                  id: c.id,
                  method: effectiveMethod,
                });
              } finally {
                await reload();
              }
            }}
          />
        </>
      )}
      {instructions?.kind === "virtual_account" && (
        <>
          <Txt kind="small">
            {t("Nomor virtual account", "Virtual account number")}
          </Txt>
          <Text
            selectable
            style={{ fontSize: 24, color: "#163D2E", fontFamily: "Jakarta" }}
          >
            {instructions.accountNumber}
          </Text>
          <Txt>{instructions.accountName}</Txt>
          <Run
            secondary
            label={t("Salin nomor", "Copy number")}
            successMessage={t("Nomor disalin.", "Number copied.")}
            action={() => Clipboard.setStringAsync(instructions.accountNumber)}
          />
          <Txt>
            {t(
              "1. Buka aplikasi bank atau ATM, lalu pilih BRIVA.\n2. Masukkan nomor di atas.\n3. Periksa penerima dan total sebelum membayar.\n4. Kembali ke Catera dan periksa status.",
              "1. Open your banking app or ATM and choose BRIVA.\n2. Enter the number above.\n3. Check the recipient and total before paying.\n4. Return to Catera and check status.",
            )}
          </Txt>
        </>
      )}
      {instructions?.kind === "qris" && (
        <>
          <View
            accessible
            accessibilityLabel={t(
              "Kode QRIS pembayaran pesanan ini",
              "QRIS payment code for this order",
            )}
            style={{
              alignSelf: "center",
              padding: 16,
              backgroundColor: "white",
            }}
          >
            <QRCode
              value={instructions.qrContent}
              size={220}
              quietZone={12}
              getRef={(value) => {
                qr.current = value;
              }}
            />
          </View>
          <Txt>
            {t(
              "Pindai dengan aplikasi bank atau dompet digital. Untuk perangkat yang sama, simpan atau bagikan QR lalu pilih gambar dari aplikasi pembayaran.",
              "Scan with a bank or wallet app. On this device, save or share the QR and choose the image in your payment app.",
            )}
          </Txt>
          <Run
            secondary
            label={t("Bagikan QRIS", "Share QRIS")}
            successMessage=""
            action={async () => {
              if (!(await Sharing.isAvailableAsync()) || !qr.current)
                throw new Error(
                  t(
                    "Berbagi belum tersedia pada perangkat ini.",
                    "Sharing is unavailable on this device.",
                  ),
                );
              const data = await new Promise<string>((resolve) =>
                qr.current!.toDataURL(resolve),
              );
              const file = new File(Paths.cache, `catera-payment-${c.id}.png`);
              file.write(data, { encoding: "base64" });
              try {
                await Sharing.shareAsync(file.uri, {
                  mimeType: "image/png",
                  dialogTitle: "QRIS Catera",
                });
              } finally {
                if (file.exists) file.delete();
              }
            }}
          />
        </>
      )}
    </Panel>
  );
}
