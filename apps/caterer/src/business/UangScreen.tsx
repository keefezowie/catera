import { View } from "react-native";
import { settlementCurrency } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Card, colors, Screen, Text } from "@catera/mobile-ui";
import { moneyStates } from "./money";

/** Uang: where every rupiah is, in the order it moves to the caterer's bank account. */
export function UangScreen() {
  const { runtime, actor, t, locale } = useMobile();
  const catererId = actor?.catererId ?? "";
  const money = useData(`uang:${catererId}`, () => runtime.api.settlement(catererId));
  const s = money.data;
  if (!s) return <Screen><Text variant="caption">{money.error || t("Memuat…", "Loading…")}</Text></Screen>;
  if ("unavailable" in s)
    return (
      <Screen>
        <Text variant="title">{t("Uang", "Money")}</Text>
        <Text>{t("Catatan uang belum tersedia.", "Money records aren't available yet.")}</Text>
      </Screen>
    );
  const pick = (pair: [string, string]) => t(pair[0], pair[1]);
  return (
    <Screen>
      <Text variant="title">{t("Uang", "Money")}</Text>
      <Card tone="brand">
        <Text variant="label" style={{ color: colors.cream }}>{t("Masuk ke rekening berikutnya", "Next payout to your account")}</Text>
        <Text variant="number" style={{ color: colors.cream }}>{settlementCurrency(s.available, locale)}</Text>
        {s.nextPayoutAt ? (
          <Text variant="caption" style={{ color: colors.cream }}>
            {`${t("Pencairan berikutnya", "Next payout")} ${new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short" }).format(new Date(s.nextPayoutAt))}`}
          </Text>
        ) : null}
      </Card>
      <Card>
        {moneyStates.map((m, i) => (
          <View key={m.key} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, gap: 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text variant="label">{pick(m.label)}</Text>
              <Text variant="label">{settlementCurrency(s[m.key], locale)}</Text>
            </View>
            <Text variant="caption">{pick(m.hint)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
