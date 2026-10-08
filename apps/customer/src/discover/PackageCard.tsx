import { Image, Pressable, StyleSheet, View } from "react-native";
import { currency, perMealPrice, priceUnitLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { colors, RoundButton, Text } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { cardLine, type CatalogOffer } from "./format";

/** A package as food first: photo, name, price per portion, who cooks and when. */
export function PackageCard({
  offer,
  saved,
  onOpen,
  onToggleSaved,
}: {
  offer: CatalogOffer;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
}) {
  const { runtime, t, locale } = useMobile();
  const { unit, note } = priceUnitLabel(offer, locale);
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${offer.name}, ${offer.caterer}`} onPress={onOpen}>
        {offer.image ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(offer.image, runtime.apiBase) }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photo} />
        )}
        <View style={styles.body}>
          <Text variant="heading" numberOfLines={2}>
            {offer.name}
          </Text>
          <View style={styles.price}>
            <Text variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
              {currency(perMealPrice(offer), locale)}
            </Text>
            <Text variant="caption">{unit}</Text>
          </View>
          {note ? <Text variant="caption">{note}</Text> : null}
          <Text variant="caption" style={{ fontSize: 13 }}>
            {cardLine(offer, locale)}
          </Text>
          {offer.trialPrice ? (
            <Text variant="label" style={{ color: colors.sunriseInk }}>
              {t("Bisa coba 1 hari dulu", "One-day trial available")}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <RoundButton
        icon={saved ? "heart" : "heart-outline"}
        label={saved ? t(`Hapus ${offer.name} dari simpanan`, `Remove ${offer.name} from saved`) : t(`Simpan ${offer.name}`, `Save ${offer.name}`)}
        selected={saved}
        onPress={onToggleSaved}
        style={{ position: "absolute", top: 10, right: 10 }}
      />
    </View>
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
  photo: { height: 196, width: "100%", backgroundColor: colors.sage },
  body: { padding: 14, gap: 4 },
  price: { flexDirection: "row", alignItems: "baseline", gap: 6 },
});
