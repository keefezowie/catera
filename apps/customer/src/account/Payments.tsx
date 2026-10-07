import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { currency, type CustomerActionItem, type Subscription } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, Screen, Text } from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { Row, SectionLabel } from "./Row";
import { SignInFirst } from "./SignInFirst";

/** The customer read carries each subscription's checkout_id; packages a caterer recorded
 * outside Catera have none and are not Catera payments. */
type Purchase = Subscription & { checkout_id?: string | null };

function waitingWord(item: CustomerActionItem, t: (id: string, en: string) => string): string {
  if (item.status === "checking_payment") return t("Sedang dicek", "Being checked");
  if (item.status === "payment_exception") return t("Sedang ditinjau Catera", "Catera is reviewing it");
  return t("Menunggu pembayaran", "Waiting for payment");
}

/** Riwayat pembayaran: purchases paid through Catera, and any checkout still waiting (→ Bayar). */
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

  const waiting = (feed.data?.items ?? []).filter((i) => i.kind === "payment_action");
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
      {waiting.length ? (
        <View>
          <SectionLabel>{t("Belum dibayar", "Not paid yet")}</SectionLabel>
          {waiting.map((item, i) => (
            <Row
              key={item.id}
              first={i === 0}
              label={item.packageName ?? t("Pembayaran", "Payment")}
              caption={[waitingWord(item, t), item.catererName].filter(Boolean).join(" · ")}
              onPress={() => router.push(customerLink(item.href) as never)}
            />
          ))}
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
      {!waiting.length && !paid.length && !feed.loading ? (
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
