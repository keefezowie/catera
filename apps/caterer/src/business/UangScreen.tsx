import { View } from "react-native";
import { settlementCurrency } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import { FadeSwap, fontFor, KeyValueRow, ListCard, Screen, Text, useColors } from "@catera/mobile-ui";
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
      <FadeSwap swapKey="money">
        <View testID="uang-sections" style={{ gap: nativeLayout.dense.sectionGap }}>
          {/* The lead sits on the canvas, not in a card: what is going to the bank, the payout as the biggest figure on the
              page (a price, so charcoal, never forest), and when. */}
          <View testID="uang-lead" style={{ gap: nativeLayout.space.xs }}>
            <Text variant="meta">{t("Akan masuk ke rekening", "Going to your bank")}</Text>
            <Text variant="figure" testID="uang-available" style={{ color: c.charcoal }}>
              {settlementCurrency(s.available, locale)}
            </Text>
            {s.nextPayoutAt ? (
              <Text variant="meta">
                {`${t("Pencairan berikutnya", "Next payout")} ${new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short" }).format(new Date(s.nextPayoutAt))}`}
              </Text>
            ) : null}
          </View>
          {/* The seven money rows: 40 tall, every amount on the card's right edge, no row's height depends on its amount. */}
          <ListCard inset={0}>
            {moneyStates.map((m) => (
              <KeyValueRow key={m.key} testID={`uang-row-${m.key}`} label={pick(m.label)} value={settlementCurrency(s[m.key], locale)} />
            ))}
          </ListCard>
          {/* What each row means, under the list: the explanation never makes a money row taller. */}
          <View testID="uang-hints" style={{ gap: nativeLayout.groupGap }}>
            {moneyStates.map((m) => (
              <Text key={m.key} variant="meta">
                <Text variant="meta" style={{ color: c.charcoal, fontFamily: fontFor("700") }}>{`${pick(m.label)}.`}</Text>
                {` ${pick(m.hint)}`}
              </Text>
            ))}
          </View>
        </View>
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
