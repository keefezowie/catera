import { useState } from "react";
import { Linking, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { jakartaDay, whatsappUrl, type SellerCustomer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, Chip, fontFor, PressableRow, PressableScale, Screen, Text, useColors } from "@catera/mobile-ui";
import { activeSubscriptions, currentSubscription, customerStatus, activeEndLabel, type CustomerStatus } from "./rules";
import { loadAllCustomers } from "./load";
import { ReadError } from "../ReadError";

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
  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="title">{t("Pelanggan", "Customers")}</Text>
        <Button variant="secondary" label={t("+ Pelanggan lama", "+ Existing")} onPress={() => router.push("/impor" as never)} />
      </View>
      {list.data ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["active", "ending", "ended"] as const).map((s) => (
            <Chip key={s} label={`${labels[s]} · ${count(s)}`} selected={filter === s} onPress={() => setFilter(s)} />
          ))}
        </View>
      ) : null}
      {!list.data && list.error ? <ReadError message={list.error} onRetry={() => void list.reload()} /> : null}
      {!list.data && !list.error ? <Text variant="caption">{t("Memuat pelanggan…", "Loading customers…")}</Text> : null}
      {list.data && !shown.length ? (
        <Text variant="caption">{t("Belum ada pelanggan di sini.", "No customers here yet.")}</Text>
      ) : null}
      {shown.map((c) => {
        const s = currentSubscription(c);
        const others = Math.max(activeSubscriptions(c).length - 1, 0);
        return (
          <Card key={c.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <PressableRow
              accessibilityRole="button"
              onPress={() => router.push(`/pelanggan/${c.id}` as never)}
              style={{ flex: 1, gap: 2, minHeight: 48, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: fontFor("800") }}>{c.name}</Text>
              {s ? <Text variant="caption">{`${s.package_name} · ${s.portions} porsi`}</Text> : null}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                {s && s.status === "active" ? (
                  <Text variant="caption" style={{ color: palette.sunriseInk, fontFamily: fontFor("700") }}>
                    {activeEndLabel(s, today, t, locale)}
                  </Text>
                ) : null}
                {others ? <Text variant="caption">{`+${others} ${t("paket lain", "more packages")}`}</Text> : null}
                <Text variant="caption">
                  {c.origin === "marketplace" ? t("Dari marketplace", "From marketplace") : t("Pelanggan Anda", "Your customer")}
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
        );
      })}
    </Screen>
  );
}
