import type { ReactNode } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { currency, perMealPrice, priceUnitLabel, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, MoodHeader, PressableRow, Screen, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { photoUri } from "./Plate";

/**
 * Beranda without an active package: food first, then how caterer links work.
 * `lead` sits above the invitation: the "Paket selesai" recap of a plan that just ended.
 */
export function EmptyHome({ lead }: { lead?: ReactNode } = {}) {
  const { runtime, actor, t } = useMobile();
  const c = useColors();
  const catalog = useData("home:catalog", () => runtime.api.catalog("?limit=3"));
  const offers: Offer[] = (catalog.data?.items ?? []).slice(0, 3);
  return (
    <Screen header={<MoodHeader testID="beranda-header" title={t("Beranda", "Home")} />}>
      {lead}
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Text variant="title">{t("Mau makan apa minggu ini?", "What would you like to eat this week?")}</Text>
        <Text style={{ color: c.muted }}>
          {t(
            "Pilih paket katering rumahan, diantar sesuai jadwal Anda.",
            "Pick a home-style catering package, delivered on your schedule.",
          )}
        </Text>
      </View>
      {catalog.loading && !catalog.data ? (
        <Text style={{ color: c.muted }}>{t("Memuat paket…", "Loading packages…")}</Text>
      ) : null}
      {catalog.error && !catalog.data ? (
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: c.danger }}>
            {catalog.error}
          </Text>
          <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void catalog.reload()} />
        </View>
      ) : null}
      {catalog.data && !offers.length ? (
        <Text style={{ color: c.muted }}>{t("Belum ada paket.", "No packages yet.")}</Text>
      ) : null}
      {offers.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}
      <Button label={t("Jelajah paket", "Browse packages")} onPress={() => router.push("/jelajah" as never)} />
      <Text variant="caption">
        {t(
          "Dapat tautan dari katering Anda? Buka tautannya untuk menyambungkan paket ke akun ini.",
          "Got a link from your caterer? Open it to connect your package to this account.",
        )}
      </Text>
      {!actor ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Sudah berlangganan?", "Already subscribed?")}</Text>
          <Button variant="secondary" label={t("Masuk", "Sign in")} onPress={() => router.push("/login" as never)} />
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  photo: { height: 150, width: "100%", backgroundColor: c.sage },
}));

function OfferCard({ offer: o }: { offer: Offer }) {
  const { runtime, t, locale } = useMobile();
  const styles = useStyles();
  const { unit, note } = priceUnitLabel(o, locale);
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={`${o.name}, ${o.caterer}`}
      onPress={() => router.push(`/paket/${encodeURIComponent(o.id)}` as never)}
      style={styles.card}
    >
      {o.image ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: photoUri(o.image, runtime.apiBase) }}
          style={styles.photo}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ padding: 14, gap: 2 }}>
        <Text variant="heading">{o.name}</Text>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {o.caterer} · {currency(perMealPrice(o), locale)} {unit}
        </Text>
        {note ? <Text variant="caption">{note}</Text> : null}
      </View>
    </PressableRow>
  );
}
