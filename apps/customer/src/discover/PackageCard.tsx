import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { currency, perMealPrice } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { colors, Text } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { cardLine, type CatalogOffer } from "./format";

/** The round surface button on photos: heart (save) and back. */
export function RoundButton({
  icon,
  label,
  onPress,
  selected,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={[styles.round, style]}
    >
      <Ionicons name={icon} size={22} color={colors.forest} />
    </Pressable>
  );
}

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
          <View style={styles.row}>
            <Text variant="heading" style={{ flex: 1 }} numberOfLines={2}>
              {offer.name}
            </Text>
            <Text variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
              {currency(perMealPrice(offer), locale)}
            </Text>
          </View>
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
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
