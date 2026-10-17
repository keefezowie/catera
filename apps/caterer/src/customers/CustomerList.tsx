import { useEffect, useRef, useState } from "react";
import { Linking, RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { jakartaDay, whatsappUrl, type SellerCustomer } from "@catera/domain";
import { useData, useMobile, plural } from "@catera/mobile-core";
import {
  Button,
  Card,
  Chip,
  FadeSwap,
  fontFor,
  MoodHeader,
  PressableRow,
  PressableScale,
  RowSwap,
  Screen,
  Text,
  useColors,
  useListMotion,
} from "@catera/mobile-ui";
import { activeSubscriptions, currentSubscription, customerStatus, activeEndLabel, type CustomerStatus } from "./rules";
import { loadAllCustomers } from "./load";
import { useImportCommits } from "../import/commits";
import { customerHref } from "../hrefs";
import { ReadError } from "../ReadError";
import { ListSkeleton } from "../skeletons";

/** Every subscriber, marketplace and own, filtered by where their package stands. */
export function CustomerList() {
  const { runtime, actor, t, locale } = useMobile();
  // Named palette because `c` is a customer in the callbacks below.
  const palette = useColors();
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
  return (
    <Screen
      header={<MoodHeader testID="pelanggan-header" title={t("Pelanggan", "Customers")} />}
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
      {/* A secondary button draws its label in the theme ink, so it sits on the page and not on the header fill. */}
      <Button
        variant="secondary"
        label={t("+ Pelanggan lama", "+ Existing customer")}
        onPress={() => router.push("/impor" as never)}
        style={{ alignSelf: "flex-start" }}
      />
      {!list.data && list.error ? <ReadError art message={list.error} onRetry={() => void list.reload()} /> : null}
      {/* The rows enter from their skeleton as one block, never one by one. */}
      {list.data || !list.error ? (
        <FadeSwap swapKey={list.data ? "list" : "loading"}>
          {list.data ? (
            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["active", "ending", "ended"] as const).map((s) => (
                  <Chip key={s} label={`${labels[s]} · ${count(s)}`} selected={filter === s} onPress={() => setFilter(s)} />
                ))}
              </View>
              {!shown.length ? (
                <Text variant="caption">{t("Belum ada pelanggan di sini.", "No customers here yet.")}</Text>
              ) : null}
              <RowSwap swapKey={`${filter}:${swaps}`}>
                {shown.map((c) => {
                  const s = currentSubscription(c);
                  const others = Math.max(activeSubscriptions(c).length - 1, 0);
                  return (
                    <Animated.View key={c.id} testID="customer-row" {...rowMotion(c.id)}>
                      <Card style={{ flexDirection: "row", alignItems: "center" }}>
                        <PressableRow
                          accessibilityRole="button"
                          onPress={() => router.push(customerHref(c.id, c.name) as never)}
                          style={{ flex: 1, gap: 2, minHeight: 48, justifyContent: "center" }}
                        >
                          <Text style={{ fontFamily: fontFor("800") }}>{c.name}</Text>
                          {s ? <Text variant="caption">{t(`${s.package_name} · ${s.portions} porsi`, `${s.package_name} · ${plural(s.portions, "portion")}`)}</Text> : null}
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                            {s && s.status === "active" ? (
                              <Text variant="caption" style={{ color: palette.charcoal, fontFamily: fontFor("700") }}>
                                {activeEndLabel(s, today, t, locale)}
                              </Text>
                            ) : null}
                            {others ? <Text variant="caption">{`+${others} ${t("paket lain", "more packages")}`}</Text> : null}
                            <Text variant="caption">
                              {c.origin === "marketplace" ? t("Dari marketplace", "From marketplace") : t("Pelangganmu", "Your customer")}
                            </Text>
                          </View>
                        </PressableRow>
                        {c.phone ? (
                          <PressableScale
                            accessibilityRole="link"
                            accessibilityLabel={`${t("Chat", "Chat")} ${c.name}`}
                            onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))}
                            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={22} color={palette.forest} />
                          </PressableScale>
                        ) : null}
                      </Card>
                    </Animated.View>
                  );
                })}
              </RowSwap>
            </View>
          ) : (
            <ListSkeleton rows={4} chips={3} label={t("Memuat pelanggan", "Loading customers")} />
          )}
        </FadeSwap>
      ) : null}
    </Screen>
  );
}
