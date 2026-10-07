import { Pressable, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { currency } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Segmented, Text } from "@catera/mobile-ui";
import { usePaymentsActive } from "../customers/usePayments";
import { NotifyButton } from "./NotifyButton";

function Row({ icon, label, detail, href }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail?: string; href: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as never)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}
    >
      <Ionicons name={icon} size={22} color={colors.forest} />
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

/** Usaha: packages, money, importing customers, team and payments — the things set up once. */
export function UsahaScreen() {
  const { runtime, actor, t, locale, setLocale, logout } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const payments = usePaymentsActive();
  const offers = (ops.data?.offers ?? []).filter((o) => o.status !== "retired");
  return (
    <Screen>
      <Text variant="title">{ops.data?.caterer.name || t("Usaha", "Business")}</Text>
      {payments === false ? (
        <Card tone="attention">
          <Text variant="heading">{t("Aktifkan pembayaran", "Turn on payments")}</Text>
          <Text>{t("Supaya pelanggan bisa memperpanjang lewat Catera.", "So customers can renew through Catera.")}</Text>
          <Button label={t("Mulai", "Start")} onPress={() => router.push("/aktifkan" as never)} />
        </Card>
      ) : null}
      <Card>
        <Text variant="label">{t("Paket", "Packages")}</Text>
        {offers.map((o) => (
          <Row
            key={o.id}
            icon="restaurant-outline"
            label={o.name}
            detail={`${o.price === null ? "–" : currency(o.price, locale)} · ${o.status === "published" ? t("tayang", "live") : t("draf", "draft")}`}
            href={`/paket/${o.id}`}
          />
        ))}
        <Button variant="secondary" label={t("+ Paket baru", "+ New package")} onPress={() => router.push("/paket/baru" as never)} />
      </Card>
      <Card>
        <Row icon="wallet-outline" label={t("Uang", "Money")} detail={t("Saldo dan pencairan", "Balance and payouts")} href="/uang" />
        <Row icon="people-outline" label={t("Impor pelanggan", "Import customers")} detail={t("Dari catatan, foto atau Excel", "From notes, photos or Excel")} href="/impor" />
        <Row icon="person-add-outline" label={t("Tim", "Team")} detail={t("Undang pembantu dapur", "Invite a kitchen helper")} href="/tim" />
        <Row icon="card-outline" label={t("Pembayaran", "Payments")} detail={payments ? t("Aktif", "On") : t("Belum aktif", "Not on yet")} href="/aktifkan" />
      </Card>
      <NotifyButton />
      <Segmented
        value={locale}
        onChange={setLocale}
        options={[
          { value: "id", label: "Bahasa Indonesia" },
          { value: "en", label: "English" },
        ]}
      />
      <Button variant="text" label={t("Keluar", "Sign out")} onPress={() => void logout()} />
    </Screen>
  );
}
