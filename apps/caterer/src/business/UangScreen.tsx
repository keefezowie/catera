import { View } from "react-native";
import { settlementCurrency } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Card, FadeSwap, Screen, Text, useColors } from "@catera/mobile-ui";
import { moneyStates } from "./money";
import { ScreenGuard } from "../ErrorBoundary";
import { ReadError } from "../ReadError";
import { UangSkeleton } from "../skeletons";

/** Uang: where every rupiah is, in the order it moves to the caterer's bank account. */
function UangContent() {
  const { runtime, actor, t, locale } = useMobile();
  const c = useColors();
  const catererId = actor?.catererId ?? "";
  const money = useData(`uang:${catererId}`, () => runtime.api.settlement(catererId));
  const s = money.data;
  // Every state draws its body in the same FadeSwap, so the money enters from its skeleton as one block.
  if (!s || "unavailable" in s)
    return (
      <Screen>
        <FadeSwap swapKey={s ? "unavailable" : money.error ? "error" : "loading"} style={{ gap: 16 }}>
          {s ? (
            <Text>{t("Rincian uang belum tersedia.", "Money details aren't available yet.")}</Text>
          ) : money.error ? (
            <ReadError art message={money.error} onRetry={() => void money.reload()} />
          ) : (
            <UangSkeleton />
          )}
        </FadeSwap>
      </Screen>
    );
  const pick = (pair: [string, string]) => t(pair[0], pair[1]);
  return (
    <Screen>
      <FadeSwap swapKey="money" style={{ gap: 16 }}>
        {/* A plain card (direction K): the amount is a price, so it is bold charcoal, and forest stays on buttons and selection. */}
        <Card>
          <Text variant="label">{t("Akan masuk ke rekening", "Going to your bank")}</Text>
          <Text variant="number" testID="uang-available" style={{ color: c.charcoal }}>
            {settlementCurrency(s.available, locale)}
          </Text>
          {s.nextPayoutAt ? (
            <Text variant="caption">
              {`${t("Pencairan berikutnya", "Next payout")} ${new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short" }).format(new Date(s.nextPayoutAt))}`}
            </Text>
          ) : null}
        </Card>
        <Card>
          {moneyStates.map((m, i) => (
            <View key={m.key} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text variant="label">{pick(m.label)}</Text>
                <Text variant="label" style={{ color: c.charcoal }}>{settlementCurrency(s[m.key], locale)}</Text>
              </View>
              <Text variant="caption">{pick(m.hint)}</Text>
            </View>
          ))}
        </Card>
      </FadeSwap>
    </Screen>
  );
}

export function UangScreen() {
  const { t } = useMobile();
  return (
    <ScreenGuard message={t("Rincian uang belum bisa ditampilkan.", "Money details can't be shown right now.")}>
      <UangContent />
    </ScreenGuard>
  );
}
