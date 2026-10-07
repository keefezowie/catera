import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { whatsappUrl } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, Chip, colors, Screen, Text } from "@catera/mobile-ui";
import { currentSubscription, customerStatus, type CustomerStatus } from "./rules";

/** Every subscriber, marketplace and own, filtered by where their package stands. */
export function CustomerList() {
  const { runtime, actor, t } = useMobile();
  const id = actor?.catererId ?? "";
  const list = useData(`customers:${id}`, () => runtime.api.sellerCustomers(id));
  const [filter, setFilter] = useState<CustomerStatus>("active");
  const customers = list.data?.customers ?? [];
  const count = (s: CustomerStatus) => customers.filter((c) => customerStatus(c) === s).length;
  const shown = customers.filter((c) => customerStatus(c) === filter);
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["active", "ending", "ended"] as const).map((s) => (
          <Chip key={s} label={`${labels[s]} · ${count(s)}`} selected={filter === s} onPress={() => setFilter(s)} />
        ))}
      </View>
      {list.error && !list.data ? <Text style={{ color: colors.danger }}>{list.error}</Text> : null}
      {list.data && !shown.length ? (
        <Text variant="caption">{t("Belum ada pelanggan di sini.", "No customers here yet.")}</Text>
      ) : null}
      {shown.map((c) => {
        const s = currentSubscription(c);
        return (
          <Card key={c.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/pelanggan/${c.id}` as never)}
              style={{ flex: 1, gap: 2 }}
            >
              <Text style={{ fontWeight: "800" }}>{c.name}</Text>
              {s ? <Text variant="caption">{`${s.package_name} · ${s.portions} porsi`}</Text> : null}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                {s && s.status === "active" ? (
                  <Text variant="caption" style={{ color: colors.sunriseInk, fontWeight: "700" }}>
                    {s.remaining <= 1 ? t("Berakhir besok", "Ends tomorrow") : `${t("Sisa", "Left")} ${s.remaining} ${t("hari", "days")}`}
                  </Text>
                ) : null}
                <Text variant="caption">
                  {c.origin === "marketplace" ? t("Dari marketplace", "From marketplace") : t("Pelanggan Anda", "Your customer")}
                </Text>
              </View>
            </Pressable>
            {c.phone ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${t("Chat", "Chat")} ${c.name}`}
                onPress={() => void Linking.openURL(whatsappUrl("", c.phone!))}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.forest} />
              </Pressable>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
