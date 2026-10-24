import { useEffect, useRef, useState } from "react";
import { Linking, RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { addDays, jakartaDay, whatsappUrl, type CustomerSubscription, type Locale, type SellerCustomer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Chip,
  FadeSwap,
  ListCard,
  MoodHeader,
  PressableScale,
  RowSwap,
  Screen,
  Text,
  TwoLineRow,
  useColors,
  useListMotion,
  useScreenMargin,
  useTouchTarget,
} from "@catera/mobile-ui";
import { activeSubscriptions, currentSubscription, customerStatus, endLabel, type CustomerStatus } from "./rules";
import { loadAllCustomers } from "./load";
import { useImportCommits } from "../import/commits";
import { customerHref } from "../hrefs";
import { ReadError } from "../ReadError";
import { ListSkeleton } from "../skeletons";

/** The chat button's 48 target pulls 8 into the card's side padding, so its glyph ends where the other rows' text does. */
const CHAT_PULL = -8;
/**
 * The chips' frame sits 4 closer to the header than the screen body's 16 would put it: the board draws the visible
 * chip 12 below the title row, and the frame's own 7 above the chip makes up the rest.
 */
const CHIPS_LIFT = -4;

/**
 * What the row says about a package's days: "sisa 9 hari", or the date wording when the package ends today or tomorrow
 * (or has nothing left to deliver), the same words the card used.
 */
function daysLeft(
  s: Pick<CustomerSubscription, "ends_on" | "remaining">,
  today: string,
  t: (id: string, en: string) => string,
  locale: Locale,
) {
  if (s.remaining <= 0 || s.ends_on === today || s.ends_on === addDays(today, 1)) return endLabel(s.ends_on, today, t, locale);
  return t(`sisa ${s.remaining} hari`, s.remaining === 1 ? "1 day left" : `${s.remaining} days left`);
}

/** Every subscriber, marketplace and own, filtered by where their package stands. */
export function CustomerList() {
  const { runtime, actor, t, locale } = useMobile();
  // Named palette because `c` is a customer in the callbacks below.
  const palette = useColors();
  const target = useTouchTarget();
  const margin = useScreenMargin();
  const id = actor?.catererId ?? "";
  const list = useData(`customers:${id}`, () => loadAllCustomers(runtime, id));
  const [filter, setFilter] = useState<CustomerStatus>("active");
  const today = jakartaDay(new Date());
  const customers = list.data?.customers ?? [];
  // Aktif is everyone on a running package, so it includes those about to end.
  const inFilter = (c: SellerCustomer, s: CustomerStatus) =>
    s === "active" ? customerStatus(c) !== "ended" : customerStatus(c) === s;
  const count = (s: CustomerStatus) => customers.filter((c) => inFilter(c, s)).length;
  const shown = customers.filter((c) => inFilter(c, filter));
  const labels: Record<CustomerStatus, string> = {
    active: t("Aktif", "Active"),
    ending: t("Segera berakhir", "Ending soon"),
    ended: t("Selesai", "Ended"),
  };
  // Pull to refresh reads the list again while the rows stay; only the spinner says so.
  const [pulling, setPulling] = useState(false);
  // Only the caterer's own import on this phone inserts rows: the answer that follows it lets the new customers enter.
  // Any other new answer (the first load, a pull to refresh, a push, a change made on the web) is a refresh, and a
  // refresh or a filter change swaps the rows as one block, with no entrance, no exit and no move (Decision A).
  const imports = useImportCommits();
  const seen = useRef({ data: list.data, imports, swaps: 0 });
  const answered = list.data !== seen.current.data;
  const byImport = answered && !!seen.current.data && imports !== seen.current.imports;
  const swaps = seen.current.swaps + (answered && !byImport ? 1 : 0);
  useEffect(() => {
    if (answered) seen.current = { data: list.data, imports, swaps };
  });
  const rowMotion = useListMotion(list.data ? customers.map((c) => c.id) : null, !byImport);
  async function pull() {
    setPulling(true);
    try {
      await list.reload();
    } finally {
      setPulling(false);
    }
  }
  const addLabel = t("+ Pelanggan lama", "+ Existing customer");
  return (
    <Screen
      plainHeader
      header={
        // No mood band: the title and the one action share a 44 row on the canvas (spec 3.2); no empty row above.
        <MoodHeader
          plain
          testID="pelanggan-header"
          title={null}
          meta={
            <Text variant="heroTitle" accessibilityRole="header">
              {t("Pelanggan", "Customers")}
            </Text>
          }
          trailing={
            // A 48 target in the 44 row: it overhangs the row by 2 above and below, and its label ends on the margin.
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              haptic="tap"
              onPress={() => router.push("/impor" as never)}
              style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, marginRight: -8, marginVertical: -2 }}
            >
              <Ionicons name="add" size={20} color={palette.forest} />
              {/* forest: action */}
              <Text variant="bodyStrong" style={{ color: palette.forest }}>
                {addLabel.replace(/^\+\s*/, "")}
              </Text>
            </PressableScale>
          }
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => void pull()}
          tintColor={palette.forest}
          colors={[palette.forest]}
          progressBackgroundColor={palette.surface}
        />
      }
    >
      {!list.data && list.error ? <ReadError art message={list.error} onRetry={() => void list.reload()} /> : null}
      {/* The rows enter from their skeleton as one block, never one by one. */}
      {list.data || !list.error ? (
        <View style={{ marginTop: CHIPS_LIFT }}>
          <FadeSwap swapKey={list.data ? "list" : "loading"}>
            {list.data ? (
              <View style={{ gap: 8 }}>
                {/* One row of chips that scrolls sideways. The frame is a real 48 tall and never shrinks (a hit slop cannot
                    reach past its parent), and runs to the right screen edge while the chips start at the margin. */}
                <View testID="pelanggan-chips-frame" style={{ height: target, flexShrink: 0, marginRight: -margin }}>
                  <ScrollView
                    testID="pelanggan-chips"
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={{ flexGrow: 0, flexShrink: 0, height: target }}
                    contentContainerStyle={{ gap: 8, alignItems: "center", paddingRight: margin }}
                  >
                    {(["active", "ending", "ended"] as const).map((s) => (
                      <Chip key={s} label={`${labels[s]} · ${count(s)}`} selected={filter === s} onPress={() => setFilter(s)} />
                    ))}
                  </ScrollView>
                </View>
                {!shown.length ? (
                  <Text variant="caption">{t("Belum ada pelanggan di sini.", "No customers here yet.")}</Text>
                ) : null}
                <RowSwap swapKey={`${filter}:${swaps}`}>
                  {shown.length ? (
                    <ListCard inset={0}>
                      {shown.map((c) => {
                        const s = currentSubscription(c);
                        const others = Math.max(activeSubscriptions(c).length - 1, 0);
                        const meta = [
                          s?.package_name,
                          s && s.status === "active" ? daysLeft(s, today, t, locale) : null,
                          others ? `+${others} ${t("paket lain", "more packages")}` : null,
                          c.address.area,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <Animated.View key={c.id} testID="customer-row" {...rowMotion(c.id)}>
                            <TwoLineRow
                              title={c.name}
                              meta={meta}
                              onPress={() => router.push(customerHref(c.id, c.name) as never)}
                              trailing={
                                c.phone ? (
                                  <PressableScale
                                    accessibilityRole="link"
                                    accessibilityLabel={`${t("Chat", "Chat")} ${c.name}`}
                                    onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))}
                                    style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: CHAT_PULL }}
                                  >
                                    <Ionicons name="chatbubble-ellipses-outline" size={22} color={palette.forest} />
                                  </PressableScale>
                                ) : undefined
                              }
                            />
                          </Animated.View>
                        );
                      })}
                    </ListCard>
                  ) : null}
                </RowSwap>
              </View>
            ) : (
              <ListSkeleton shape="customer" rows={8} chips={3} label={t("Memuat pelanggan", "Loading customers")} />
            )}
          </FadeSwap>
        </View>
      ) : null}
    </Screen>
  );
}
