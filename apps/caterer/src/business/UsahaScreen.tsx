import { Image, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { currency } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  FadeSwap,
  MoodHeader,
  PressableRow,
  RoundButton,
  Screen,
  Text,
  useActionSheet,
  useColors,
} from "@catera/mobile-ui";
import { usePaymentsActive } from "../customers/usePayments";
import { packageHref } from "../hrefs";
import { photoUri } from "../photo";
import { ReadError } from "../ReadError";
import { ListSkeleton } from "../skeletons";
import { SettingsGear } from "../settings/Pengaturan";

function Row({
  icon,
  label,
  detail,
  href,
  image,
  more,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  href: string;
  image?: string;
  /** A trailing "…" that opens the row's action sheet; its spoken name ends with the row's name. */
  more?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  const row = (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as never)}
      style={{ flex: more ? 1 : undefined, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}
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
      {more ? null : <Ionicons name="chevron-forward" size={18} color={c.muted} />}
    </PressableRow>
  );
  if (!more) return row;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {row}
      <RoundButton icon="ellipsis-horizontal" label={more.label} onPress={more.onPress} />
    </View>
  );
}

/** Usaha: packages, money, importing customers, team and payments: the things set up once. Pengaturan comes last. */
export function UsahaScreen() {
  const { runtime, actor, t, locale } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const payments = usePaymentsActive();
  const actions = useActionSheet();
  const offers = (ops.data?.offers ?? []).filter((o) => o.status !== "retired");
  /** "…" on a package: look at it, or copy it into a new package (a live package's terms cannot change). */
  async function packageActions(o: (typeof offers)[number], detail: string, image: string | undefined) {
    const key = await actions({
      title: t("Paket", "Package"),
      context: { image, title: o.name, lines: [detail] },
      items: [
        { key: "lihat", label: t("Lihat paket", "View package"), icon: "eye-outline" },
        { key: "salin", label: t("Salin jadi paket baru", "Copy into a new package"), icon: "copy-outline" },
      ],
      closeLabel: t("Tutup", "Close"),
    });
    if (key === "lihat") router.push(packageHref(o.id, o.name) as never);
    // Paket baru says "Paket disalin" once the copy is actually in its editor.
    else if (key === "salin") router.push(`/paket/baru?from=${o.id}` as never);
  }
  const name = ops.data?.caterer.name;
  return (
    <Screen
      header={
        <MoodHeader
          testID="usaha-header"
          meta={name ? t("Usaha", "Business") : undefined}
          title={name || t("Usaha", "Business")}
          trailing={<SettingsGear />}
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
        {/* The package rows enter from their skeleton as one block, inside this card. */}
        {ops.data || !ops.error ? (
          <FadeSwap swapKey={ops.data ? "packages" : "loading"} style={{ gap: 10 }}>
            {ops.data ? (
              <>
                {offers.map((o) => {
                  // A draft with no price yet shows only its state: no stand-in for a value the read does not hold.
                  const state = o.status === "published" ? t("tayang", "live") : t("draf", "draft");
                  const detail = o.price === null ? state : `${currency(o.price, locale)} · ${state}`;
                  const image = o.image ? photoUri(o.image, runtime.apiBase) : undefined;
                  return (
                    <Row
                      key={o.id}
                      icon="restaurant-outline"
                      label={o.name}
                      detail={detail}
                      href={packageHref(o.id, o.name)}
                      image={image}
                      more={{
                        label: `${t("Lihat atau salin", "View or copy")}: ${o.name}`,
                        onPress: () => void packageActions(o, detail, image),
                      }}
                    />
                  );
                })}
                <Button variant="secondary" label={t("+ Paket baru", "+ New package")} onPress={() => router.push("/paket/baru" as never)} />
              </>
            ) : (
              <ListSkeleton bare rows={2} label={t("Memuat paket", "Loading packages")} />
            )}
          </FadeSwap>
        ) : null}
      </Card>
      <Card>
        <Row icon="wallet-outline" label={t("Uang", "Money")} detail={t("Saldo dan pencairan", "Balance and payouts")} href="/uang" />
        <Row icon="people-outline" label={t("Impor pelanggan", "Import customers")} detail={t("Dari catatan, foto atau Excel", "From notes, photos or Excel")} href="/impor" />
        <Row icon="person-add-outline" label={t("Tim", "Team")} detail={t("Undang pembantu dapur", "Invite a kitchen helper")} href="/tim" />
        <Row icon="card-outline" label={t("Pembayaran", "Payments")} detail={payments ? t("Aktif", "On") : t("Belum aktif", "Not on yet")} href="/aktifkan" />
      </Card>
      {/* Last: notifications, language, theme and Keluar live in Pengaturan, the same screen a helper opens. */}
      <Card>
        <Row
          icon="settings-outline"
          label={t("Pengaturan", "Settings")}
          detail={t("Notifikasi, bahasa, tampilan", "Notifications, language, appearance")}
          href="/pengaturan"
        />
      </Card>
    </Screen>
  );
}
