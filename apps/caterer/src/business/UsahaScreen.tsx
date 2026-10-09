import { Image, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { currency } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  MoodHeader,
  PressableRow,
  Screen,
  Segmented,
  Text,
  useColors,
  useThemePreference,
  type ThemePreference,
} from "@catera/mobile-ui";
import { usePaymentsActive } from "../customers/usePayments";
import { photoUri } from "../photo";
import { NotifyButton } from "./NotifyButton";
import { ReadError } from "../ReadError";

function Row({
  icon,
  label,
  detail,
  href,
  image,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  href: string;
  image?: string;
}) {
  const c = useColors();
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as never)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: 40, height: 40, borderRadius: 8 }} />
      ) : (
        <Ionicons name={icon} size={22} color={c.forest} />
      )}
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </PressableRow>
  );
}

/** Usaha: packages, money, importing customers, team and payments: the things set up once. */
export function UsahaScreen() {
  const { runtime, actor, t, locale, setLocale, logout } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const payments = usePaymentsActive();
  const { preference, setPreference } = useThemePreference();
  const offers = (ops.data?.offers ?? []).filter((o) => o.status !== "retired");
  const name = ops.data?.caterer.name;
  return (
    <Screen
      header={
        <MoodHeader
          testID="usaha-header"
          meta={name ? t("Usaha", "Business") : undefined}
          title={name || t("Usaha", "Business")}
        />
      }
    >
      {payments === false ? (
        <Card tone="attention">
          <Text variant="heading">{t("Terima pembayaran lewat Catera", "Take payments through Catera")}</Text>
          <Text>{t("Supaya pelanggan bisa memperpanjang lewat Catera.", "So customers can renew through Catera.")}</Text>
          <Button label={t("Aktifkan pembayaran", "Turn on payments")} onPress={() => router.push("/aktifkan" as never)} />
        </Card>
      ) : null}
      <Card>
        <Text variant="label">{t("Paket", "Packages")}</Text>
        {!ops.data && ops.error ? <ReadError message={ops.error} onRetry={() => void ops.reload()} /> : null}
        {!ops.data && !ops.error ? <Text variant="caption">{t("Memuat…", "Loading…")}</Text> : null}
        {offers.map((o) => (
          <Row
            key={o.id}
            icon="restaurant-outline"
            label={o.name}
            detail={`${o.price === null ? "–" : currency(o.price, locale)} · ${o.status === "published" ? t("tayang", "live") : t("draf", "draft")}`}
            href={`/paket/${o.id}`}
            image={o.image ? photoUri(o.image, runtime.apiBase) : undefined}
          />
        ))}
        {ops.data ? (
          <Button variant="secondary" label={t("+ Paket baru", "+ New package")} onPress={() => router.push("/paket/baru" as never)} />
        ) : null}
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
      <View style={{ gap: 8 }}>
        <Text variant="label">{t("Tampilan", "Appearance")}</Text>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: "system", label: t("Sistem", "System") },
            { value: "light", label: t("Terang", "Light") },
            { value: "dark", label: t("Gelap", "Dark") },
          ]}
        />
      </View>
      <Button variant="text" label={t("Keluar", "Sign out")} onPress={() => void logout()} />
    </Screen>
  );
}
