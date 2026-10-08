import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { currency, type CustomerActionItem, type Subscription } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, Screen, Text } from "@catera/mobile-ui";
import { payAgainHref } from "../buy/PaymentOutcome";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { Row, SectionLabel } from "./Row";
import { SignInFirst } from "./SignInFirst";

/** The customer read carries each subscription's checkout_id; packages a caterer recorded
 * outside Catera have none and are not Catera payments. */
type Purchase = Subscription & { checkout_id?: string | null };

/** Still to pay: only these may offer Bayar. */
const UNPAID = new Set<CustomerActionItem["status"]>(["choose_method", "awaiting_payment"]);
/** Already paid or being checked: never ask for payment again. */
const IN_PROGRESS = new Set<CustomerActionItem["status"]>(["checking_payment", "payment_exception"]);

const checkoutIdOf = (item: CustomerActionItem) => item.id.replace(/^payment-/, "");

function progressWord(item: CustomerActionItem, t: (id: string, en: string) => string): string {
  return item.status === "payment_exception"
    ? t("Pembayaran diterima, pemesanan sedang ditinjau Catera", "Payment received, Catera is reviewing the order")
    : t("Pembayaran sedang dicek", "Payment is being checked");
}

/** Riwayat pembayaran: checkouts still to pay (Bayar), payments being processed (never paid twice),
 * checkouts that ran out in the last 7 days (Bayar lagi), and purchases paid through Catera.
 * The server decides "still to pay" (within the hold, nothing received) from "being checked"
 * (a payment was received, or the bank may still confirm one after the hold). */
export function Payments() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Riwayat pembayaran", "Payment history")} next="/pembayaran" />;
  return <History key={actor.id} />;
}

function History() {
  const { runtime, t, locale } = useMobile();
  const customer = useData("payments:customer", () => runtime.api.customer());
  const feed = useData("payments:actions", () => runtime.api.customerActions(20));

  if (!customer.data)
    return customer.error ? (
      <Screen>
        <Text style={{ color: colors.danger }}>{customer.error}</Text>
        <Button label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
      </Screen>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );

  const ended = (feed.data?.ended ?? []).filter((i) => i.kind === "payment_action");
  const payments = [...(feed.data?.items ?? []).filter((i) => i.kind === "payment_action"), ...ended];
  const unpaid = payments.filter((i) => UNPAID.has(i.status));
  const inProgress = payments.filter((i) => IN_PROGRESS.has(i.status));
  const expired = ended.filter((i) => i.status === "expired" && i.payAgain);
  const paid = (customer.data.subscriptions as Purchase[])
    .filter((s) => !!s.checkout_id)
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));

  return (
    <Screen>
      {feed.error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {t("Pembayaran yang menunggu belum bisa dimuat.", "Payments waiting could not be loaded.")}
        </Text>
      ) : null}
      {unpaid.length ? (
        <View>
          <SectionLabel>{t("Belum dibayar", "Not paid yet")}</SectionLabel>
          {unpaid.map((item, i) => {
            const name = item.packageName ?? t("Pembayaran", "Payment");
            return (
              <Row
                key={item.id}
                first={i === 0}
                label={name}
                caption={[t("Menunggu pembayaran", "Waiting for payment"), item.catererName].filter(Boolean).join(" · ")}
              >
                <Button
                  label={t("Bayar", "Pay")}
                  accessibilityLabel={t(`Bayar ${name}`, `Pay ${name}`)}
                  onPress={() => router.push(customerLink(item.href) as never)}
                />
              </Row>
            );
          })}
        </View>
      ) : null}
      {inProgress.length ? (
        <View>
          <SectionLabel>{t("Sedang diproses", "In progress")}</SectionLabel>
          <Text variant="caption">
            {t(
              "Jangan membayar lagi. Kami kabari setelah selesai.",
              "Don’t pay again. We’ll let you know when it’s done.",
            )}
          </Text>
          {inProgress.map((item, i) => (
            <Row
              key={item.id}
              first={i === 0}
              label={item.packageName ?? t("Pembayaran", "Payment")}
              caption={[progressWord(item, t), item.catererName].filter(Boolean).join(" · ")}
              onPress={
                item.status === "payment_exception"
                  ? () => router.push(`/bantuan?checkoutId=${encodeURIComponent(checkoutIdOf(item))}` as never)
                  : undefined
              }
            />
          ))}
        </View>
      ) : null}
      {expired.length ? (
        <View>
          <SectionLabel>{t("Kedaluwarsa", "Expired")}</SectionLabel>
          {expired.map((item, i) => {
            const name = item.packageName ?? t("Pembayaran", "Payment");
            return (
              <Row
                key={item.id}
                first={i === 0}
                label={name}
                caption={[
                  item.paymentFailed
                    ? t("Pembayaran gagal", "Payment failed")
                    : t("Waktu pembayaran habis", "Payment time ran out"),
                  item.catererName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <Button
                  variant="secondary"
                  label={t("Bayar lagi", "Pay again")}
                  accessibilityLabel={t(`Bayar lagi ${name}`, `Pay again ${name}`)}
                  onPress={() => router.push(payAgainHref(item.payAgain!) as never)}
                />
              </Row>
            );
          })}
        </View>
      ) : null}
      {paid.length ? (
        <View>
          <SectionLabel>{t("Sudah dibayar", "Paid")}</SectionLabel>
          {paid.map((s, i) => (
            <Row
              key={s.id}
              first={i === 0}
              label={s.snapshot.offer.name}
              caption={`${s.snapshot.offer.caterer} · ${t("mulai", "starts")} ${longDay(s.starts_on, locale)}`}
              value={currency(s.snapshot.total, locale)}
            />
          ))}
        </View>
      ) : null}
      {!payments.length && !paid.length && !feed.loading ? (
        <View style={{ gap: 6 }}>
          <Text variant="heading">{t("Belum ada pembayaran.", "No payments yet.")}</Text>
          <Text style={{ color: colors.muted }}>
            {t("Paket yang Anda beli lewat Catera muncul di sini.", "Packages you buy through Catera appear here.")}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
});
