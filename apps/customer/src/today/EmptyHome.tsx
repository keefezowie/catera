import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { currency, perMealPrice, priceUnitLabel, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, Screen, Text } from "@catera/mobile-ui";
import { photoUri } from "./Plate";

/** Beranda without an active package: food first, then how caterer links work. */
export function EmptyHome() {
  const { runtime, actor, t } = useMobile();
  const catalog = useData("home:catalog", () => runtime.api.catalog("?limit=3"));
  const offers: Offer[] = (catalog.data?.items ?? []).slice(0, 3);
  return (
    <Screen>
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Text variant="title">{t("Mau makan apa minggu ini?", "What would you like to eat this week?")}</Text>
        <Text style={{ color: colors.muted }}>
          {t(
            "Pilih paket katering rumahan, diantar sesuai jadwal Anda.",
            "Pick a home-style catering package, delivered on your schedule.",
          )}
        </Text>
      </View>
      {catalog.loading && !catalog.data ? (
        <Text style={{ color: colors.muted }}>{t("Memuat paket…", "Loading packages…")}</Text>
      ) : null}
      {catalog.error && !catalog.data ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.danger }}>{catalog.error}</Text>
          <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void catalog.reload()} />
        </View>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photo: { height: 150, width: "100%", backgroundColor: colors.sage },
});

function OfferCard({ offer: o }: { offer: Offer }) {
  const { runtime, t, locale } = useMobile();
  const { unit, note } = priceUnitLabel(o, locale);
  return (
    <Pressable
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
    </Pressable>
  );
}
