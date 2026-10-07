import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { currency, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, colors, Screen, Text } from "@catera/mobile-ui";
import { photoUri } from "./Plate";

/** Beranda without an active package: food first, then how caterer links work. */
export function EmptyHome() {
  const { runtime, actor, t, locale } = useMobile();
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
      {offers.map((o) => (
        <Pressable
          key={o.id}
          accessibilityRole="button"
          accessibilityLabel={`${o.name}, ${o.caterer}`}
          onPress={() => router.push(`/package/${encodeURIComponent(o.id)}` as never)}
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
            <Text variant="caption">
              {o.caterer} · {t(`${currency(o.price, locale)} per hari`, `${currency(o.price, locale)} per day`)}
            </Text>
          </View>
        </Pressable>
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
