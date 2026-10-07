import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { currency, type Subscription } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { colors, Text } from "@catera/mobile-ui";
import { SunriseButton } from "./Plate";

/** Shown at 3 or fewer days left; renewal stays an explicit purchase. */
export function RenewalCard({ subscription: s }: { subscription: Subscription }) {
  const { t, locale } = useMobile();
  const offer = s.snapshot.offer;
  return (
    <View style={styles.card}>
      <Text variant="caption" style={{ color: colors.charcoal, fontWeight: "700" }}>
        {offer.name} · {offer.caterer}
      </Text>
      <Text variant="title" style={{ color: colors.charcoal }}>
        {t(`Sisa ${s.remaining} hari`, `${s.remaining} days left`)}
      </Text>
      <Text>
        {t(
          `Paket ${offer.days} hari · harga terakhir ${currency(offer.price, locale)} per porsi per hari`,
          `${offer.days}-day package · last price ${currency(offer.price, locale)} per portion per day`,
        )}
      </Text>
      <SunriseButton
        label={t("Perpanjang", "Renew")}
        onPress={() => router.push(`/renew/${encodeURIComponent(s.id)}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.sunrise,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
});
