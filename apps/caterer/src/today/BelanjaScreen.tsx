import { useLayoutEffect, useMemo } from "react";
import { Share, View } from "react-native";
import * as Print from "expo-print";
import { weekRecap, type WeekRecap } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { plural, useData, useMobile } from "@catera/mobile-core";
import {
  FadeSwap,
  HeaderIconButton,
  KeyValueRow,
  ListCard,
  ReadError,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  StateArt,
  Text,
  useScreenNavigation,
} from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { ScreenGuard } from "../ErrorBoundary";
import { belanjaDates, belanjaHtml, belanjaLines, belanjaRange, dishSections, OTHER_CATEGORY, weekRange } from "./belanja";
import { TextAction } from "./rows";

/** The seven days' dishes while they load: a lead and two sections of rows at KeyValueRow's height. No spinner. */
function BelanjaSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat rekap belanja", "Loading the shopping recap")}>
      <View testID="belanja-skeleton" style={{ gap: nativeLayout.dense.sectionGap }}>
        <View style={{ gap: nativeLayout.space.xs }}>
          <Skeleton width={160} height={32} radius={16} />
          <Skeleton width={200} height={14} radius={7} />
        </View>
        {[3, 2].map((rows, s) => (
          <View key={s} style={{ gap: nativeLayout.space.sm }}>
            <Skeleton width={88} height={14} radius={7} />
            <ListCard inset={0}>
              {Array.from({ length: rows }, (_, i) => (
                <View
                  key={i}
                  style={{ minHeight: nativeLayout.row.keyValue, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Skeleton width={i % 2 ? "40%" : "55%"} height={14} radius={7} />
                  <Skeleton width={56} height={14} radius={7} />
                </View>
              ))}
            </ListCard>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/** Bagikan and Cetak in the native bar, once there is a recap to send. Both write Indonesian whatever the app language. */
function useBelanjaActions(week: WeekRecap | null, caterer: string) {
  const { t } = useMobile();
  const navigation = useScreenNavigation();
  const sendable = !!week && (week.total > 0 || week.unfilled > 0);
  useLayoutEffect(() => {
    if (!navigation) return;
    navigation.setOptions({
      headerRight:
        sendable && week
          ? () => (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <HeaderIconButton
                  icon="share"
                  label={t("Bagikan", "Share")}
                  onPress={() => void Share.share({ message: belanjaLines(week, caterer) })}
                />
                <HeaderIconButton
                  icon="print"
                  slot="trailing"
                  label={t("Cetak", "Print")}
                  onPress={() => void Print.printAsync({ html: belanjaHtml(week, caterer) })}
                />
              </View>
            )
          : undefined,
    });
  }, [navigation, sendable, week, caterer, t]);
}

/**
 * Belanja 7 hari: portions per dish over today and the six days after, for planning the shopping. There is no
 * ingredient data, so it counts portions, not kilos. Every one of the seven reads must answer: a recap missing a day
 * would under-buy, so one failure shows the error and no partial list. Owners and helpers both open it; only the owner
 * can fill the menus that are still empty.
 */
function BelanjaContent() {
  const { runtime, actor, t, locale } = useMobile();
  const catererId = actor?.catererId ?? "";
  const owner = actor?.role === "owner";
  // The read keeps the range it was made for (`belanjaRange`, the same one the Hari ini row shows) beside its days.
  const days = useData(`belanja:${catererId}`, async () => {
    const now = new Date();
    const read = await Promise.all(belanjaDates(now).map((date) => runtime.api.sellerOperations(catererId, date)));
    return { days: read, range: belanjaRange(now) };
  });
  const week = useMemo(
    () => (days.data ? { ...weekRecap(days.data.days), ...days.data.range } : null),
    [days.data],
  );
  const caterer = days.data?.days[0]?.caterer.name ?? "";
  useBelanjaActions(week, caterer);
  const title = t("Belanja 7 hari", "Shopping, 7 days");

  if (!week) {
    // A failed read before anything arrived: no partial list.
    const failed = !!days.error;
    return (
      <Screen nativeTitle={title}>
        <FadeSwap swapKey={failed ? "error" : "loading"} style={{ gap: 16 }}>
          {failed ? (
            <ReadError
              art
              message={t("Rekap belanja belum bisa dimuat.", "The shopping recap can't be loaded yet.")}
              onRetry={() => void days.reload()}
            />
          ) : (
            <BelanjaSkeleton />
          )}
        </FadeSwap>
      </Screen>
    );
  }

  if (week.total === 0 && week.unfilled === 0)
    return (
      <Screen nativeTitle={title}>
        <FadeSwap swapKey="empty" style={{ gap: 16 }}>
          <View testID="belanja-empty" style={{ alignItems: "center", gap: 12 }}>
            <StateArt pose="tidur" />
            <Text selectable style={{ textAlign: "center" }}>
              {t("Belum ada pesanan 7 hari ke depan.", "No orders in the next 7 days.")}
            </Text>
          </View>
        </FadeSwap>
      </Screen>
    );

  const portions = (n: number) => t(`${n} porsi`, plural(n, "portion"));
  return (
    <Screen nativeTitle={title}>
      <FadeSwap swapKey="recap">
        <View testID="belanja-sections" style={{ gap: nativeLayout.dense.sectionGap }}>
          <View testID="belanja-lead" style={{ gap: nativeLayout.space.xs }}>
            <Text variant="figure" selectable testID="belanja-total">
              {portions(week.total)}
            </Text>
            <Text variant="meta" selectable style={{ fontVariant: ["tabular-nums"] }}>
              {weekRange(week, locale)}
            </Text>
          </View>
          {dishSections(week).map((section) => (
            <View key={section.category} testID={`belanja-section-${section.category || "lainnya"}`}>
              <SectionHeader title={section.category || t(OTHER_CATEGORY, "Other")} />
              <ListCard inset={0}>
                {section.dishes.map((d) => (
                  <KeyValueRow key={d.name} testID={`belanja-dish-${d.name}`} label={d.name} value={portions(d.count)} />
                ))}
              </ListCard>
            </View>
          ))}
          {week.unfilled > 0 ? (
            <View testID="belanja-unfilled" style={{ alignItems: "flex-start" }}>
              {/* A to-do status, not an error: bold charcoal, never a bare danger caption. */}
              <Text variant="bodyStrong" selectable>
                {`${t("Menu belum diisi", "Menu not filled in")} · ${portions(week.unfilled)}`}
              </Text>
              {owner ? (
                <TextAction
                  testID="belanja-fill-menu"
                  label={t("Isi menu", "Fill in menu")}
                  flush="start"
                  onPress={() => goToTab("menu")}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </FadeSwap>
    </Screen>
  );
}

export function BelanjaScreen() {
  const { t } = useMobile();
  return (
    <ScreenGuard message={t("Rekap belanja belum bisa ditampilkan.", "The shopping recap can't be shown right now.")}>
      <BelanjaContent />
    </ScreenGuard>
  );
}
